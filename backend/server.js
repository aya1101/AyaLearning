// server.js - Backend Server for Japanese Learning App

// Import các thư viện cần thiết
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const { validateShiritori, normalizeKana, getFirstKana, getLastKana, endsWithN } = require('./shirioriUtils');
const kaiwaCharacters = require('./config/kaiwa-characters.json');

// Khởi tạo ứng dụng Express
const app = express();
const port = process.env.PORT || 3001;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-30b-a3b:free';
const TTS_PROVIDER = (process.env.TTS_PROVIDER || 'fish').toLowerCase();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CALENDAR_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:3001/api/assistant/calendar/oauth/callback';
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const parseCsvEnv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const GOOGLE_ALLOWED_CLIENT_IDS = Array.from(
  new Set([
    ...parseCsvEnv(process.env.GOOGLE_ALLOWED_CLIENT_IDS),
    process.env.GOOGLE_CLIENT_ID
  ].filter(Boolean))
);

// Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID || 'demo-client-id',
  process.env.GOOGLE_CLIENT_SECRET || 'demo-secret'
);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// --- SỬ DỤNG POSTGRESQL CONNECTION POOL ---
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'japanese_learning',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5433,
};

const db = new Pool(dbConfig);

const sseClientsByUser = new Map();

const addSseClient = (userId, res) => {
  const key = String(userId);
  const current = sseClientsByUser.get(key) || new Set();
  current.add(res);
  sseClientsByUser.set(key, current);
};

const removeSseClient = (userId, res) => {
  const key = String(userId);
  const current = sseClientsByUser.get(key);
  if (!current) return;
  current.delete(res);
  if (current.size === 0) {
    sseClientsByUser.delete(key);
  }
};

const pushSseEventToUser = (userId, eventName, payload = {}) => {
  const key = String(userId);
  const current = sseClientsByUser.get(key);
  if (!current || current.size === 0) return;

  const data = JSON.stringify({
    ...payload,
    event: eventName,
    at: Date.now()
  });

  for (const client of current) {
    try {
      client.write(`event: ${eventName}\n`);
      client.write(`data: ${data}\n\n`);
    } catch (_error) {
      // ignore single broken stream
    }
  }
};

const pushSseEventToUsers = (userIds = [], eventName, payload = {}) => {
  userIds
    .filter((value, index, arr) => value != null && arr.indexOf(value) === index)
    .forEach((userId) => pushSseEventToUser(userId, eventName, payload));
};

// Middleware
app.use(cors());       // Cho phép tất cả các domain truy cập API (cho mục đích phát triển)
app.use(express.json({ limit: '15mb' })); // Cho phép Express đọc và phân tích JSON từ body của request

// --- MIDDLEWARE: Verify JWT Token ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const getOptionalAuthUser = (req) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_err) {
    return null;
  }
};

app.get('/api/realtime/stream', (req, res) => {
  try {
    const token = req.query?.token ? String(req.query.token) : '';

    if (!token) {
      return res.status(401).json({ message: 'Missing token' });
    }

    let user;
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch (_error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const userId = user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    addSseClient(userId, res);

    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ event: 'connected', userId, at: Date.now() })}\n\n`);

    const heartbeatId = setInterval(() => {
      try {
        res.write(`event: heartbeat\n`);
        res.write(`data: ${JSON.stringify({ at: Date.now() })}\n\n`);
      } catch (_error) {
        // close is handled by request end/close
      }
    }, 25000);

    const closeConnection = () => {
      clearInterval(heartbeatId);
      removeSseClient(userId, res);
      try {
        res.end();
      } catch (_error) {
        // already closed
      }
    };

    req.on('close', closeConnection);
    res.on('close', closeConnection);
  } catch (error) {
    console.error('Realtime stream error:', error);
    res.status(500).json({ message: 'Failed to establish realtime stream' });
  }
});

const ensureOwnershipSchema = async () => {
  await db.query(`
    ALTER TABLE kanji
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  `);

  await db.query(`
    ALTER TABLE vocabulary
    ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  `);

  await db.query('ALTER TABLE kanji DROP CONSTRAINT IF EXISTS kanji_character_key');

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_kanji_character_owner
    ON kanji (character, created_by_user_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_kanji_created_by_user_id
    ON kanji (created_by_user_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_vocabulary_created_by_user_id
    ON vocabulary (created_by_user_id)
  `);
};

const ensureGameRecordsSchema = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_game_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_type VARCHAR(50) NOT NULL,
      best_score INTEGER,
      best_accuracy DECIMAL(5, 2),
      fastest_duration_seconds INTEGER,
      plays_count INTEGER NOT NULL DEFAULT 0,
      last_played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, game_type)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_user_game_records_user_id
    ON user_game_records (user_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_user_game_records_game_type
    ON user_game_records (game_type)
  `);
};

const ensureCalendarTokensSchema = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_calendar_tokens (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(30) NOT NULL DEFAULT 'google',
      refresh_token TEXT,
      access_token TEXT,
      scope TEXT,
      expiry_date BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_user_calendar_tokens_provider
    ON user_calendar_tokens (provider)
  `);
};

const upsertUserGameRecord = async ({ userId, gameType, score = null, accuracy = null, durationSeconds = null }) => {
  const normalizedScore = Number.isFinite(Number(score)) ? Number(score) : null;
  const normalizedAccuracy = Number.isFinite(Number(accuracy)) ? Number(accuracy) : null;
  const normalizedDuration = Number.isFinite(Number(durationSeconds))
    ? Math.max(0, Math.round(Number(durationSeconds)))
    : null;

  const query = `
    INSERT INTO user_game_records (
      user_id,
      game_type,
      best_score,
      best_accuracy,
      fastest_duration_seconds,
      plays_count,
      last_played_at
    )
    VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, game_type) DO UPDATE
    SET
      best_score = CASE
        WHEN EXCLUDED.best_score IS NULL THEN user_game_records.best_score
        WHEN user_game_records.best_score IS NULL THEN EXCLUDED.best_score
        ELSE GREATEST(user_game_records.best_score, EXCLUDED.best_score)
      END,
      best_accuracy = CASE
        WHEN EXCLUDED.best_accuracy IS NULL THEN user_game_records.best_accuracy
        WHEN user_game_records.best_accuracy IS NULL THEN EXCLUDED.best_accuracy
        ELSE GREATEST(user_game_records.best_accuracy, EXCLUDED.best_accuracy)
      END,
      fastest_duration_seconds = CASE
        WHEN EXCLUDED.fastest_duration_seconds IS NULL THEN user_game_records.fastest_duration_seconds
        WHEN user_game_records.fastest_duration_seconds IS NULL THEN EXCLUDED.fastest_duration_seconds
        ELSE LEAST(user_game_records.fastest_duration_seconds, EXCLUDED.fastest_duration_seconds)
      END,
      plays_count = user_game_records.plays_count + 1,
      last_played_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const result = await db.query(query, [
    userId,
    gameType,
    normalizedScore,
    normalizedAccuracy,
    normalizedDuration
  ]);

  return result.rows[0];
};

const logStudyActivity = async ({ userId, sessionType, itemsStudied = 1, durationMinutes = 1, accuracy = null }) => {
  if (!userId || !sessionType) return null;

  const normalizedItems = Number.isFinite(Number(itemsStudied))
    ? Math.max(0, Math.round(Number(itemsStudied)))
    : 0;

  const normalizedDuration = Number.isFinite(Number(durationMinutes))
    ? Math.max(0, Math.round(Number(durationMinutes)))
    : 0;

  const normalizedAccuracy = Number.isFinite(Number(accuracy)) ? Number(accuracy) : null;

  const query = `
    INSERT INTO study_sessions (user_id, session_type, duration_minutes, items_studied, accuracy_percentage)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const result = await db.query(query, [
    userId,
    sessionType,
    normalizedDuration,
    normalizedItems,
    normalizedAccuracy
  ]);

  return result.rows[0] || null;
};

// --- AUTHENTICATION ENDPOINTS ---

// Google OAuth Callback
app.post('/auth/google/callback', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_ALLOWED_CLIENT_IDS.length > 0
        ? GOOGLE_ALLOWED_CLIENT_IDS
        : process.env.GOOGLE_CLIENT_ID || 'demo-client-id'
    });

    const payload = ticket.getPayload();
    const { sub: google_id, email, name, picture: avatar_url } = payload;

    // Check if user exists
    let userQuery = 'SELECT * FROM users WHERE google_id = $1';
    let userResult = await db.query(userQuery, [google_id]);

    let user;
    if (userResult.rows.length === 0) {
      // Create new user
      const createUserQuery = 'INSERT INTO users (google_id, email, name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *';
      userResult = await db.query(createUserQuery, [google_id, email, name, avatar_url]);
      user = userResult.rows[0];

      // Create user profile
      const createProfileQuery = 'INSERT INTO user_profiles (user_id) VALUES ($1) RETURNING *';
      await db.query(createProfileQuery, [user.id]);
    } else {
      user = userResult.rows[0];
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url
      }
    });
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(400).json({ message: 'Invalid token', error: err.message });
  }
});

// Get Current User Profile
app.get('/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userQuery = 'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profileQuery = 'SELECT * FROM user_profiles WHERE user_id = $1';
    const profileResult = await db.query(profileQuery, [userId]);
    
    const user = userResult.rows[0];
    const profile = profileResult.rows[0] || {};

    res.json({
      ...user,
      profile: {
        bio: profile.bio || '',
        preferred_level: profile.preferred_level || 'N5',
        theme: profile.theme || 'light'
      }
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout (just invalidate token on client side, or implement token blacklist if needed)
app.post('/auth/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// --- USER PROFILE ENDPOINTS ---

// Update User Profile
app.put('/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, preferred_level, theme } = req.body;

    const query = `UPDATE user_profiles SET bio = $1, preferred_level = $2, theme = $3 WHERE user_id = $4 RETURNING *`;
    const result = await db.query(query, [bio || null, preferred_level || 'N5', theme || 'light', userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      profile: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- EXAM GOAL ENDPOINTS ---

// Create Exam Goal
app.post('/api/exam-goals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { target_exam_date, target_level, description } = req.body;

    if (!target_exam_date) {
      return res.status(400).json({ message: 'target_exam_date is required' });
    }

    const query = `INSERT INTO exam_goals (user_id, target_exam_date, target_level, description) VALUES ($1, $2, $3, $4) RETURNING *`;
    const result = await db.query(query, [userId, target_exam_date, target_level || 'N5', description || null]);

    res.status(201).json({
      message: 'Exam goal created successfully',
      goal: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating exam goal:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get User Exam Goals
app.get('/api/exam-goals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const query = 'SELECT * FROM exam_goals WHERE user_id = $1 ORDER BY target_exam_date DESC';
    const result = await db.query(query, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching exam goals:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Exam Goal
app.put('/api/exam-goals/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { target_exam_date, target_level, description, completed } = req.body;

    const query = `UPDATE exam_goals SET target_exam_date = $1, target_level = $2, description = $3, completed = $4 WHERE id = $5 AND user_id = $6 RETURNING *`;
    const result = await db.query(query, [target_exam_date, target_level, description, completed, id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Exam goal not found' });
    }

    res.json({
      message: 'Exam goal updated successfully',
      goal: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating exam goal:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Exam Goal
app.delete('/api/exam-goals/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const query = 'DELETE FROM exam_goals WHERE id = $1 AND user_id = $2 RETURNING *';
    const result = await db.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Exam goal not found' });
    }

    res.json({ message: 'Exam goal deleted successfully' });
  } catch (err) {
    console.error('Error deleting exam goal:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- STUDY TRACKING ENDPOINTS ---

// Log Study Session
app.post('/study-sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_type, duration_minutes, items_studied, accuracy_percentage } = req.body;

    const query = `INSERT INTO study_sessions (user_id, session_type, duration_minutes, items_studied, accuracy_percentage) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const result = await db.query(query, [userId, session_type, duration_minutes, items_studied, accuracy_percentage]);

    res.status(201).json({
      message: 'Study session logged successfully',
      session: result.rows[0]
    });
  } catch (err) {
    console.error('Error logging study session:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Study Statistics for User
app.get('/api/study-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Total study time
    const timeQuery = 'SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes FROM study_sessions WHERE user_id = $1';
    const timeResult = await db.query(timeQuery, [userId]);

    // Total items studied
    const itemsQuery = 'SELECT COALESCE(SUM(items_studied), 0) as total_items FROM study_sessions WHERE user_id = $1';
    const itemsResult = await db.query(itemsQuery, [userId]);

    // Average accuracy
    const accuracyQuery = 'SELECT AVG(accuracy_percentage) as avg_accuracy FROM study_sessions WHERE user_id = $1 AND accuracy_percentage IS NOT NULL';
    const accuracyResult = await db.query(accuracyQuery, [userId]);

    // Kanji learned count from study progress
    const kanjiQuery = 'SELECT COUNT(*) as learned FROM study_progress WHERE user_id = $1 AND kanji_id IS NOT NULL AND is_learned = true';
    const kanjiResult = await db.query(kanjiQuery, [userId]);

    // Vocabulary learned count from study progress
    const vocabQuery = 'SELECT COUNT(*) as learned FROM study_progress WHERE user_id = $1 AND vocabulary_id IS NOT NULL AND is_learned = true';
    const vocabResult = await db.query(vocabQuery, [userId]);

    // Fallback: count user-owned records (for flows that do not write study_progress yet)
    const ownKanjiQuery = 'SELECT COUNT(*) as owned FROM kanji WHERE created_by_user_id = $1';
    const ownKanjiResult = await db.query(ownKanjiQuery, [userId]);

    const ownVocabQuery = 'SELECT COUNT(*) as owned FROM vocabulary WHERE created_by_user_id = $1';
    const ownVocabResult = await db.query(ownVocabQuery, [userId]);

    const kanjiLearned = Math.max(
      parseInt(kanjiResult.rows[0].learned, 10) || 0,
      parseInt(ownKanjiResult.rows[0].owned, 10) || 0
    );

    const vocabularyLearned = Math.max(
      parseInt(vocabResult.rows[0].learned, 10) || 0,
      parseInt(ownVocabResult.rows[0].owned, 10) || 0
    );

    res.json({
      total_study_minutes: parseInt(timeResult.rows[0].total_minutes),
      total_items_studied: parseInt(itemsResult.rows[0].total_items),
      average_accuracy: parseFloat(accuracyResult.rows[0].avg_accuracy) || 0,
      kanji_learned: kanjiLearned,
      vocabulary_learned: vocabularyLearned
    });
  } catch (err) {
    console.error('Error fetching study stats:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- API Endpoints cho Kanji ---


// Lấy tất cả Kanji
app.get('/api/kanji', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const authUser = getOptionalAuthUser(req);

    if (token && !authUser) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    let query = 'SELECT * FROM kanji WHERE created_by_user_id IS NULL ORDER BY id DESC';
    let params = [];

    if (authUser?.id) {
      query = 'SELECT * FROM kanji WHERE created_by_user_id IS NULL OR created_by_user_id = $1 ORDER BY id DESC';
      params = [authUser.id];
    }

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Lỗi khi lấy Kanji:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy Kanji.' });
  }
});

// Thêm Kanji mới
app.post('/api/kanji', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word } = req.body;
    if (!character) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }
    const query = `
      INSERT INTO kanji (character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word, userId];
    const result = await db.query(query, values);
    await logStudyActivity({
      userId,
      sessionType: 'kanji_manual_add',
      itemsStudied: 1,
      durationMinutes: 1
    });
    pushSseEventToUser(userId, 'kanji_changed', { scope: 'kanji', reason: 'created' });
    res.status(201).json({ ...result.rows[0], message: 'Kanji đã được thêm thành công.' });
  } catch (err) {
    console.error('Lỗi khi thêm Kanji:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi thêm Kanji.' });
  }
});

// Import Kanji from parsed rows (CSV/Excel)
app.post('/api/kanji/import', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    if (!rows.length) {
      return res.status(400).json({ message: 'Không có dữ liệu để import.' });
    }

    const normalizeRow = (row) => {
      const normalized = {};
      Object.keys(row || {}).forEach((key) => {
        normalized[String(key).trim().toLowerCase()] = row[key];
      });
      return normalized;
    };

    const requiredFields = ['character|kanji_char', 'meaning_vi|meaning'];
    let imported = 0;
    const failed = [];

    for (let index = 0; index < rows.length; index += 1) {
      try {
        const row = normalizeRow(rows[index]);
        const character = String(row.character ?? row.kanji_char ?? '').trim();
        const meaning_vi = String(row.meaning_vi ?? row.meaning ?? '').trim();
        const onyomi = String(row.onyomi ?? '').trim() || null;
        const kunyomi = String(row.kunyomi ?? '').trim() || null;
        const meaning_en = String(row.meaning_en ?? '').trim() || null;
        const strokesRaw = String(row.strokes ?? '').trim();
        const strokes = strokesRaw ? Number(strokesRaw) : null;
        const jlpt_level = String(row.jlpt_level ?? row.level ?? '').trim() || null;
        const example_word = String(row.example_word ?? row.han_tu ?? '').trim() || null;

        if (!character || !meaning_vi) {
          throw new Error('Thiếu trường bắt buộc: character/kanji_char hoặc meaning_vi/meaning');
        }

        if (strokes !== null && Number.isNaN(strokes)) {
          throw new Error('Trường strokes phải là số');
        }

        const query = `
          INSERT INTO kanji (character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word, created_by_user_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (character, created_by_user_id) DO UPDATE
          SET onyomi = EXCLUDED.onyomi,
              kunyomi = EXCLUDED.kunyomi,
              meaning_vi = EXCLUDED.meaning_vi,
              meaning_en = EXCLUDED.meaning_en,
              strokes = EXCLUDED.strokes,
              jlpt_level = EXCLUDED.jlpt_level,
              example_word = EXCLUDED.example_word
        `;

        await db.query(query, [character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word, userId]);
        imported += 1;
      } catch (error) {
        failed.push({ row: index + 2, error: error.message });
      }
    }

    if (imported > 0) {
      await logStudyActivity({
        userId,
        sessionType: 'kanji_import',
        itemsStudied: imported,
        durationMinutes: Math.max(1, Math.ceil(imported / 10))
      });
      pushSseEventToUser(userId, 'kanji_changed', { scope: 'kanji', reason: 'imported', imported });
    }

    res.json({
      message: `Import Kanji hoàn tất: ${imported}/${rows.length} dòng thành công.`,
      imported,
      total: rows.length,
      failed,
      requiredFields,
    });
  } catch (err) {
    console.error('Lỗi khi import Kanji:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi import Kanji.' });
  }
});

// Cập nhật Kanji
app.put('/api/kanji/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word } = req.body;
    if (!character) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }
    const checkQuery = 'SELECT * FROM kanji WHERE id = $1 AND created_by_user_id = $2';
    const checkResult = await db.query(checkQuery, [id, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Kanji không tồn tại hoặc bạn không có quyền chỉnh sửa.' });
    }
    const updateQuery = `UPDATE kanji SET character = $1, onyomi = $2, kunyomi = $3, meaning_vi = $4, meaning_en = $5, strokes = $6, jlpt_level = $7, example_word = $8 WHERE id = $9 RETURNING *`;
    const values = [character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word, id];
    const result = await db.query(updateQuery, values);
    await logStudyActivity({
      userId,
      sessionType: 'kanji_review',
      itemsStudied: 1,
      durationMinutes: 1
    });
    pushSseEventToUser(userId, 'kanji_changed', { scope: 'kanji', reason: 'updated', id: Number(id) });
    res.status(200).json({ ...result.rows[0], message: 'Kanji đã được cập nhật thành công.' });
  } catch (err) {
    console.error('Lỗi khi cập nhật Kanji:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật Kanji.', error: err.message });
  }
});

// Xóa Kanji
app.delete('/api/kanji/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const checkQuery = 'SELECT * FROM kanji WHERE id = $1 AND created_by_user_id = $2';
    const checkResult = await db.query(checkQuery, [id, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Kanji không tồn tại hoặc bạn không có quyền xóa.' });
    }
    const deleteQuery = 'DELETE FROM kanji WHERE id = $1';
    const result = await db.query(deleteQuery, [id]);
    pushSseEventToUser(userId, 'kanji_changed', { scope: 'kanji', reason: 'deleted', id: Number(id) });
    res.status(200).json({ message: 'Kanji đã được xóa thành công.', deletedId: parseInt(id), affectedRows: result.rowCount, success: true });
  } catch (err) {
    console.error('Lỗi khi xóa Kanji:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa Kanji.', error: err.message });
  }
});

// --- API Endpoints cho Từ Vựng (goi) ---

// Lấy tất cả từ vựng
app.get('/api/vocabulary', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const authUser = getOptionalAuthUser(req);

    if (token && !authUser) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    let query = 'SELECT * FROM vocabulary WHERE created_by_user_id IS NULL ORDER BY id DESC';
    let params = [];

    if (authUser?.id) {
      query = 'SELECT * FROM vocabulary WHERE created_by_user_id IS NULL OR created_by_user_id = $1 ORDER BY id DESC';
      params = [authUser.id];
    }

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Lỗi khi lấy từ vựng:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy từ vựng.' });
  }
});

// Thêm từ vựng mới
app.post('/api/vocabulary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level } = req.body;
    if (!word_jp || !meaning_vi) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }
    const query = `
      INSERT INTO vocabulary (word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level, userId];
    const result = await db.query(query, values);
    const vocab = result.rows[0];
    await logStudyActivity({
      userId,
      sessionType: 'vocabulary_manual_add',
      itemsStudied: 1,
      durationMinutes: 1
    });

    pushSseEventToUser(userId, 'vocabulary_changed', { scope: 'vocabulary', reason: 'created' });

    res.status(201).json({ ...vocab, message: 'Từ vựng đã được thêm thành công.' });
  } catch (err) {
    console.error('Lỗi khi thêm từ vựng:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi thêm từ vựng.' });
  }
});

// Import Vocabulary from parsed rows (CSV/Excel)
app.post('/api/vocabulary/import', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    if (!rows.length) {
      return res.status(400).json({ message: 'Không có dữ liệu để import.' });
    }

    const normalizeRow = (row) => {
      const normalized = {};
      Object.keys(row || {}).forEach((key) => {
        normalized[String(key).trim().toLowerCase()] = row[key];
      });
      return normalized;
    };

    const requiredFields = ['word_jp|word', 'meaning_vi|meaning'];
    let imported = 0;
    const failed = [];

    for (let index = 0; index < rows.length; index += 1) {
      try {
        const row = normalizeRow(rows[index]);
        const word_jp = String(row.word_jp ?? row.word ?? '').trim();
        const word_kana = String(row.word_kana ?? row.furigana ?? '').trim() || null;
        const word_romaji = String(row.word_romaji ?? row.romaji ?? '').trim() || null;
        const meaning_vi = String(row.meaning_vi ?? row.meaning ?? '').trim();
        const meaning_en = String(row.meaning_en ?? '').trim() || null;
        const part_of_speech = String(row.part_of_speech ?? '').trim() || null;
        const jlpt_level = String(row.jlpt_level ?? row.level ?? '').trim() || null;

        if (!word_jp || !meaning_vi) {
          throw new Error('Thiếu trường bắt buộc: word_jp/word hoặc meaning_vi/meaning');
        }

        const query = `
          INSERT INTO vocabulary (word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level, created_by_user_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        await db.query(query, [word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level, userId]);
        imported += 1;
      } catch (error) {
        failed.push({ row: index + 2, error: error.message });
      }
    }

    if (imported > 0) {
      await logStudyActivity({
        userId,
        sessionType: 'vocabulary_import',
        itemsStudied: imported,
        durationMinutes: Math.max(1, Math.ceil(imported / 10))
      });
      pushSseEventToUser(userId, 'vocabulary_changed', { scope: 'vocabulary', reason: 'imported', imported });
    }

    res.json({
      message: `Import Vocabulary hoàn tất: ${imported}/${rows.length} dòng thành công.`,
      imported,
      total: rows.length,
      failed,
      requiredFields,
    });
  } catch (err) {
    console.error('Lỗi khi import Vocabulary:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi import Vocabulary.' });
  }
});

// Cập nhật từ vựng
app.put('/api/vocabulary/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level } = req.body;
    if (!word_jp || !meaning_vi) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }
    const checkQuery = 'SELECT * FROM vocabulary WHERE id = $1 AND created_by_user_id = $2';
    const checkResult = await db.query(checkQuery, [id, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Từ vựng không tồn tại hoặc bạn không có quyền chỉnh sửa.' });
    }
    const updateQuery = `UPDATE vocabulary SET word_jp = $1, word_kana = $2, word_romaji = $3, meaning_vi = $4, meaning_en = $5, part_of_speech = $6, jlpt_level = $7 WHERE id = $8 RETURNING *`;
    const values = [word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level, id];
    const result = await db.query(updateQuery, values);
    await logStudyActivity({
      userId,
      sessionType: 'vocabulary_review',
      itemsStudied: 1,
      durationMinutes: 1
    });
    pushSseEventToUser(userId, 'vocabulary_changed', { scope: 'vocabulary', reason: 'updated', id: Number(id) });
    res.status(200).json({ ...result.rows[0], message: 'Từ vựng đã được cập nhật thành công.' });
  } catch (err) {
    console.error('Lỗi khi cập nhật từ vựng:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật từ vựng.', error: err.message });
  }
});

// Xóa từ vựng
app.delete('/api/vocabulary/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const checkQuery = 'SELECT * FROM vocabulary WHERE id = $1 AND created_by_user_id = $2';
    const checkResult = await db.query(checkQuery, [id, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Từ vựng không tồn tại hoặc bạn không có quyền xóa.' });
    }
    const deleteQuery = 'DELETE FROM vocabulary WHERE id = $1';
    const result = await db.query(deleteQuery, [id]);
    pushSseEventToUser(userId, 'vocabulary_changed', { scope: 'vocabulary', reason: 'deleted', id: Number(id) });
    res.status(200).json({ message: 'Từ vựng đã được xóa thành công.', deletedId: parseInt(id), affectedRows: result.rowCount, success: true });
  } catch (err) {
    console.error('Lỗi khi xóa từ vựng:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi xóa từ vựng.', error: err.message });
  }
});

const normalizeTab = (tab = '') => {
  const value = String(tab || '').toLowerCase().trim();
  if (['home', 'kanji', 'vocabulary', 'grammar', 'games', 'kaiwa'].includes(value)) {
    return value;
  }
  return null;
};

const normalizeJlptLevel = (value = '') => {
  const text = String(value || '').toUpperCase().replace(/\s+/g, '');
  const matched = text.match(/N?([1-5])/);
  if (!matched) return null;
  return `N${matched[1]}`;
};

const clampBatchCount = (value, fallback = 10) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(50, Math.round(parsed)));
};


const addKanjiBatchForUser = async ({ userId, level = 'N5', count = 10 }) => {
  const safeLevel = normalizeJlptLevel(level) || 'N5';
  const safeCount = clampBatchCount(count, 10);
  const levelDigit = safeLevel.replace('N', '');

  const fromBaseTable = await db.query(
    `WITH candidates AS (
       SELECT k.character, k.onyomi, k.kunyomi, k.meaning_vi, k.meaning_en, k.strokes, k.jlpt_level, k.example_word
       FROM kanji k
       WHERE regexp_replace(UPPER(COALESCE(k.jlpt_level, '')), '[^1-5]', '', 'g') = $1
         AND COALESCE(k.character, '') <> ''
         AND NOT EXISTS (
           SELECT 1
           FROM kanji mine
           WHERE mine.character = k.character
             AND mine.created_by_user_id = $2
         )
       ORDER BY CASE WHEN k.created_by_user_id IS NULL THEN 0 ELSE 1 END, k.id ASC
       LIMIT $3
     )
     INSERT INTO kanji (
       character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word, created_by_user_id
     )
     SELECT
       c.character, c.onyomi, c.kunyomi, c.meaning_vi, c.meaning_en, c.strokes, $4, c.example_word, $2
     FROM candidates c
     ON CONFLICT (character, created_by_user_id) DO NOTHING
     RETURNING id, character`,
    [levelDigit, userId, safeCount, safeLevel]
  );

  let insertedRows = [...fromBaseTable.rows];
  const remaining = Math.max(0, safeCount - insertedRows.length);

  if (remaining > 0) {
    try {
      const numericLevel = Number(safeLevel.replace('N', ''));
      const fromKanjiChars = await db.query(
        `WITH candidates AS (
           SELECT kc.character, kc.on_reading, kc.kun_reading, kc.meaning_vi, kc.stroke_count
           FROM kanji_chars kc
           WHERE kc.jlpt_level = $4
             AND COALESCE(kc.character, '') <> ''
             AND NOT EXISTS (
               SELECT 1
               FROM kanji mine
               WHERE mine.character = kc.character
                 AND mine.created_by_user_id = $2
             )
           ORDER BY kc.id ASC
           LIMIT $3
         )
         INSERT INTO kanji (
           character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word, created_by_user_id
         )
         SELECT
           c.character, c.on_reading, c.kun_reading, c.meaning_vi, NULL, c.stroke_count, $1, NULL, $2
         FROM candidates c
         ON CONFLICT (character, created_by_user_id) DO NOTHING
         RETURNING id, character`,
        [safeLevel, userId, remaining, numericLevel]
      );

      insertedRows = insertedRows.concat(fromKanjiChars.rows);
    } catch (fallbackError) {
      console.error('Assistant kanji_chars fallback skipped:', fallbackError.message);
    }
  }

  const remainingAfterChars = Math.max(0, safeCount - insertedRows.length);
  if (remainingAfterChars > 0) {
    try {
      const numericLevel = Number(levelDigit);
      const fromWords = await db.query(
        `WITH candidates AS (
           SELECT DISTINCT chars.character,
                  MAX(m.meaning_vi) FILTER (WHERE m.meaning_vi IS NOT NULL) AS meaning_vi
           FROM words w
           JOIN LATERAL regexp_split_to_table(COALESCE(w.kanji, ''), '') AS chars(character) ON true
           LEFT JOIN meanings m ON m.word_id = w.id
           WHERE w.jlpt_level = $1
             AND chars.character ~ '^[一-龯々〆ヵヶ]$'
             AND NOT EXISTS (
               SELECT 1 FROM kanji mine
               WHERE mine.character = chars.character
                 AND mine.created_by_user_id = $2
             )
           GROUP BY chars.character
           ORDER BY chars.character
           LIMIT $3
         )
         INSERT INTO kanji (
           character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word, created_by_user_id
         )
         SELECT
           c.character, NULL, NULL, c.meaning_vi, NULL, NULL, $4, NULL, $2
         FROM candidates c
         ON CONFLICT (character, created_by_user_id) DO NOTHING
         RETURNING id, character`,
        [numericLevel, userId, remainingAfterChars, safeLevel]
      );

      insertedRows = insertedRows.concat(fromWords.rows);
    } catch (wordFallbackError) {
      console.error('Assistant words fallback skipped:', wordFallbackError.message);
    }
  }

  let llmGenerated = 0;
  const remainingAfterDbSources = Math.max(0, safeCount - insertedRows.length);
  if (remainingAfterDbSources > 0) {
    try {
      const generatedItems = await generateKanjiByLlm({
        level: safeLevel,
        count: remainingAfterDbSources,
        excludeCharacters: insertedRows.map((row) => row.character)
      });

      for (const item of generatedItems) {
        const insertResult = await db.query(
          `INSERT INTO kanji (
             character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word, created_by_user_id
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (character, created_by_user_id) DO NOTHING
           RETURNING id, character`,
          [
            item.character,
            item.onyomi || null,
            item.kunyomi || null,
            item.meaning_vi,
            item.meaning_en || null,
            item.strokes || null,
            safeLevel,
            item.example_word || null,
            userId
          ]
        );

        if (insertResult.rows[0]) {
          insertedRows.push(insertResult.rows[0]);
          llmGenerated += 1;
        }
      }
    } catch (llmGenerateError) {
      console.error('Assistant kanji LLM fallback skipped:', llmGenerateError.message);
    }
  }

  if (insertedRows.length > 0) {
    await logStudyActivity({
      userId,
      sessionType: 'kanji_assistant_add',
      itemsStudied: insertedRows.length,
      durationMinutes: Math.max(1, Math.ceil(insertedRows.length / 10))
    });

    pushSseEventToUser(userId, 'kanji_changed', {
      scope: 'kanji',
      reason: 'assistant_batch_add',
      imported: insertedRows.length,
      level: safeLevel
    });
  }

  return {
    level: safeLevel,
    requested: safeCount,
    inserted: insertedRows.length,
    llmGenerated,
    characters: insertedRows.map((row) => row.character).slice(0, 12)
  };
};

const addVocabularyBatchForUser = async ({ userId, level = 'N5', count = 10 }) => {
  const safeLevel = normalizeJlptLevel(level) || 'N5';
  const safeCount = clampBatchCount(count, 10);
  const levelDigit = safeLevel.replace('N', '');

  const insertedResult = await db.query(
    `WITH candidates AS (
       SELECT v.word_jp, v.word_kana, v.word_romaji, v.meaning_vi, v.meaning_en, v.part_of_speech, v.jlpt_level
       FROM vocabulary v
       WHERE regexp_replace(UPPER(COALESCE(v.jlpt_level, '')), '[^1-5]', '', 'g') = $1
         AND COALESCE(v.word_jp, '') <> ''
         AND COALESCE(v.meaning_vi, '') <> ''
         AND NOT EXISTS (
           SELECT 1
           FROM vocabulary mine
           WHERE mine.word_jp = v.word_jp
             AND mine.created_by_user_id = $2
         )
       ORDER BY CASE WHEN v.created_by_user_id IS NULL THEN 0 ELSE 1 END, v.id ASC
       LIMIT $3
     )
     INSERT INTO vocabulary (
       word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level, created_by_user_id
     )
     SELECT
       c.word_jp, c.word_kana, c.word_romaji, c.meaning_vi, c.meaning_en, c.part_of_speech, $4, $2
     FROM candidates c
     RETURNING id, word_jp`,
    [levelDigit, userId, safeCount, safeLevel]
  );

  let insertedRows = insertedResult.rows || [];

  const remaining = Math.max(0, safeCount - insertedRows.length);
  if (remaining > 0) {
    try {
      const numericLevel = Number(levelDigit);
      const fallbackWords = await db.query(
        `WITH candidates AS (
           SELECT
             COALESCE(NULLIF(TRIM(w.kanji), ''), w.kana) AS word_jp,
             w.kana AS word_kana,
             w.romaji AS word_romaji,
             MAX(m.meaning_vi) FILTER (WHERE m.meaning_vi IS NOT NULL) AS meaning_vi
           FROM words w
           LEFT JOIN meanings m ON m.word_id = w.id
           WHERE w.jlpt_level = $1
             AND COALESCE(NULLIF(TRIM(COALESCE(w.kanji, w.kana)), ''), '') <> ''
             AND NOT EXISTS (
               SELECT 1
               FROM vocabulary mine
               WHERE mine.word_jp = COALESCE(NULLIF(TRIM(w.kanji), ''), w.kana)
                 AND mine.created_by_user_id = $2
             )
           GROUP BY COALESCE(NULLIF(TRIM(w.kanji), ''), w.kana), w.kana, w.romaji
           ORDER BY COALESCE(NULLIF(TRIM(w.kanji), ''), w.kana)
           LIMIT $3
         )
         INSERT INTO vocabulary (
           word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level, created_by_user_id
         )
         SELECT
           c.word_jp, c.word_kana, c.word_romaji, COALESCE(c.meaning_vi, 'Chưa có nghĩa'), NULL, NULL, $4, $2
         FROM candidates c
         RETURNING id, word_jp`,
        [numericLevel, userId, remaining, safeLevel]
      );

      insertedRows = insertedRows.concat(fallbackWords.rows || []);
    } catch (vocabFallbackError) {
      console.error('Assistant vocabulary words fallback skipped:', vocabFallbackError.message);
    }
  }

  let llmGenerated = 0;
  const remainingAfterDbSources = Math.max(0, safeCount - insertedRows.length);
  if (remainingAfterDbSources > 0) {
    try {
      const generatedItems = await generateVocabularyByLlm({
        level: safeLevel,
        count: remainingAfterDbSources,
        excludeWords: insertedRows.map((row) => row.word_jp)
      });

      for (const item of generatedItems) {
        const insertResult = await db.query(
          `INSERT INTO vocabulary (
             word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level, created_by_user_id
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, word_jp`,
          [
            item.word_jp,
            item.word_kana || null,
            item.word_romaji || null,
            item.meaning_vi,
            item.meaning_en || null,
            item.part_of_speech || null,
            safeLevel,
            userId
          ]
        );

        if (insertResult.rows[0]) {
          insertedRows.push(insertResult.rows[0]);
          llmGenerated += 1;
        }
      }
    } catch (llmGenerateError) {
      console.error('Assistant vocabulary LLM fallback skipped:', llmGenerateError.message);
    }
  }

  if (insertedRows.length > 0) {
    await logStudyActivity({
      userId,
      sessionType: 'vocabulary_assistant_add',
      itemsStudied: insertedRows.length,
      durationMinutes: Math.max(1, Math.ceil(insertedRows.length / 10))
    });

    pushSseEventToUser(userId, 'vocabulary_changed', {
      scope: 'vocabulary',
      reason: 'assistant_batch_add',
      imported: insertedRows.length,
      level: safeLevel
    });
  }

  return {
    level: safeLevel,
    requested: safeCount,
    inserted: insertedRows.length,
    llmGenerated,
    words: insertedRows.map((row) => row.word_jp).slice(0, 12)
  };
};

const parseJsonFromLlmText = (rawText = '') => {
  const text = typeof rawText === 'string' ? rawText : JSON.stringify(rawText || '');
  const parsed = extractJsonObject(text);
  if (parsed && typeof parsed === 'object') return parsed;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
};

const callLlmForStructuredJson = async ({ instruction, maxTokens = 900, temperature = 0.3 }) => {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const openRouterSiteUrl = process.env.OPENROUTER_SITE_URL || FRONTEND_URL;
  const openRouterAppName = process.env.OPENROUTER_APP_NAME || 'AyaLearning';

  if (openRouterApiKey) {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': openRouterSiteUrl,
          'X-Title': openRouterAppName
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: 'Return strict JSON only.' },
            { role: 'user', content: instruction }
          ],
          temperature,
          max_tokens: maxTokens
        })
      });

      if (response.ok) {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        const parsed = parseJsonFromLlmText(content || '');
        if (parsed) return parsed;
      }
    } catch (error) {
      console.error('Structured JSON OpenRouter fallback failed:', error.message);
    }
  }

  if (geminiApiKey) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: {
            temperature,
            topK: 1,
            topP: 0.95,
            maxOutputTokens: maxTokens
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini structured generation failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = parseJsonFromLlmText(rawText);
    if (!parsed) {
      throw new Error('Gemini did not return valid JSON payload');
    }
    return parsed;
  }

  throw new Error('No LLM API key for structured generation');
};

const generateKanjiByLlm = async ({ level = 'N5', count = 1, excludeCharacters = [] }) => {
  const safeLevel = normalizeJlptLevel(level) || 'N5';
  const safeCount = clampBatchCount(count, 1);
  const excluded = new Set((excludeCharacters || []).map((item) => String(item || '').trim()).filter(Boolean));

  const instruction = `
Generate Japanese kanji study entries for JLPT ${safeLevel}.
Need exactly ${safeCount} items.
Return strict JSON only with shape:
{
  "items": [
    {
      "character": "single kanji char",
      "onyomi": "...",
      "kunyomi": "...",
      "meaning_vi": "Vietnamese meaning",
      "meaning_en": "English meaning",
      "strokes": 10,
      "example_word": "example"
    }
  ]
}
Avoid characters in this list: ${JSON.stringify(Array.from(excluded).slice(0, 50))}
No duplicates. Keep meanings concise and learner friendly.
`;

  const parsed = await callLlmForStructuredJson({ instruction, maxTokens: 1200, temperature: 0.35 });
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  const accepted = [];

  for (const item of rawItems) {
    const character = String(item?.character || '').trim();
    if (!/^[一-龯々〆ヵヶ]$/.test(character)) continue;
    if (excluded.has(character)) continue;

    const meaningVi = String(item?.meaning_vi || '').trim();
    if (!meaningVi) continue;

    excluded.add(character);
    accepted.push({
      character,
      onyomi: String(item?.onyomi || '').trim(),
      kunyomi: String(item?.kunyomi || '').trim(),
      meaning_vi: meaningVi,
      meaning_en: String(item?.meaning_en || '').trim(),
      strokes: Number.isFinite(Number(item?.strokes)) ? Number(item.strokes) : null,
      example_word: String(item?.example_word || '').trim()
    });

    if (accepted.length >= safeCount) break;
  }

  return accepted;
};

const generateVocabularyByLlm = async ({ level = 'N5', count = 1, excludeWords = [] }) => {
  const safeLevel = normalizeJlptLevel(level) || 'N5';
  const safeCount = clampBatchCount(count, 1);
  const excluded = new Set((excludeWords || []).map((item) => String(item || '').trim()).filter(Boolean));

  const instruction = `
Generate Japanese vocabulary entries for JLPT ${safeLevel}.
Need exactly ${safeCount} items.
Return strict JSON only with shape:
{
  "items": [
    {
      "word_jp": "日本語",
      "word_kana": "にほんご",
      "word_romaji": "nihongo",
      "meaning_vi": "nghĩa tiếng Việt",
      "meaning_en": "english meaning",
      "part_of_speech": "noun|verb|adjective|adverb|expression|particle|other"
    }
  ]
}
Avoid words in this list: ${JSON.stringify(Array.from(excluded).slice(0, 60))}
No duplicates. Keep meanings concise.
`;

  const parsed = await callLlmForStructuredJson({ instruction, maxTokens: 1300, temperature: 0.35 });
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  const accepted = [];

  for (const item of rawItems) {
    const wordJp = String(item?.word_jp || '').trim();
    const meaningVi = String(item?.meaning_vi || '').trim();
    if (!wordJp || !meaningVi) continue;
    if (excluded.has(wordJp)) continue;

    excluded.add(wordJp);
    accepted.push({
      word_jp: wordJp,
      word_kana: String(item?.word_kana || '').trim(),
      word_romaji: String(item?.word_romaji || '').trim(),
      meaning_vi: meaningVi,
      meaning_en: String(item?.meaning_en || '').trim(),
      part_of_speech: String(item?.part_of_speech || '').trim() || 'other'
    });

    if (accepted.length >= safeCount) break;
  }

  return accepted;
};

const getKanjiListForUser = async ({ userId, limit = 30, level = null, query = '' }) => {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const filters = ['created_by_user_id = $1'];
  const params = [userId];

  const normalizedLevel = level ? (normalizeJlptLevel(level) || String(level).toUpperCase()) : null;
  if (normalizedLevel) {
    params.push(normalizedLevel);
    filters.push(`regexp_replace(UPPER(COALESCE(jlpt_level, '')), '[^1-5]', '', 'g') = regexp_replace(UPPER($${params.length}), '[^1-5]', '', 'g')`);
  }

  const safeQuery = String(query || '').trim();
  if (safeQuery) {
    params.push(`%${safeQuery}%`);
    filters.push(`(character ILIKE $${params.length} OR meaning_vi ILIKE $${params.length} OR meaning_en ILIKE $${params.length})`);
  }

  params.push(safeLimit);

  const result = await db.query(
    `SELECT id, character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word
     FROM kanji
     WHERE ${filters.join(' AND ')}
     ORDER BY id DESC
     LIMIT $${params.length}`,
    params
  );

  return {
    count: result.rows.length,
    items: result.rows
  };
};

const deleteKanjiForUser = async ({ userId, id = null, character = '' }) => {
  if (!id && !character) {
    return { deleted: 0, reason: 'missing_identifier' };
  }

  let result;
  if (id) {
    result = await db.query(
      `DELETE FROM kanji
       WHERE id = $1 AND created_by_user_id = $2
       RETURNING id, character`,
      [Number(id), userId]
    );
  } else {
    result = await db.query(
      `DELETE FROM kanji
       WHERE character = $1 AND created_by_user_id = $2
       RETURNING id, character`,
      [String(character).trim(), userId]
    );
  }

  if (result.rows.length > 0) {
    pushSseEventToUser(userId, 'kanji_changed', { scope: 'kanji', reason: 'assistant_deleted', count: result.rows.length });
  }

  return {
    deleted: result.rows.length,
    items: result.rows
  };
};

const getVocabularyListForUser = async ({ userId, limit = 30, level = null, query = '' }) => {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const filters = ['created_by_user_id = $1'];
  const params = [userId];

  const normalizedLevel = level ? (normalizeJlptLevel(level) || String(level).toUpperCase()) : null;
  if (normalizedLevel) {
    params.push(normalizedLevel);
    filters.push(`regexp_replace(UPPER(COALESCE(jlpt_level, '')), '[^1-5]', '', 'g') = regexp_replace(UPPER($${params.length}), '[^1-5]', '', 'g')`);
  }

  const safeQuery = String(query || '').trim();
  if (safeQuery) {
    params.push(`%${safeQuery}%`);
    filters.push(`(word_jp ILIKE $${params.length} OR word_kana ILIKE $${params.length} OR meaning_vi ILIKE $${params.length} OR meaning_en ILIKE $${params.length})`);
  }

  params.push(safeLimit);

  const result = await db.query(
    `SELECT id, word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level
     FROM vocabulary
     WHERE ${filters.join(' AND ')}
     ORDER BY id DESC
     LIMIT $${params.length}`,
    params
  );

  return {
    count: result.rows.length,
    items: result.rows
  };
};

const deleteVocabularyForUser = async ({ userId, id = null, word = '' }) => {
  if (!id && !word) {
    return { deleted: 0, reason: 'missing_identifier' };
  }

  let result;
  if (id) {
    result = await db.query(
      `DELETE FROM vocabulary
       WHERE id = $1 AND created_by_user_id = $2
       RETURNING id, word_jp`,
      [Number(id), userId]
    );
  } else {
    result = await db.query(
      `DELETE FROM vocabulary
       WHERE word_jp = $1 AND created_by_user_id = $2
       RETURNING id, word_jp`,
      [String(word).trim(), userId]
    );
  }

  if (result.rows.length > 0) {
    pushSseEventToUser(userId, 'vocabulary_changed', { scope: 'vocabulary', reason: 'assistant_deleted', count: result.rows.length });
  }

  return {
    deleted: result.rows.length,
    items: result.rows
  };
};

const getCalendarEventsForUser = async ({ userId, fromTime, toTime, maxResults = 20 }) => {
  const oauthClient = await getCalendarClientForUser(userId);
  const calendar = google.calendar({ version: 'v3', auth: oauthClient });
  const timeMin = fromTime ? new Date(fromTime).toISOString() : new Date().toISOString();
  const timeMax = toTime
    ? new Date(toTime).toISOString()
    : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: Math.max(1, Math.min(100, Number(maxResults) || 20))
  });

  const items = (response.data.items || []).map((item) => ({
    id: item.id,
    summary: item.summary,
    htmlLink: item.htmlLink,
    start: item.start,
    end: item.end
  }));

  return {
    count: items.length,
    items,
    fromTime: timeMin,
    toTime: timeMax
  };
};

const findFreeTimeSlotsForUser = async ({ userId, fromTime, toTime, durationMinutes = 60, timeZone = 'Asia/Ho_Chi_Minh' }) => {
  const oauthClient = await getCalendarClientForUser(userId);
  const calendar = google.calendar({ version: 'v3', auth: oauthClient });

  const timeMin = fromTime ? new Date(fromTime) : new Date();
  const timeMax = toTime ? new Date(toTime) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const safeDuration = Math.max(15, Math.min(240, Number(durationMinutes) || 60));

  const freeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone,
      items: [{ id: 'primary' }]
    }
  });

  const busy = (freeBusy.data.calendars?.primary?.busy || [])
    .map((item) => ({ start: new Date(item.start), end: new Date(item.end) }))
    .sort((a, b) => a.start - b.start);

  const slots = [];
  let cursor = new Date(timeMin);
  for (const block of busy) {
    if (block.start > cursor) {
      const gapMinutes = (block.start.getTime() - cursor.getTime()) / 60000;
      if (gapMinutes >= safeDuration) {
        slots.push({ start: cursor.toISOString(), end: block.start.toISOString() });
      }
    }
    if (block.end > cursor) {
      cursor = new Date(block.end);
    }
  }

  if (cursor < timeMax) {
    const gapMinutes = (timeMax.getTime() - cursor.getTime()) / 60000;
    if (gapMinutes >= safeDuration) {
      slots.push({ start: cursor.toISOString(), end: timeMax.toISOString() });
    }
  }

  return {
    count: slots.length,
    durationMinutes: safeDuration,
    slots: slots.slice(0, 20),
    fromTime: timeMin.toISOString(),
    toTime: timeMax.toISOString()
  };
};

const getUserProgressSnapshot = async (userId) => {
  const [statsResult, learnedKanjiResult, learnedVocabResult] = await Promise.all([
    db.query(
      `SELECT
         COALESCE(SUM(duration_minutes), 0) AS total_minutes,
         COALESCE(SUM(items_studied), 0) AS total_items,
         COALESCE(AVG(accuracy_percentage), 0) AS avg_accuracy
       FROM study_sessions
       WHERE user_id = $1`,
      [userId]
    ),
    db.query('SELECT COUNT(*) AS total FROM kanji WHERE created_by_user_id = $1', [userId]),
    db.query('SELECT COUNT(*) AS total FROM vocabulary WHERE created_by_user_id = $1', [userId])
  ]);

  return {
    totalStudyMinutes: Number(statsResult.rows[0]?.total_minutes || 0),
    totalItemsStudied: Number(statsResult.rows[0]?.total_items || 0),
    avgAccuracy: Number(statsResult.rows[0]?.avg_accuracy || 0),
    myKanjiCount: Number(learnedKanjiResult.rows[0]?.total || 0),
    myVocabularyCount: Number(learnedVocabResult.rows[0]?.total || 0)
  };
};

const searchContentForUser = async ({ userId, query = '', limit = 10 }) => {
  const keyword = String(query || '').trim();
  if (!keyword) {
    return { kanji: [], vocabulary: [] };
  }

  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
  const likeQuery = `%${keyword}%`;

  const [kanjiResult, vocabResult] = await Promise.all([
    db.query(
      `SELECT id, character, meaning_vi, jlpt_level
       FROM kanji
       WHERE (created_by_user_id = $1 OR created_by_user_id IS NULL)
         AND (character ILIKE $2 OR meaning_vi ILIKE $2 OR meaning_en ILIKE $2)
       ORDER BY id DESC
       LIMIT $3`,
      [userId, likeQuery, safeLimit]
    ),
    db.query(
      `SELECT id, word_jp, word_kana, meaning_vi, jlpt_level
       FROM vocabulary
       WHERE (created_by_user_id = $1 OR created_by_user_id IS NULL)
         AND (word_jp ILIKE $2 OR word_kana ILIKE $2 OR meaning_vi ILIKE $2 OR meaning_en ILIKE $2)
       ORDER BY id DESC
       LIMIT $3`,
      [userId, likeQuery, safeLimit]
    )
  ]);

  return {
    kanji: kanjiResult.rows,
    vocabulary: vocabResult.rows
  };
};

const sanitizeExecutionStep = (step, timezone = 'Asia/Ho_Chi_Minh') => {
  if (!step || typeof step !== 'object') return null;
  const type = String(step.type || '').trim();
  const label = String(step.label || '').trim() || 'Step';
  const payload = step.payload && typeof step.payload === 'object' ? step.payload : {};

  if (type === 'add_kanji_batch') {
    return {
      type,
      label,
      payload: {
        level: normalizeJlptLevel(payload.level || 'N5') || 'N5',
        count: clampBatchCount(payload.count, 10)
      }
    };
  }

  if (type === 'add_vocabulary_batch') {
    return {
      type,
      label,
      payload: {
        level: normalizeJlptLevel(payload.level || 'N5') || 'N5',
        count: clampBatchCount(payload.count, 10)
      }
    };
  }

  if (type === 'get_kanji_list') {
    return {
      type,
      label,
      payload: {
        level: payload.level ? (normalizeJlptLevel(payload.level) || String(payload.level).toUpperCase()) : null,
        limit: Math.max(1, Math.min(100, Number(payload.limit) || 30)),
        query: String(payload.query || '').trim()
      }
    };
  }

  if (type === 'delete_kanji') {
    const normalizedId = Number(payload.id);
    const id = Number.isFinite(normalizedId) ? normalizedId : null;
    const character = String(payload.character || '').trim();
    if (!id && !character) return null;
    return {
      type,
      label,
      payload: { id, character }
    };
  }

  if (type === 'get_vocabulary_list') {
    return {
      type,
      label,
      payload: {
        level: payload.level ? (normalizeJlptLevel(payload.level) || String(payload.level).toUpperCase()) : null,
        limit: Math.max(1, Math.min(100, Number(payload.limit) || 30)),
        query: String(payload.query || '').trim()
      }
    };
  }

  if (type === 'delete_vocabulary') {
    const normalizedId = Number(payload.id);
    const id = Number.isFinite(normalizedId) ? normalizedId : null;
    const word = String(payload.word || payload.word_jp || '').trim();
    if (!id && !word) return null;
    return {
      type,
      label,
      payload: { id, word }
    };
  }

  if (type === 'navigate') {
    const tab = normalizeTab(payload.tab);
    if (!tab) return null;
    return {
      type,
      label,
      payload: {
        tab,
        level: payload.level ? (normalizeJlptLevel(payload.level) || String(payload.level).toUpperCase()) : undefined,
        startQuiz: Boolean(payload.startQuiz),
        quizType: payload.quizType ? String(payload.quizType) : undefined,
        quizCount: Number.isFinite(Number(payload.quizCount)) ? Number(payload.quizCount) : undefined
      }
    };
  }

  if (type === 'create_calendar_event') {
    const scheduleDraft = sanitizeScheduleDraft(payload, timezone);
    if (!scheduleDraft) return null;
    return {
      type,
      label,
      payload: scheduleDraft
    };
  }

  if (type === 'connect_calendar') {
    return {
      type,
      label,
      payload: {
        url: payload.url ? String(payload.url) : ''
      }
    };
  }

  if (type === 'get_calendar_events') {
    return {
      type,
      label,
      payload: {
        fromTime: payload.fromTime ? String(payload.fromTime) : null,
        toTime: payload.toTime ? String(payload.toTime) : null,
        maxResults: Math.max(1, Math.min(100, Number(payload.maxResults) || 20))
      }
    };
  }

  if (type === 'find_free_time_slots') {
    return {
      type,
      label,
      payload: {
        fromTime: payload.fromTime ? String(payload.fromTime) : null,
        toTime: payload.toTime ? String(payload.toTime) : null,
        durationMinutes: Math.max(15, Math.min(240, Number(payload.durationMinutes) || 60)),
        timeZone: String(payload.timeZone || timezone || 'Asia/Ho_Chi_Minh')
      }
    };
  }

  if (type === 'get_user_progress') {
    return { type, label, payload: {} };
  }

  if (type === 'search_content') {
    const query = String(payload.query || '').trim();
    if (!query) return null;
    return {
      type,
      label,
      payload: {
        query,
        limit: Math.max(1, Math.min(50, Number(payload.limit) || 10))
      }
    };
  }

  if (type === 'get_current_datetime') {
    return {
      type,
      label,
      payload: {
        timeZone: String(payload.timeZone || timezone || 'Asia/Ho_Chi_Minh')
      }
    };
  }

  if (type === 'get_current_page') {
    return {
      type,
      label,
      payload: {}
    };
  }

  return null;
};

const sanitizeExecutionPlan = (plan, timezone = 'Asia/Ho_Chi_Minh') => {
  if (!plan || typeof plan !== 'object') return null;
  const title = String(plan.title || plan.goal || '').trim();
  const steps = Array.isArray(plan.steps)
    ? plan.steps.map((step) => sanitizeExecutionStep(step, timezone)).filter(Boolean).slice(0, 6)
    : [];

  if (!title || steps.length === 0) return null;

  return {
    title,
    requiresConfirmation: true,
    steps
  };
};

const extractJsonObject = (text = '') => {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const maybeJson = text.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(maybeJson);
  } catch (_error) {
    return null;
  }
};

const sanitizeScheduleDraft = (draft, fallbackTimezone = 'Asia/Ho_Chi_Minh') => {
  if (!draft || typeof draft !== 'object') return null;
  const startTime = new Date(draft.startTime);
  const endTime = new Date(draft.endTime);

  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
    return null;
  }

  return {
    summary: String(draft.summary || 'AyaLearning Study Session').slice(0, 120),
    description: String(draft.description || 'Scheduled by AyaLearning Assistant').slice(0, 500),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    timeZone: String(draft.timeZone || fallbackTimezone),
    reminders: Array.isArray(draft.reminders)
      ? draft.reminders
          .map((minutes) => Number(minutes))
          .filter((minutes) => Number.isFinite(minutes) && minutes >= 0 && minutes <= 1440)
      : [30]
  };
};

const sanitizeAgentActions = (actions = []) => {
  if (!Array.isArray(actions)) return [];

  return actions
    .map((action) => {
      if (!action || typeof action !== 'object') return null;
      const type = String(action.type || '').trim();
      const label = String(action.label || '').trim();

      if (!type || !label) return null;

      if (type === 'prompt') {
        return {
          type,
          label,
          payload: String(action.payload || '').trim() || label
        };
      }

      if (type === 'navigate') {
        const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
        const tab = normalizeTab(payload.tab);
        if (!tab) return null;

        return {
          type,
          label,
          payload: {
            tab,
            level: payload.level ? String(payload.level).toUpperCase() : undefined,
            startQuiz: Boolean(payload.startQuiz),
            quizType: payload.quizType ? String(payload.quizType) : undefined,
            quizCount: Number.isFinite(Number(payload.quizCount)) ? Number(payload.quizCount) : undefined
          }
        };
      }

      if (type === 'connect_calendar' || type === 'suggest_schedule') {
        return {
          type,
          label,
          payload: action.payload
        };
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, 4);
};

const runAssistantAgent = async ({ message, timezone, conversationHistory = [], context = {} }) => {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const openRouterSiteUrl = process.env.OPENROUTER_SITE_URL || FRONTEND_URL;
  const openRouterAppName = process.env.OPENROUTER_APP_NAME || 'AyaLearning';

  if (!geminiApiKey && !openRouterApiKey) {
    return {
      reply: 'Mình chưa thể phản hồi bằng LLM vì backend chưa cấu hình API key (GEMINI_API_KEY hoặc OPENROUTER_API_KEY).',
      actions: [
        { type: 'prompt', label: 'Hôm nay nên học gì?', payload: 'Hôm nay nên học gì?' },
        { type: 'prompt', label: 'Mở Kanji N3', payload: 'Mở Kanji N3' }
      ],
      scheduleDraft: null,
      executionPlan: null
    };
  }

  const safeHistory = Array.isArray(conversationHistory)
    ? conversationHistory.slice(-8).map((item) => ({
        sender: item?.sender === 'user' ? 'user' : 'assistant',
        text: String(item?.text || '').slice(0, 300)
      }))
    : [];

  const now = new Date();
  const prompt = `
You are AyaLearning Assistant Agent.
User language: Vietnamese (can mix Japanese).
Your job: decide the best next action, not only chat.
You are an agent planner: reason internally, then output only the final JSON result.

Capabilities:
1) Suggest smart study plan for today.
2) Navigate user to app tab: home|kanji|vocabulary|grammar|games|kaiwa.
3) Create schedule draft for Google Calendar (must be draft only; user confirms later).
4) Build executable plan (needs user confirmation first) for supported tool steps.

Supported execution step types:
- add_kanji_batch => payload: {"level":"N3", "count":10}
- get_kanji_list => payload: {"level":"N3", "limit":20, "query":""}
- delete_kanji => payload: {"id":123} or {"character":"学"}
- add_vocabulary_batch => payload: {"level":"N4", "count":20}
- get_vocabulary_list => payload: {"level":"N4", "limit":20, "query":""}
- delete_vocabulary => payload: {"id":55} or {"word":"特別"}
- navigate => payload: {"tab":"kanji|vocabulary|home|grammar|games|kaiwa", "level":"N3"}
- create_calendar_event => payload same shape as scheduleDraft
- connect_calendar => payload: {"url":""}
- get_calendar_events => payload: {"fromTime":"ISO", "toTime":"ISO", "maxResults":20}
- find_free_time_slots => payload: {"fromTime":"ISO", "toTime":"ISO", "durationMinutes":60, "timeZone":"Asia/Ho_Chi_Minh"}
- get_user_progress => payload: {}
- search_content => payload: {"query":"...", "limit":10}
- get_current_datetime => payload: {"timeZone":"Asia/Ho_Chi_Minh"}
- get_current_page => payload: {}

Output STRICTLY as valid JSON with this shape:
{
  "reply": "string",
  "actions": [
    {
      "type": "prompt|navigate|suggest_schedule|connect_calendar",
      "label": "string",
      "payload": any
    }
  ],
  "scheduleDraft": {
    "summary": "string",
    "description": "string",
    "startTime": "ISO datetime",
    "endTime": "ISO datetime",
    "timeZone": "string",
    "reminders": [30]
  } | null,
  "executionPlan": {
    "title": "string",
    "requiresConfirmation": true,
    "steps": [
      {
        "type": "navigate|get_current_page|add_kanji_batch|get_kanji_list|delete_kanji|add_vocabulary_batch|get_vocabulary_list|delete_vocabulary|connect_calendar|create_calendar_event|get_calendar_events|find_free_time_slots|get_user_progress|search_content|get_current_datetime",
        "label": "string",
        "payload": {}
      }
    ]
  } | null
}

Rules:
- Keep reply concise, actionable.
- If user asks to open page/quiz => include navigate action.
- If user asks planning/schedule/calendar/reminder => set scheduleDraft or executionPlan (create_calendar_event).
- If request changes data (add/import/update/delete) => MUST return executionPlan, not direct execution text.
- For requests like "thêm 10 kanji N3", return executionPlan with step add_kanji_batch(level N3, count 10).
- For requests like "thêm 20 từ vựng N4", return executionPlan with step add_vocabulary_batch(level N4, count 20).
- For requests adding a specific word/kanji (e.g., "thêm từ đặc biệt"), use add_vocabulary_batch or add_kanji_batch with count=1 and no hard refusal.
- Keep steps minimal and deterministic; do not invent unsupported tools.
- If scheduleDraft is returned, use timezone ${timezone} and realistic times after now.
- If calendar not connected: still create draft, and include connect_calendar action.
- Never include markdown code fences.

Context:
- currentTime: ${now.toISOString()}
- timezone: ${timezone}
- calendarConnected: ${context.calendarConnected ? 'true' : 'false'}
- todayTotalMinutes: ${context.todayTotalMinutes || 0}
- todayTotalItems: ${context.todayTotalItems || 0}
- todayAvgAccuracy: ${context.todayAvgAccuracy || 0}
- activeGoal: ${JSON.stringify(context.activeGoal || null)}
- currentPage: ${JSON.stringify(context.currentPage || null)}
- recentConversation: ${JSON.stringify(safeHistory)}

User message:
${message}
`;

  const freeformPrompt = `
Bạn là Aya Assistant trong app học tiếng Nhật.
Người dùng nói: "${message}"

Hãy trả lời NGẮN GỌN bằng tiếng Việt, thực dụng, có gợi ý hành động học cụ thể.
Không dùng markdown code block.
`;

  const toDecision = (parsed) => ({
    reply: String(parsed.reply || '').trim() || 'Mình đã xử lý yêu cầu của bạn.',
    actions: sanitizeAgentActions(parsed.actions || []),
    scheduleDraft: sanitizeScheduleDraft(parsed.scheduleDraft, timezone),
    executionPlan: sanitizeExecutionPlan(parsed.executionPlan, timezone)
  });

  const tryOpenRouterJsonDecision = async () => {
    if (!openRouterApiKey) return null;

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': openRouterSiteUrl,
        'X-Title': openRouterAppName
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: 'You are an assistant agent that must output valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 700
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter assistant failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const rawText = payload?.choices?.[0]?.message?.content || '';
    const parsed = extractJsonObject(typeof rawText === 'string' ? rawText : JSON.stringify(rawText || ''));
    return parsed && typeof parsed === 'object' ? toDecision(parsed) : null;
  };

  const tryGeminiJsonDecision = async () => {
    if (!geminiApiKey) return null;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topK: 1,
            topP: 0.9,
            maxOutputTokens: 700
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini assistant failed: ${geminiResponse.status} ${errorText}`);
    }

    const payload = await geminiResponse.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = extractJsonObject(rawText);
    return parsed && typeof parsed === 'object' ? toDecision(parsed) : null;
  };

  const tryOpenRouterFreeform = async () => {
    if (!openRouterApiKey) return '';
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': openRouterSiteUrl,
        'X-Title': openRouterAppName
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: 'You are Aya Assistant. Reply in concise Vietnamese.' },
          { role: 'user', content: freeformPrompt }
        ],
        temperature: 0.5,
        max_tokens: 300
      })
    });
    if (!response.ok) return '';
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) return content.map((item) => item?.text || '').join('').trim();
    return '';
  };

  const tryGeminiFreeform = async () => {
    if (!geminiApiKey) return '';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: freeformPrompt }] }],
          generationConfig: {
            temperature: 0.5,
            topK: 1,
            topP: 0.95,
            maxOutputTokens: 300
          }
        })
      }
    );
    if (!response.ok) return '';
    const payload = await response.json();
    return (payload?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  };

  try {
    let decision = null;

    try {
      decision = await tryOpenRouterJsonDecision();
    } catch (error) {
      console.error('OpenRouter JSON decision error:', error.message);
    }

    if (!decision) {
      try {
        decision = await tryGeminiJsonDecision();
      } catch (error) {
        console.error('Gemini JSON decision error:', error.message);
      }
    }

    if (decision) return decision;

    const freeform = (await tryOpenRouterFreeform()) || (await tryGeminiFreeform());
    if (freeform) {
      return {
        reply: freeform,
        actions: [],
        scheduleDraft: null,
        executionPlan: null
      };
    }

    return {
      reply: 'LLM hiện chưa phản hồi được. Bạn kiểm tra API key và kết nối mạng backend rồi thử lại nhé.',
      actions: [
        { type: 'prompt', label: 'Hôm nay nên học gì?', payload: 'Hôm nay nên học gì?' },
        { type: 'prompt', label: 'Lên lịch ôn tập 19h mai', payload: 'Lên lịch ôn tập 19h mai' }
      ],
      scheduleDraft: null,
      executionPlan: null
    };
  } catch (error) {
    console.error('Assistant agent hard failure:', error.message);
    return {
      reply: 'Mình gặp lỗi tạm thời khi gọi LLM. Bạn thử lại sau vài giây nhé.',
      actions: [
        { type: 'prompt', label: 'Hôm nay nên học gì?', payload: 'Hôm nay nên học gì?' },
        { type: 'prompt', label: 'Mở Kanji N3', payload: 'Mở Kanji N3' }
      ],
      scheduleDraft: null,
      executionPlan: null
    };
  }
};

const getCalendarOAuthClient = () => {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID || 'demo-client-id',
    process.env.GOOGLE_CLIENT_SECRET || 'demo-secret',
    CALENDAR_REDIRECT_URI
  );
};

const getCalendarConnectUrl = (userId) => {
  const oauthClient = getCalendarOAuthClient();
  const state = jwt.sign({ userId, t: Date.now() }, JWT_SECRET, { expiresIn: '15m' });
  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: CALENDAR_SCOPES,
    state
  });
};

const getCalendarTokenRecord = async (userId) => {
  const result = await db.query(
    `SELECT user_id, refresh_token, access_token, scope, expiry_date
     FROM user_calendar_tokens
     WHERE user_id = $1 AND provider = 'google'`,
    [userId]
  );

  return result.rows[0] || null;
};

const getCalendarClientForUser = async (userId) => {
  const tokenRecord = await getCalendarTokenRecord(userId);
  if (!tokenRecord) {
    throw new Error('CALENDAR_NOT_CONNECTED');
  }

  const oauthClient = getCalendarOAuthClient();
  oauthClient.setCredentials({
    refresh_token: tokenRecord.refresh_token || undefined,
    access_token: tokenRecord.access_token || undefined,
    expiry_date: tokenRecord.expiry_date ? Number(tokenRecord.expiry_date) : undefined
  });

  return oauthClient;
};

app.get('/api/assistant/calendar/status', authenticateToken, async (req, res) => {
  try {
    const tokenRecord = await getCalendarTokenRecord(req.user.id);
    res.json({ connected: Boolean(tokenRecord) });
  } catch (error) {
    console.error('Calendar status error:', error);
    res.status(500).json({ message: 'Failed to check calendar status' });
  }
});

app.get('/api/assistant/calendar/connect-url', authenticateToken, async (req, res) => {
  try {
    const url = getCalendarConnectUrl(req.user.id);
    res.json({ url });
  } catch (error) {
    console.error('Calendar connect-url error:', error);
    res.status(500).json({ message: 'Failed to create calendar connect URL' });
  }
});

app.get('/api/assistant/calendar/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Missing code/state');
    }

    const payload = jwt.verify(String(state), JWT_SECRET);
    const userId = payload?.userId;

    if (!userId) {
      return res.status(400).send('Invalid state');
    }

    const oauthClient = getCalendarOAuthClient();
    const { tokens } = await oauthClient.getToken(String(code));

    const existing = await getCalendarTokenRecord(userId);
    const refreshToken = tokens.refresh_token || existing?.refresh_token || null;

    await db.query(
      `INSERT INTO user_calendar_tokens (
        user_id, provider, refresh_token, access_token, scope, expiry_date, updated_at
      )
      VALUES ($1, 'google', $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        refresh_token = COALESCE(EXCLUDED.refresh_token, user_calendar_tokens.refresh_token),
        access_token = EXCLUDED.access_token,
        scope = EXCLUDED.scope,
        expiry_date = EXCLUDED.expiry_date,
        updated_at = CURRENT_TIMESTAMP`,
      [userId, refreshToken, tokens.access_token || null, tokens.scope || null, tokens.expiry_date || null]
    );

    return res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>Google Calendar connected ✅</h2>
          <p>You can close this window and return to AyaLearning.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'aya-calendar-connected', success: true }, '*');
              setTimeout(() => window.close(), 500);
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Calendar OAuth callback error:', error);
    res.status(500).send('Failed to connect Google Calendar');
  }
});

const createCalendarEventForUser = async (userId, payload = {}) => {
  const { summary, description, startTime, endTime, timeZone, reminders = [30] } = payload || {};

  if (!summary || !startTime || !endTime) {
    const error = new Error('summary, startTime and endTime are required');
    error.code = 'INVALID_INPUT';
    throw error;
  }

  const oauthClient = await getCalendarClientForUser(userId);
  const calendar = google.calendar({ version: 'v3', auth: oauthClient });
  const eventPayload = {
    summary,
    description: description || 'Scheduled by AyaLearning Assistant',
    start: {
      dateTime: new Date(startTime).toISOString(),
      timeZone: timeZone || 'Asia/Ho_Chi_Minh'
    },
    end: {
      dateTime: new Date(endTime).toISOString(),
      timeZone: timeZone || 'Asia/Ho_Chi_Minh'
    },
    reminders: {
      useDefault: false,
      overrides: Array.isArray(reminders)
        ? reminders
            .filter((minutes) => Number.isFinite(Number(minutes)))
            .map((minutes) => ({ method: 'popup', minutes: Number(minutes) }))
        : [{ method: 'popup', minutes: 30 }]
    }
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventPayload
  });

  return {
    id: response.data.id,
    htmlLink: response.data.htmlLink,
    summary: response.data.summary,
    start: response.data.start,
    end: response.data.end
  };
};

app.post('/api/assistant/calendar/events', authenticateToken, async (req, res) => {
  try {
    let event;
    try {
      event = await createCalendarEventForUser(req.user.id, req.body || {});
    } catch (error) {
      if (error.code === 'INVALID_INPUT') {
        return res.status(400).json({ message: error.message });
      }
      if (error.message === 'CALENDAR_NOT_CONNECTED') {
        return res.status(412).json({
          message: 'Google Calendar is not connected',
          connectRequired: true,
          connectUrl: getCalendarConnectUrl(req.user.id)
        });
      }
      throw error;
    }

    res.status(201).json({
      message: 'Calendar event created successfully',
      event
    });
  } catch (error) {
    console.error('Create calendar event error:', error);
    res.status(500).json({ message: 'Failed to create calendar event', error: error.message });
  }
});

app.post('/api/assistant/message', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message = '', timezone = 'Asia/Ho_Chi_Minh', conversationHistory = [], currentPage = null } = req.body || {};

    if (!String(message).trim()) {
      return res.status(400).json({ message: 'message is required' });
    }

    let context = {
      todayTotalMinutes: 0,
      todayTotalItems: 0,
      todayAvgAccuracy: 0,
      activeGoal: null,
      calendarConnected: false
    };

    let calendarRecord = null;
    try {
      const [statsResult, goalsResult, calendarToken] = await Promise.all([
        db.query(
          `SELECT
              COALESCE(SUM(duration_minutes), 0) AS total_minutes,
              COALESCE(SUM(items_studied), 0) AS total_items,
              COALESCE(AVG(accuracy_percentage), 0) AS avg_accuracy
           FROM study_sessions
           WHERE user_id = $1
             AND created_at >= CURRENT_DATE`,
          [userId]
        ),
        db.query(
          `SELECT target_exam_date, target_level, description
           FROM exam_goals
           WHERE user_id = $1 AND completed = false
           ORDER BY target_exam_date ASC
           LIMIT 1`,
          [userId]
        ),
        getCalendarTokenRecord(userId)
      ]);

      const today = statsResult.rows[0] || {};
      calendarRecord = calendarToken;
      context = {
        todayTotalMinutes: Number(today.total_minutes || 0),
        todayTotalItems: Number(today.total_items || 0),
        todayAvgAccuracy: Number(today.avg_accuracy || 0),
        activeGoal: goalsResult.rows[0] || null,
        calendarConnected: Boolean(calendarToken),
        currentPage: currentPage ? normalizeTab(currentPage) : null
      };
    } catch (contextError) {
      console.error('Assistant context fetch failed, continue with defaults:', contextError.message);
    }

    const decision = await runAssistantAgent({
      message: String(message),
      timezone: String(timezone || 'Asia/Ho_Chi_Minh'),
      conversationHistory,
      context
    });

    return res.json({
      reply: decision.reply,
      actions: decision.actions,
      pendingSchedule: decision.scheduleDraft,
      pendingPlan: decision.executionPlan,
      calendarConnected: Boolean(calendarRecord)
    });
  } catch (error) {
    console.error('Assistant message error:', error);
    res.status(200).json({
      reply: 'Mình vừa gặp lỗi tạm thời nhưng vẫn sẵn sàng hỗ trợ. Bạn thử lại yêu cầu ngắn gọn hơn nhé.',
      actions: [
        { type: 'prompt', label: 'Hôm nay nên học gì?', payload: 'Hôm nay nên học gì?' },
        { type: 'prompt', label: 'Mở Kanji N3', payload: 'Mở Kanji N3' },
        { type: 'prompt', label: 'Lên lịch ôn tập 19h mai', payload: 'Lên lịch ôn tập 19h mai' }
      ],
      pendingSchedule: null,
      pendingPlan: null,
      calendarConnected: false,
      degraded: true,
      error: error.message
    });
  }
});

app.post('/api/assistant/execute', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const timezone = String(req.body?.timezone || 'Asia/Ho_Chi_Minh');
    const clientContext = req.body?.clientContext && typeof req.body.clientContext === 'object'
      ? req.body.clientContext
      : {};
    const rawPlan = req.body?.executionPlan;
    const executionPlan = sanitizeExecutionPlan(rawPlan, timezone);

    if (!executionPlan) {
      return res.status(400).json({ message: 'executionPlan is invalid or empty' });
    }

    const clientActions = [];
    const summaries = [];
    const results = [];

    for (const step of executionPlan.steps) {
      if (step.type === 'add_kanji_batch') {
        const result = await addKanjiBatchForUser({
          userId,
          level: step.payload.level,
          count: step.payload.count
        });
        results.push({ type: step.type, ...result });
        summaries.push(`Kanji ${result.level}: ${result.inserted}/${result.requested}`);
        continue;
      }

      if (step.type === 'get_kanji_list') {
        const result = await getKanjiListForUser({
          userId,
          level: step.payload.level,
          limit: step.payload.limit,
          query: step.payload.query
        });
        results.push({ type: step.type, ...result });
        summaries.push(`Kanji list: ${result.count} mục`);
        continue;
      }

      if (step.type === 'delete_kanji') {
        const result = await deleteKanjiForUser({
          userId,
          id: step.payload.id,
          character: step.payload.character
        });
        results.push({ type: step.type, ...result });
        summaries.push(`Delete kanji: ${result.deleted}`);
        continue;
      }

      if (step.type === 'add_vocabulary_batch') {
        const result = await addVocabularyBatchForUser({
          userId,
          level: step.payload.level,
          count: step.payload.count
        });
        results.push({ type: step.type, ...result });
        summaries.push(`Vocabulary ${result.level}: ${result.inserted}/${result.requested}`);
        continue;
      }

      if (step.type === 'get_vocabulary_list') {
        const result = await getVocabularyListForUser({
          userId,
          level: step.payload.level,
          limit: step.payload.limit,
          query: step.payload.query
        });
        results.push({ type: step.type, ...result });
        summaries.push(`Vocabulary list: ${result.count} mục`);
        continue;
      }

      if (step.type === 'delete_vocabulary') {
        const result = await deleteVocabularyForUser({
          userId,
          id: step.payload.id,
          word: step.payload.word
        });
        results.push({ type: step.type, ...result });
        summaries.push(`Delete vocabulary: ${result.deleted}`);
        continue;
      }

      if (step.type === 'navigate') {
        clientActions.push({ type: 'navigate', label: step.label, payload: step.payload });
        results.push({ type: step.type, payload: step.payload });
        continue;
      }

      if (step.type === 'connect_calendar') {
        const url = step.payload?.url || getCalendarConnectUrl(userId);
        clientActions.push({ type: 'connect_calendar', label: step.label, payload: url });
        results.push({ type: step.type, url });
        continue;
      }

      if (step.type === 'get_calendar_events') {
        try {
          const result = await getCalendarEventsForUser({
            userId,
            fromTime: step.payload.fromTime,
            toTime: step.payload.toTime,
            maxResults: step.payload.maxResults
          });
          results.push({ type: step.type, ...result });
          summaries.push(`Calendar events: ${result.count}`);
        } catch (calendarError) {
          if (calendarError.message === 'CALENDAR_NOT_CONNECTED') {
            const connectUrl = getCalendarConnectUrl(userId);
            clientActions.push({ type: 'connect_calendar', label: 'Kết nối Google Calendar', payload: connectUrl });
            results.push({ type: step.type, error: 'CALENDAR_NOT_CONNECTED' });
            summaries.push('Calendar chưa kết nối');
            continue;
          }
          throw calendarError;
        }
        continue;
      }

      if (step.type === 'find_free_time_slots') {
        try {
          const result = await findFreeTimeSlotsForUser({
            userId,
            fromTime: step.payload.fromTime,
            toTime: step.payload.toTime,
            durationMinutes: step.payload.durationMinutes,
            timeZone: step.payload.timeZone || timezone
          });
          results.push({ type: step.type, ...result });
          summaries.push(`Free slots: ${result.count}`);
        } catch (calendarError) {
          if (calendarError.message === 'CALENDAR_NOT_CONNECTED') {
            const connectUrl = getCalendarConnectUrl(userId);
            clientActions.push({ type: 'connect_calendar', label: 'Kết nối Google Calendar', payload: connectUrl });
            results.push({ type: step.type, error: 'CALENDAR_NOT_CONNECTED' });
            summaries.push('Calendar chưa kết nối');
            continue;
          }
          throw calendarError;
        }
        continue;
      }

      if (step.type === 'get_user_progress') {
        const result = await getUserProgressSnapshot(userId);
        results.push({ type: step.type, ...result });
        summaries.push(`Progress fetched`);
        continue;
      }

      if (step.type === 'search_content') {
        const result = await searchContentForUser({
          userId,
          query: step.payload.query,
          limit: step.payload.limit
        });
        results.push({
          type: step.type,
          counts: {
            kanji: result.kanji.length,
            vocabulary: result.vocabulary.length
          },
          ...result
        });
        summaries.push(`Search: K${result.kanji.length}/V${result.vocabulary.length}`);
        continue;
      }

      if (step.type === 'get_current_datetime') {
        const zone = step.payload.timeZone || timezone;
        const now = new Date();
        results.push({
          type: step.type,
          timeZone: zone,
          iso: now.toISOString(),
          localized: new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'full',
            timeStyle: 'long',
            timeZone: zone
          }).format(now)
        });
        summaries.push('Datetime fetched');
        continue;
      }

      if (step.type === 'get_current_page') {
        const page = normalizeTab(clientContext.currentPage || req.body?.currentPage || '') || null;
        results.push({ type: step.type, currentPage: page });
        summaries.push(`Current page: ${page || 'unknown'}`);
        continue;
      }

      if (step.type === 'create_calendar_event') {
        try {
          const event = await createCalendarEventForUser(userId, step.payload);
          const link = event?.htmlLink || '';
          if (link) {
            clientActions.push({ type: 'open_link', label: 'Mở Google Calendar', payload: link });
          }
          results.push({ type: step.type, event });
          summaries.push(`Calendar: ${event?.summary || 'event created'}`);
        } catch (calendarError) {
          if (calendarError.message === 'CALENDAR_NOT_CONNECTED') {
            const connectUrl = getCalendarConnectUrl(userId);
            clientActions.push({ type: 'connect_calendar', label: 'Kết nối Google Calendar', payload: connectUrl });
            results.push({ type: step.type, error: 'CALENDAR_NOT_CONNECTED' });
            summaries.push('Calendar chưa kết nối');
            continue;
          }
          throw calendarError;
        }
      }
    }

    const reply = summaries.length > 0
      ? `Đã thực thi plan "${executionPlan.title}". Kết quả: ${summaries.join(' | ')}`
      : `Đã thực thi plan "${executionPlan.title}".`;

    return res.json({
      reply,
      actions: clientActions,
      results,
      executed: true
    });
  } catch (error) {
    console.error('Assistant execute error:', error);
    return res.status(500).json({
      message: 'Không thể thực thi plan',
      error: error.message
    });
  }
});

// --- Chat/LLM route ---
app.post('/api/chat', async (req, res) => {
  try {
    console.log('Chat endpoint called with:', req.body);
    
    const { message, role } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }
    
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return res.status(500).json({ message: 'API configuration error' });
    }

    console.log('Calling Gemini API...');
    
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `あなたは親切で知識豊富な日本語の先生です。日本語学習者をサポートし、質問に丁寧に答えてください。可能な限り日本語で回答してください。

質問: ${message}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 150,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const data = await geminiResponse.json();
    console.log('Gemini response:', data);
    
    const response = data.candidates?.[0]?.content?.parts?.[0]?.text || "申し訳ありませんが、今は応答できません。もう一度試してください。";
    
    res.json({ response });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message 
    });
  }
});

// --- GAME ENDPOINTS ---

// Get Shiritori words from database
app.get('/api/games/shiritori/words', authenticateToken, async (req, res) => {
  try {
    const { difficulty, limit } = req.query;
    const limitNum = limit ? parseInt(limit) : 50;

    // Query words from database with first_kana and last_kana
    let query = 'SELECT id, kanji, kana, romaji, first_kana, last_kana FROM words';
    const params = [];

    if (difficulty) {
      query += ' WHERE jlpt_level = $1';
      params.push(difficulty);
    }

    query += ' ORDER BY RANDOM() LIMIT $' + (params.length + 1);
    params.push(limitNum);

    const result = await db.query(query, params);

    res.json({
      gameType: 'shiritori',
      difficulty: difficulty || 'all',
      words: result.rows,
      totalWords: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching shiritori words:', err);
    res.status(500).json({ message: 'Server error fetching game data' });
  }
});

// Save Game Results
app.post('/api/game-results', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameType, score, accuracy, duration_seconds, difficulty, words_used } = req.body;

    if (!gameType) {
      return res.status(400).json({ message: 'gameType is required' });
    }

    // Insert into study_sessions table
    const query = `
      INSERT INTO study_sessions (user_id, session_type, duration_minutes, items_studied, accuracy_percentage)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const durationMinutes = duration_seconds
      ? Math.max(0, Math.round(Number(duration_seconds) / 60))
      : 0;
    const result = await db.query(query, [
      userId,
      gameType,
      durationMinutes,
      words_used || 0,
      accuracy || 0
    ]);

    const record = await upsertUserGameRecord({
      userId,
      gameType,
      score,
      accuracy,
      durationSeconds: duration_seconds
    });

    res.status(201).json({
      message: 'Game result saved successfully',
      result: {
        id: result.rows[0].id,
        gameType,
        score,
        accuracy,
        duration: durationMinutes,
        timestamp: result.rows[0].created_at
      },
      record
    });
  } catch (err) {
    console.error('Error saving game result:', err);
    res.status(500).json({ message: 'Server error saving game result' });
  }
});

// Get User Game Statistics
app.get('/api/game-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameType } = req.query;

    let statsQuery = `
      SELECT 
        session_type,
        COUNT(*) as games_played,
        AVG(accuracy_percentage) as avg_accuracy,
        MAX(accuracy_percentage) as best_accuracy,
        SUM(duration_minutes) as total_duration
      FROM study_sessions
      WHERE user_id = $1
    `;

    const params = [userId];

    if (gameType) {
      statsQuery += ' AND session_type = $2';
      params.push(gameType);
    }

    statsQuery += ' GROUP BY session_type';

    const statsResult = await db.query(statsQuery, params);

    // Fetch all sessions for weekly activity
    const sessionsQuery = `
      SELECT id, session_type, items_studied, accuracy_percentage, created_at
      FROM study_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const sessionsResult = await db.query(sessionsQuery, [userId]);

    const recordsParams = [userId];
    let recordsQuery = `
      SELECT user_id, game_type, best_score, best_accuracy, fastest_duration_seconds, plays_count, last_played_at
      FROM user_game_records
      WHERE user_id = $1
    `;

    if (gameType) {
      recordsQuery += ' AND game_type = $2';
      recordsParams.push(gameType);
    }

    recordsQuery += ' ORDER BY game_type ASC';
    const recordsResult = await db.query(recordsQuery, recordsParams);

    res.json({
      stats: statsResult.rows,
      sessions: sessionsResult.rows,
      records: recordsResult.rows,
      userId
    });
  } catch (err) {
    console.error('Error fetching game stats:', err);
    res.status(500).json({ message: 'Server error fetching game statistics' });
  }
});

// --- DICTIONARY SEARCH ENDPOINT ---

// Search dictionary with similarity ranking (Mazii style)
app.get('/api/search', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;

    if (!q || q.trim().length < 1) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchTerm = q.trim();
    const results = {
      words: [],
      kanji: [],
      vocabulary: []
    };

    // Search in words table with similarity ranking using pg_trgm
    if (type === 'all' || type === 'words') {
      const wordsQuery = `
        WITH word_meanings AS (
          SELECT 
            w.id,
            w.kanji,
            w.kana,
            w.romaji,
            w.jlpt_level,
            w.first_kana,
            w.last_kana,
            json_agg(
              json_build_object(
                'meaning', m.meaning_vi,
                'pos', m.part_of_speech
              )
            ) FILTER (WHERE m.id IS NOT NULL) as meanings,
            GREATEST(
              SIMILARITY(w.kanji, $1),
              SIMILARITY(w.kana, $1),
              SIMILARITY(w.romaji, $1),
              COALESCE(MAX(SIMILARITY(LOWER(m.meaning_vi), $1)), 0)
            ) as similarity,
            MAX(CASE WHEN LOWER(m.meaning_vi) LIKE $2 THEN 1 ELSE 0 END) as has_meaning_match
          FROM words w
          LEFT JOIN meanings m ON w.id = m.word_id
          WHERE 
            w.kanji % $1 OR
            w.kana % $1 OR
            w.romaji % $1 OR
            LOWER(w.kanji) LIKE $2 OR 
            LOWER(w.kana) LIKE $2 OR 
            LOWER(w.romaji) LIKE $2 OR
            LOWER(m.meaning_vi) LIKE $2
          GROUP BY w.id, w.kanji, w.kana, w.romaji, w.jlpt_level, w.first_kana, w.last_kana
        )
        SELECT 
          id,
          kanji,
          kana,
          romaji,
          jlpt_level,
          first_kana,
          last_kana,
          meanings,
          similarity,
          has_meaning_match,
          CASE WHEN jlpt_level IS NOT NULL THEN 'N' || jlpt_level ELSE 'N/A' END as jlptLevel
        FROM word_meanings
        WHERE similarity > 0 OR meanings IS NOT NULL OR has_meaning_match = 1
        ORDER BY has_meaning_match DESC, similarity DESC, jlpt_level ASC
        LIMIT 30
      `;
      const wordsResult = await db.query(wordsQuery, [searchTerm, `%${searchTerm}%`]);
      results.words = wordsResult.rows.map(row => ({
        id: row.id,
        kanji: row.kanji,
        kana: row.kana,
        romaji: row.romaji,
        jlptLevel: row.jlptLevel,
        meanings: row.meanings || [],
        similarity: Math.round(row.similarity * 100) / 100
      }));
    }

    // Search in kanji table
    if (type === 'all' || type === 'kanji') {
      const kanjiQuery = `
        SELECT id, character, onyomi, kunyomi, meaning_vi, meaning_en, jlpt_level,
          GREATEST(
            SIMILARITY(character, $1),
            CASE WHEN onyomi ISNULL THEN 0 ELSE SIMILARITY(onyomi, $1) END,
            CASE WHEN kunyomi ISNULL THEN 0 ELSE SIMILARITY(kunyomi, $1) END
          ) as similarity
        FROM kanji
        WHERE 
          character % $1 OR
          onyomi % $1 OR
          kunyomi % $1 OR
          LOWER(onyomi) LIKE $2 OR 
          LOWER(kunyomi) LIKE $2 OR
          LOWER(meaning_vi) LIKE $2
        ORDER BY similarity DESC
        LIMIT 10
      `;
      const kanjiResult = await db.query(kanjiQuery, [searchTerm, `%${searchTerm}%`]);
      results.kanji = kanjiResult.rows;
    }

    // Search in vocabulary table with similarity ranking
    if (type === 'all' || type === 'vocabulary') {
      const vocabQuery = `
        SELECT id, word_jp, word_kana, word_romaji, meaning_vi, jlpt_level,
          GREATEST(
            SIMILARITY(word_jp, $1),
            SIMILARITY(word_kana, $1),
            CASE WHEN word_romaji ISNULL THEN 0 ELSE SIMILARITY(word_romaji, $1) END
          ) as similarity
        FROM vocabulary
        WHERE 
          word_jp % $1 OR
          word_kana % $1 OR
          word_romaji % $1 OR
          LOWER(word_jp) LIKE $2 OR 
          LOWER(word_kana) LIKE $2 OR 
          LOWER(word_romaji) LIKE $2 OR
          LOWER(meaning_vi) LIKE $2
        ORDER BY similarity DESC
        LIMIT 15
      `;
      const vocabResult = await db.query(vocabQuery, [searchTerm, `%${searchTerm}%`]);
      results.vocabulary = vocabResult.rows;
    }

    res.json({
      query: searchTerm,
      results
    });
  } catch (err) {
    console.error('Error searching dictionary:', err);
    res.status(500).json({ message: 'Server error searching dictionary' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});


// --- SHIRITORI GAME ENDPOINTS ---

// Validate a shiritori move
app.post('/api/games/shiritori/validate', async (req, res) => {
  try {
    const { newWord, lastWordKana, usedWords = [], difficulty = 'N5' } = req.body;

    if (!newWord || !lastWordKana) {
      return res.status(400).json({ valid: false, message: 'Missing required fields' });
    }

    // Check if word ends with ん
    if (endsWithN(newWord)) {
      return res.status(200).json({ 
        valid: false, 
        message: 'Game Over! Cannot use words ending in ん',
        gameOver: true 
      });
    }

    // Check character matching
    const newWordFirst = getFirstKana(newWord);
    const lastWordLast = getLastKana(lastWordKana);

    if (newWordFirst !== lastWordLast) {
      return res.status(200).json({
        valid: false,
        message: `Word must start with 「${lastWordLast}」, not 「${newWordFirst}」`,
        expectedFirst: lastWordLast,
        actualFirst: newWordFirst
      });
    }

    // Check if word was already used
    const normalizedNew = normalizeKana(newWord);
    const alreadyUsed = usedWords.some(word => {
      return normalizeKana(word) === normalizedNew;
    });

    if (alreadyUsed) {
      return res.status(200).json({
        valid: false,
        message: 'This word was already used!',
        repeated: true
      });
    }

    // Check if word exists in database
    // Search by kana, could also be romanji input
    const normalizedSearch = normalizeKana(newWord);
    const wordQuery = `
      SELECT w.id, w.kanji, w.kana, w.romaji, w.jlpt_level,
             (
               SELECT m.meaning_vi
               FROM meanings m
               WHERE m.word_id = w.id
               LIMIT 1
             ) AS meaning_vi
      FROM words w
      WHERE 
        LOWER(w.kana) = LOWER($1) OR 
        LOWER(w.kana) LIKE $2 OR
        LOWER(w.romaji) = LOWER($3) OR
        LOWER(w.romaji) LIKE $4
      LIMIT 1
    `;
    const wordResult = await db.query(wordQuery, [
      normalizedSearch,
      `%${normalizedSearch}%`,
      newWord.toLowerCase(),
      `%${newWord.toLowerCase()}%`
    ]);

    if (wordResult.rows.length === 0) {
      return res.status(200).json({
        valid: false,
        message: 'Word not found in dictionary',
        notInDict: true
      });
    }

    const word = wordResult.rows[0];
    const wordLastKana = getLastKana(word.kana);

    // Valid word!
    return res.status(200).json({
      valid: true,
      message: 'Valid word!',
      word: {
        id: word.id,
        kanji: word.kanji,
        kana: word.kana,
        romaji: word.romaji,
        jlptLevel: `N${word.jlpt_level}`,
        meaningVi: word.meaning_vi || ''
      },
      nextCharacter: wordLastKana
    });
  } catch (err) {
    console.error('Error validating shiritori move:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get words for shiritori game (by difficulty)
app.get('/api/games/shiritori/starting-words', async (req, res) => {
  try {
    const { difficulty = 'N5', limit = 10 } = req.query;

    // Convert difficulty to JLPT level (N5 -> 5)
    let jlptLevel = 5;
    if (difficulty === 'N4') jlptLevel = 4;
    if (difficulty === 'N3') jlptLevel = 3;
    if (difficulty === 'N2') jlptLevel = 2;
    if (difficulty === 'N1') jlptLevel = 1;

    // Get random words that don't end with ん
    const query = `
      SELECT w.id, w.kanji, w.kana, w.romaji, w.jlpt_level,
             (
               SELECT m.meaning_vi
               FROM meanings m
               WHERE m.word_id = w.id
               LIMIT 1
             ) AS meaning_vi
      FROM words w
      WHERE w.jlpt_level = $1
        AND w.kana NOT LIKE '%ん'
        AND w.kana IS NOT NULL
        AND LENGTH(w.kana) > 0
      ORDER BY RANDOM()
      LIMIT $2
    `;

    const result = await db.query(query, [jlptLevel, parseInt(limit)]);

    const words = result.rows.map(row => ({
      id: row.id,
      kanji: row.kanji,
      kana: row.kana,
      romaji: row.romaji,
      jlptLevel: `N${row.jlpt_level}`,
      meaningVi: row.meaning_vi || '',
      lastKana: getLastKana(row.kana)
    }));

    res.json({ words, count: words.length });
  } catch (err) {
    console.error('Error fetching shiritori words:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get computer move for shiritori game
app.post('/api/games/shiritori/computer-move', async (req, res) => {
  try {
    const { lastWordKana, usedWords = [], difficulty = 'N5' } = req.body;

    if (!lastWordKana) {
      return res.status(400).json({ valid: false, message: 'Missing lastWordKana' });
    }

    let jlptLevel = 5;
    if (difficulty === 'N4') jlptLevel = 4;
    if (difficulty === 'N3') jlptLevel = 3;
    if (difficulty === 'N2') jlptLevel = 2;
    if (difficulty === 'N1') jlptLevel = 1;

    const requiredFirstKana = getLastKana(lastWordKana);

    if (!requiredFirstKana) {
      return res.status(400).json({ valid: false, message: 'Invalid lastWordKana' });
    }

    const normalizedUsedWords = usedWords
      .map((word) => normalizeKana(word))
      .filter(Boolean);

    const computerQuery = `
      SELECT w.id, w.kanji, w.kana, w.romaji, w.jlpt_level,
             (
               SELECT m.meaning_vi
               FROM meanings m
               WHERE m.word_id = w.id
               LIMIT 1
             ) AS meaning_vi
      FROM words w
      WHERE w.jlpt_level = $1
        AND w.kana IS NOT NULL
        AND LENGTH(w.kana) > 0
        AND w.kana NOT LIKE '%ん'
        AND (
          w.first_kana = $2
          OR SUBSTRING(w.kana, 1, 1) = $2
        )
      ORDER BY RANDOM()
      LIMIT 200
    `;

    const candidateResult = await db.query(computerQuery, [jlptLevel, requiredFirstKana]);

    const nextWord = candidateResult.rows.find((row) => {
      const normalizedKana = normalizeKana(row.kana);
      return !normalizedUsedWords.includes(normalizedKana);
    });

    if (!nextWord) {
      return res.status(200).json({
        valid: false,
        gameOver: true,
        message: 'Bạn thắng! Máy không tìm được từ phù hợp.',
        reason: 'computer_no_move',
        requiredFirstKana
      });
    }

    return res.status(200).json({
      valid: true,
      word: {
        id: nextWord.id,
        kanji: nextWord.kanji,
        kana: nextWord.kana,
        romaji: nextWord.romaji,
        jlptLevel: `N${nextWord.jlpt_level}`,
        meaningVi: nextWord.meaning_vi || ''
      },
      nextCharacter: getLastKana(nextWord.kana)
    });
  } catch (err) {
    console.error('Error generating computer shiritori move:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Save shiritori game result
app.post('/api/games/shiritori/save-result', authenticateToken, async (req, res) => {
  try {
    const { score, wordsPlayed, duration, difficulty, gameMode } = req.body;
    const userId = req.user.id;

    if (!score || !wordsPlayed || !duration) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Save to study_sessions table
    const query = `
      INSERT INTO study_sessions (user_id, session_type, score, duration_seconds, data, difficulty)
      VALUES ($1, 'shiritori', $2, $3, $4, $5)
      RETURNING id, created_at
    `;

    const sessionData = {
      words_played: wordsPlayed,
      game_mode: gameMode || 'casual',
      word_count: wordsPlayed.length
    };

    const result = await db.query(query, [
      userId,
      score,
      duration,
      JSON.stringify(sessionData),
      difficulty || 'N5'
    ]);

    const record = await upsertUserGameRecord({
      userId,
      gameType: 'shiritori',
      score,
      durationSeconds: duration
    });

    res.json({
      success: true,
      sessionId: result.rows[0].id,
      message: 'Game result saved',
      createdAt: result.rows[0].created_at,
      record
    });
  } catch (err) {
    console.error('Error saving shiritori result:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --- KAIWA (CONVERSATION) ENDPOINTS ---

const buildKaiwaPrompt = (selectedCharacter, userMessage, conversationHistory = [], conversationTopic = '') => {
  let conversationContext = '';
  if (conversationHistory.length > 0) {
    conversationContext = '\n\n過去の会話:\n' +
      conversationHistory.slice(-6).map(msg => {
        const sender = msg.sender === 'user' ? 'ユーザー' : selectedCharacter.name;
        return `${sender}: ${msg.text}`;
      }).join('\n');
  }

  const normalizedTopic = String(conversationTopic || '').trim();
  const topicSection = normalizedTopic
    ? `\n\n会話トピック(最優先): ${normalizedTopic}`
    : '\n\n会話トピック(最優先): 自然な日常会話';

  return `${selectedCharacter.systemPrompt}

${conversationContext}
${topicSection}

ユーザー: ${userMessage}

${selectedCharacter.name}として、上記のメッセージに自然に返答してください。
返答は会話を続けることを目的にし、毎回ユーザーが答えやすい短い質問を1つ含めてください。
質問は必ず会話トピックに沿った内容にしてください。
会話を締める表現(例: またね、以上です)は、ユーザーが明確に終了の意図を示した時だけ使ってください。
もしユーザーの日本語に大きな間違いがあれば、会話の最後に優しく訂正してください。
返答は200文字以内で。`;
};

const generateKaiwaReply = async ({ character, userMessage, conversationHistory = [], topic = '' }) => {
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const openRouterSiteUrl = process.env.OPENROUTER_SITE_URL || 'http://localhost:3000';
  const openRouterAppName = process.env.OPENROUTER_APP_NAME || 'AyaLearning';

  const selectedCharacter = kaiwaCharacters.find((char) => char.id === character.id) || kaiwaCharacters[0];
  const fullPrompt = buildKaiwaPrompt(selectedCharacter, userMessage, conversationHistory, topic);

  let aiReply = null;

  if (openRouterApiKey) {
    try {
      const openRouterResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': openRouterSiteUrl,
          'X-Title': openRouterAppName
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: 'user',
              content: fullPrompt
            }
          ]
        })
      });

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        console.error('OpenRouter API error:', errorText);
        throw new Error('Failed to get AI response from OpenRouter');
      }

      const openRouterData = await openRouterResponse.json();
      const openRouterContent = openRouterData.choices?.[0]?.message?.content;
      aiReply = typeof openRouterContent === 'string'
        ? openRouterContent
        : (Array.isArray(openRouterContent)
          ? openRouterContent.map(item => item?.text || '').join('')
          : null);
    } catch (openRouterError) {
      console.error('OpenRouter request failed, fallback to Gemini:', openRouterError.message);
      aiReply = null;
    }
  }

  if (!aiReply && geminiApiKey) {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: fullPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await geminiResponse.json();
    aiReply = aiData.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  if (!aiReply) {
    throw new Error('No LLM API key configured (OPENROUTER_API_KEY or GEMINI_API_KEY)');
  }

  return {
    reply: aiReply.trim(),
    characterName: selectedCharacter.name,
    selectedCharacter
  };
};

const transcribeAudioWithWhisper = async ({ audioBuffer, mimeType }) => {
  const whisperEndpoint = process.env.OPENAI_ASR_ENDPOINT || 'http://localhost:9000/v1/audio/transcriptions';
  const isOpenAiEndpoint = whisperEndpoint.includes('api.openai.com');
  const whisperModel = process.env.OPENAI_ASR_MODEL || (isOpenAiEndpoint ? 'whisper-1' : 'small');
  const asrApiKey = process.env.ASR_API_KEY || process.env.OPENAI_API_KEY || '';

  if (isOpenAiEndpoint && !asrApiKey) {
    throw new Error('ASR API key not configured (OPENAI_API_KEY or ASR_API_KEY)');
  }

  const fileExtension = mimeType && mimeType.includes('wav') ? 'wav' : 'webm';

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/webm' }), `kaiwa.${fileExtension}`);
  form.append('model', whisperModel);
  form.append('language', 'ja');
  form.append('response_format', 'json');

  const headers = {};
  if (asrApiKey) {
    headers.Authorization = `Bearer ${asrApiKey}`;
  }

  let response;
  try {
    response = await fetch(whisperEndpoint, {
      method: 'POST',
      headers,
      body: form
    });
  } catch (networkError) {
    throw new Error(`ASR endpoint unreachable: ${whisperEndpoint}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Whisper ASR error:', errorText);
    throw new Error(`Failed to transcribe voice input (${response.status})`);
  }

  const data = await response.json();
  const transcript = data.text?.trim();
  if (!transcript) {
    throw new Error('No speech detected from ASR input');
  }

  return transcript;
};

const getVoiceConfigStatus = () => {
  const whisperEndpoint = process.env.OPENAI_ASR_ENDPOINT || 'http://localhost:9000/v1/audio/transcriptions';
  const asrApiKey = process.env.ASR_API_KEY || process.env.OPENAI_API_KEY || '';
  const isOpenAiEndpoint = whisperEndpoint.includes('api.openai.com');
  const isLikelyFasterWhisper = !isOpenAiEndpoint && whisperEndpoint.includes('/v1/audio/transcriptions');
  const fishSpeechApiUrl = process.env.FISH_SPEECH_API_URL || '';
  const voicevoxApiUrl = process.env.VOICEVOX_API_URL || 'http://127.0.0.1:50021';
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const usingOpenRouter = Boolean(openRouterApiKey);
  const ttsProvider = TTS_PROVIDER;

  return {
    asr: {
      provider: isOpenAiEndpoint
        ? 'openai-whisper'
        : (isLikelyFasterWhisper ? 'faster-whisper-local' : 'custom-whisper-endpoint'),
      endpoint: whisperEndpoint,
      model: process.env.OPENAI_ASR_MODEL || (isOpenAiEndpoint ? 'whisper-1' : 'small'),
      configured: isOpenAiEndpoint ? Boolean(asrApiKey) : true,
      authRequired: isOpenAiEndpoint,
      authConfigured: Boolean(asrApiKey)
    },
    llm: {
      provider: usingOpenRouter ? 'openrouter' : 'gemini',
      model: usingOpenRouter ? OPENROUTER_MODEL : GEMINI_MODEL,
      configured: usingOpenRouter || Boolean(geminiApiKey)
    },
    tts: {
      provider: ttsProvider,
      endpoint: ttsProvider === 'voicevox'
        ? voicevoxApiUrl
        : (fishSpeechApiUrl || null),
      configured: ttsProvider === 'voicevox'
        ? Boolean(voicevoxApiUrl)
        : Boolean(fishSpeechApiUrl)
    }
  };
};

const synthesizeWithVoicevox = async ({ text, character, ttsOptions = {} }) => {
  const voicevoxApiUrl = process.env.VOICEVOX_API_URL || 'http://127.0.0.1:50021';
  if (!voicevoxApiUrl) {
    throw new Error('VOICEVOX_API_URL not configured');
  }

  const characterTts = character?.tts || {};
  const speaker = Number(
    ttsOptions.voicevoxSpeaker
    ?? character?.voicevoxSpeaker
    ?? process.env.VOICEVOX_SPEAKER
    ?? 1
  );

  if (!Number.isFinite(speaker)) {
    throw new Error('VOICEVOX speaker is invalid');
  }

  const queryUrl = `${voicevoxApiUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`;
  const queryResponse = await fetch(queryUrl, { method: 'POST' });

  if (!queryResponse.ok) {
    const errorText = await queryResponse.text();
    console.error('VOICEVOX audio_query error:', errorText);
    throw new Error(`VOICEVOX audio_query failed: ${queryResponse.status}`);
  }

  const audioQuery = await queryResponse.json();
  audioQuery.speedScale = Number(
    ttsOptions.speedScale
    ?? characterTts.speedScale
    ?? process.env.VOICEVOX_SPEED_SCALE
    ?? audioQuery.speedScale
  );
  audioQuery.pitchScale = Number(
    ttsOptions.pitchScale
    ?? characterTts.pitchScale
    ?? process.env.VOICEVOX_PITCH_SCALE
    ?? audioQuery.pitchScale
  );
  audioQuery.intonationScale = Number(
    ttsOptions.intonationScale
    ?? characterTts.intonationScale
    ?? process.env.VOICEVOX_INTONATION_SCALE
    ?? audioQuery.intonationScale
  );
  audioQuery.volumeScale = Number(
    ttsOptions.volumeScale
    ?? characterTts.volumeScale
    ?? process.env.VOICEVOX_VOLUME_SCALE
    ?? audioQuery.volumeScale
  );

  const synthesisResponse = await fetch(`${voicevoxApiUrl}/synthesis?speaker=${speaker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(audioQuery)
  });

  if (!synthesisResponse.ok) {
    const errorText = await synthesisResponse.text();
    console.error('VOICEVOX synthesis error:', errorText);
    throw new Error(`VOICEVOX synthesis failed: ${synthesisResponse.status}`);
  }

  const audioBuffer = await synthesisResponse.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');

  return {
    audioUrl: `data:audio/wav;base64,${base64}`,
    audioMimeType: 'audio/wav',
    visemes: []
  };
};

const parseNumberOrDefault = (value, defaultValue) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const parseIntegerOrDefault = (value, defaultValue) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const synthesizeWithFishSpeech = async ({ text, character, ttsOptions = {} }) => {
  const fishSpeechApiUrl = process.env.FISH_SPEECH_API_URL;
  if (!fishSpeechApiUrl) {
    throw new Error('FISH_SPEECH_API_URL not configured');
  }

  const fishSpeechApiKey = process.env.FISH_SPEECH_API_KEY;
  const referenceId = ttsOptions.voiceId
    || character?.voiceId
    || process.env.FISH_SPEECH_VOICE_ID
    || null;

  const defaultTemperature = parseNumberOrDefault(process.env.FISH_SPEECH_TEMPERATURE, 0.8);
  const defaultTopP = parseNumberOrDefault(process.env.FISH_SPEECH_TOP_P, 0.8);
  const defaultChunkLength = parseIntegerOrDefault(process.env.FISH_SPEECH_CHUNK_LENGTH, 200);
  const defaultNormalize = process.env.FISH_SPEECH_NORMALIZE
    ? process.env.FISH_SPEECH_NORMALIZE.toLowerCase() === 'true'
    : true;

  const characterTts = character?.tts || {};
  const temperature = parseNumberOrDefault(
    ttsOptions.temperature ?? characterTts.temperature,
    defaultTemperature
  );
  const topP = parseNumberOrDefault(
    ttsOptions.topP ?? characterTts.topP,
    defaultTopP
  );
  const chunkLength = parseIntegerOrDefault(
    ttsOptions.chunkLength ?? characterTts.chunkLength,
    defaultChunkLength
  );
  const normalize = typeof (ttsOptions.normalize ?? characterTts.normalize) === 'boolean'
    ? (ttsOptions.normalize ?? characterTts.normalize)
    : defaultNormalize;

  const headers = {
    'Content-Type': 'application/json'
  };
  if (fishSpeechApiKey) {
    headers.Authorization = `Bearer ${fishSpeechApiKey}`;
  }

  // Build request body according to Fish Speech API v1/tts spec
  const requestBody = {
    text,
    format: 'wav',
    chunk_length: chunkLength,
    normalize,
    temperature,
    top_p: topP
  };

  // Add reference_id if available (voice cloning)
  if (referenceId) {
    requestBody.reference_id = referenceId;
  }

  const response = await fetch(fishSpeechApiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Fish Speech TTS error:', errorText);
    throw new Error(`Failed to synthesize speech: ${response.status}`);
  }

  // Fish Speech API returns audio binary stream (wav/pcm/mp3)
  const audioBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'audio/wav';
  const mimeType = contentType.includes('audio/') ? contentType : 'audio/wav';
  const base64 = Buffer.from(audioBuffer).toString('base64');

  return {
    audioUrl: `data:${mimeType};base64,${base64}`,
    audioMimeType: mimeType,
    visemes: []
  };
};

const synthesizeSpeech = async ({ text, character, ttsOptions = {} }) => {
  if (TTS_PROVIDER === 'voicevox') {
    return synthesizeWithVoicevox({ text, character, ttsOptions });
  }

  return synthesizeWithFishSpeech({ text, character, ttsOptions });
};

app.get('/api/kaiwa/characters', (req, res) => {
  const publicCharacters = kaiwaCharacters.map(({ systemPrompt, ...publicCharacter }) => publicCharacter);
  res.json({ characters: publicCharacters });
});

// Kaiwa chat with AI character
app.post('/api/kaiwa/chat', async (req, res) => {
  try {
    const { character, userMessage, conversationHistory = [], topic = '', ttsOptions = {} } = req.body;

    if (!userMessage || !character) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const aiResult = await generateKaiwaReply({ character, userMessage, conversationHistory, topic });

    let ttsResult = {
      audioUrl: null,
      audioMimeType: null,
      visemes: []
    };
    let ttsWarning = null;

    try {
      ttsResult = await synthesizeSpeech({
        text: aiResult.reply,
        character: aiResult.selectedCharacter,
        ttsOptions
      });
    } catch (ttsError) {
      if (
        ttsError.message.includes('FISH_SPEECH_API_URL not configured') ||
        ttsError.message.includes('VOICEVOX_API_URL not configured')
      ) {
        ttsWarning = 'TTS is not configured, reply text returned without audio';
      } else {
        console.error('Kaiwa TTS error (chat):', ttsError);
        ttsWarning = 'TTS is unavailable, reply text returned without audio';
      }
    }

    res.json({
      reply: aiResult.reply,
      character: aiResult.characterName,
      audioUrl: ttsResult.audioUrl,
      audioMimeType: ttsResult.audioMimeType,
      visemes: ttsResult.visemes,
      ttsWarning,
      degraded: Boolean(ttsWarning),
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Kaiwa chat error:', err);
    res.status(500).json({ 
      message: 'Server error',
      reply: 'ごめんなさい、今ちょっと問題があります。もう一度試してください。'
    });
  }
});

app.post('/api/kaiwa/voice-turn', async (req, res) => {
  let transcript = null;
  try {
    const { character, conversationHistory = [], topic = '', audioBase64, mimeType, ttsOptions = {} } = req.body;

    if (!character || !audioBase64) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    transcript = await transcribeAudioWithWhisper({ audioBuffer, mimeType });

    let llmWarning = null;
    let aiResult;
    try {
      aiResult = await generateKaiwaReply({
        character,
        userMessage: transcript,
        conversationHistory,
        topic
      });
    } catch (llmError) {
      console.error('Kaiwa LLM error (voice-turn):', llmError);
      const fallbackCharacter = kaiwaCharacters.find((char) => char.id === character.id) || kaiwaCharacters[0];
      llmWarning = 'LLM is unavailable, fallback reply was used';
      aiResult = {
        reply: '今はAI応答が不安定です。あなたの発話は認識できました。もう一度試してみましょう。',
        characterName: fallbackCharacter.name,
        selectedCharacter: fallbackCharacter
      };
    }

    let ttsResult = {
      audioUrl: null,
      audioMimeType: null,
      visemes: []
    };

    let ttsWarning = null;
    try {
      ttsResult = await synthesizeSpeech({
        text: aiResult.reply,
        character: aiResult.selectedCharacter,
        ttsOptions
      });
    } catch (ttsError) {
      if (
        ttsError.message.includes('FISH_SPEECH_API_URL not configured') ||
        ttsError.message.includes('VOICEVOX_API_URL not configured')
      ) {
        ttsWarning = 'TTS is not configured, reply text returned without audio';
      } else {
        console.error('Kaiwa TTS error (voice-turn):', ttsError);
        ttsWarning = 'TTS is unavailable, reply text returned without audio';
      }
    }

    res.json({
      transcript,
      reply: aiResult.reply,
      character: aiResult.characterName,
      audioUrl: ttsResult.audioUrl,
      audioMimeType: ttsResult.audioMimeType,
      visemes: ttsResult.visemes,
      llmWarning,
      ttsWarning,
      degraded: Boolean(llmWarning || ttsWarning),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Kaiwa voice-turn error:', err);
    const statusCode = (
      err.message.includes('OPENAI_API_KEY') ||
      err.message.includes('FISH_SPEECH_API_URL') ||
      err.message.includes('VOICEVOX_API_URL') ||
      err.message.includes('not configured')
    ) ? 501 : (
      err.message.includes('ASR endpoint unreachable') ? 503 : (
        err.message.includes('No speech detected from ASR input') ? 422 : 500
      )
    );

    res.status(statusCode).json({
      message: 'Voice mode is not fully configured',
      error: err.message,
      transcript
    });
  }
});

app.get('/api/kaiwa/voice-status', (req, res) => {
  const status = getVoiceConfigStatus();
  const missing = [];

  if (!status.asr.configured) {
    missing.push('ASR API key (OPENAI_API_KEY or ASR_API_KEY)');
  }
  if (!status.llm.configured) {
    missing.push('GEMINI_API_KEY');
  }
  if (!status.tts.configured) {
    missing.push('FISH_SPEECH_API_URL');
  }

  res.json({
    ...status,
    ready: status.asr.configured && status.llm.configured && status.tts.configured,
    missing
  });
});

// Khởi động server Express
app.listen(port, () => {
  console.log(`Backend server đang chạy tại http://localhost:${port}`);
  console.log(`PostgreSQL target: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log('Environment variables loaded:', {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Not set',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'Set' : 'Not set'
  });
  
  // Test database connection
  db.query('SELECT 1').then(async () => {
    await ensureOwnershipSchema();
    await ensureGameRecordsSchema();
    await ensureCalendarTokensSchema();
    console.log('✅ Database connection successful');
    console.log('✅ Ownership schema is ready (kanji/vocabulary per user)');
    console.log('✅ Game records schema is ready (personal best per game)');
    console.log('✅ Calendar token schema is ready (Google Calendar integration)');
  }).catch(err => {
    console.error(`❌ Database connection failed (${dbConfig.host}:${dbConfig.port}):`, err.message);
    console.error('If using Docker Compose, start Postgres with: docker compose up -d db');
  });
});
