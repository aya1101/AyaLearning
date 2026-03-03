-- ============================================================
-- AYALEARNING JAPANESE LEARNING GAME DATABASE
-- PostgreSQL Schema
-- Includes: User Auth, Learning Progress, Game Data
-- Created: 2026-02-24
-- ============================================================

-- ========= EXTENSIONS =========
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ========= DROP EXISTING TABLES (Clean reinstall) =========
DROP TABLE IF EXISTS game_set_words CASCADE;
DROP TABLE IF EXISTS game_word_sets CASCADE;
DROP TABLE IF EXISTS kanji_radicals CASCADE;
DROP TABLE IF EXISTS radicals CASCADE;
DROP TABLE IF EXISTS kanji_chars CASCADE;
DROP TABLE IF EXISTS karuta_cards CASCADE;
DROP TABLE IF EXISTS word_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS meanings CASCADE;
DROP TABLE IF EXISTS words CASCADE;
DROP TABLE IF EXISTS study_sessions CASCADE;
DROP TABLE IF EXISTS study_progress CASCADE;
DROP TABLE IF EXISTS exam_goals CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS kanji CASCADE;
DROP TABLE IF EXISTS vocabulary CASCADE;

-- ========= ENUM TYPES =========
CREATE TYPE pos_enum AS ENUM (
  'noun',
  'verb',
  'adjective',
  'adverb',
  'expression',
  'particle',
  'other'
);

CREATE TYPE game_type_enum AS ENUM (
  'shiritori',
  'karuta',
  'fukuwarai'
);

-- ============================================================
-- AUTHENTICATION & USER MANAGEMENT
-- ============================================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  preferred_level VARCHAR(10),
  theme VARCHAR(20) DEFAULT 'light',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exam_goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_exam_date DATE NOT NULL,
  target_level VARCHAR(10),
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CORE DICTIONARY & LEARNING DATA
-- ============================================================

-- Basic kanji table (simple, for quick access)
CREATE TABLE kanji (
  id SERIAL PRIMARY KEY,
  character VARCHAR(10) NOT NULL,
  onyomi VARCHAR(100),
  kunyomi VARCHAR(100),
  meaning_vi TEXT,
  meaning_en TEXT,
  strokes INTEGER,
  jlpt_level VARCHAR(10),
  example_word VARCHAR(100),
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Basic vocabulary table (simple, for quick access)
CREATE TABLE vocabulary (
  id SERIAL PRIMARY KEY,
  word_jp VARCHAR(100) NOT NULL,
  word_kana VARCHAR(100),
  word_romaji VARCHAR(100),
  meaning_vi TEXT NOT NULL,
  meaning_en TEXT,
  part_of_speech VARCHAR(50),
  jlpt_level VARCHAR(10),
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Advanced words table (for game data)
CREATE TABLE words (
  id SERIAL PRIMARY KEY,
  kanji TEXT,
  kana TEXT NOT NULL,
  romaji TEXT,
  first_kana TEXT NOT NULL,
  last_kana TEXT NOT NULL,
  jlpt_level SMALLINT CHECK (jlpt_level BETWEEN 1 AND 5),
  frequency INT DEFAULT 0,
  is_common BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kana, jlpt_level)
);

-- Word meanings (supports multiple meanings per word)
CREATE TABLE meanings (
  id SERIAL PRIMARY KEY,
  word_id INT REFERENCES words(id) ON DELETE CASCADE,
  meaning_vi TEXT NOT NULL,
  part_of_speech pos_enum DEFAULT 'other'
);

-- Tag system for flexible categorization
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE
);

CREATE TABLE word_tags (
  word_id INT REFERENCES words(id) ON DELETE CASCADE,
  tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (word_id, tag_id)
);

-- ============================================================
-- KARUTA GAME DATA
-- ============================================================

CREATE TABLE karuta_cards (
  id SERIAL PRIMARY KEY,
  reading_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  audio_url TEXT,
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- KANJI + RADICAL SYSTEM (FUKUWARAI MODE)
-- ============================================================

-- Detailed kanji character table
CREATE TABLE kanji_chars (
  id SERIAL PRIMARY KEY,
  character CHAR(1) UNIQUE NOT NULL,
  meaning_vi TEXT,
  on_reading TEXT,
  kun_reading TEXT,
  stroke_count SMALLINT,
  jlpt_level SMALLINT CHECK (jlpt_level BETWEEN 1 AND 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Radical/component system
CREATE TABLE radicals (
  id SERIAL PRIMARY KEY,
  radical TEXT UNIQUE NOT NULL
);

CREATE TABLE kanji_radicals (
  kanji_id INT REFERENCES kanji_chars(id) ON DELETE CASCADE,
  radical_id INT REFERENCES radicals(id) ON DELETE CASCADE,
  PRIMARY KEY (kanji_id, radical_id)
);

-- ============================================================
-- GAME WORD SETS (FOR EVENTS / CUSTOM MODES)
-- ============================================================

CREATE TABLE game_word_sets (
  id SERIAL PRIMARY KEY,
  game_type game_type_enum NOT NULL,
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_set_words (
  set_id INT REFERENCES game_word_sets(id) ON DELETE CASCADE,
  word_id INT REFERENCES words(id) ON DELETE CASCADE,
  PRIMARY KEY (set_id, word_id)
);

-- ============================================================
-- LEARNING PROGRESS & STATISTICS
-- ============================================================

CREATE TABLE study_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kanji_id INTEGER REFERENCES kanji(id) ON DELETE SET NULL,
  vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE SET NULL,
  is_learned BOOLEAN DEFAULT FALSE,
  times_reviewed INTEGER DEFAULT 0,
  accuracy_percentage DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, kanji_id),
  UNIQUE(user_id, vocabulary_id)
);

CREATE TABLE study_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_type VARCHAR(50),
  duration_minutes INTEGER,
  items_studied INTEGER,
  accuracy_percentage DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_game_records (
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
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- User indexes
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_exam_goals_user_id ON exam_goals(user_id);
CREATE INDEX idx_exam_goals_target_date ON exam_goals(target_exam_date);

-- Kanji & vocabulary indexes
CREATE INDEX idx_kanji_character ON kanji(character);
CREATE INDEX idx_kanji_jlpt_level ON kanji(jlpt_level);
CREATE INDEX idx_kanji_created_by_user_id ON kanji(created_by_user_id);
CREATE UNIQUE INDEX idx_kanji_character_owner ON kanji(character, created_by_user_id);
CREATE INDEX idx_vocabulary_word_jp ON vocabulary(word_jp);
CREATE INDEX idx_vocabulary_jlpt_level ON vocabulary(jlpt_level);
CREATE INDEX idx_vocabulary_created_by_user_id ON vocabulary(created_by_user_id);

-- Words (game data) indexes
CREATE INDEX idx_words_first_kana ON words(first_kana);
CREATE INDEX idx_words_jlpt ON words(jlpt_level);
CREATE INDEX idx_words_kana_trgm ON words USING gin (kana gin_trgm_ops);
CREATE INDEX idx_meanings_word_id ON meanings(word_id);

-- Game indexes
CREATE INDEX idx_karuta_difficulty ON karuta_cards(difficulty);
CREATE INDEX idx_kanji_chars_jlpt ON kanji_chars(jlpt_level);
CREATE INDEX idx_game_word_sets_type ON game_word_sets(game_type);

-- Learning progress indexes
CREATE INDEX idx_study_progress_user_id ON study_progress(user_id);
CREATE INDEX idx_study_progress_kanji_id ON study_progress(kanji_id);
CREATE INDEX idx_study_progress_vocabulary_id ON study_progress(vocabulary_id);
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_created_at ON study_sessions(created_at);
CREATE INDEX idx_user_game_records_user_id ON user_game_records(user_id);
CREATE INDEX idx_user_game_records_game_type ON user_game_records(game_type);

-- ============================================================
-- SAMPLE DATA - KANJI
-- ============================================================

INSERT INTO kanji (character, onyomi, kunyomi, meaning_vi, meaning_en, strokes, jlpt_level, example_word) VALUES
('日', 'ニチ、ジツ', 'ひ、か', 'Mặt trời, ngày', 'Sun, day', 4, 'N5', '日本'),
('本', 'ホン', 'もと', 'Gốc, sách', 'Origin, book', 5, 'N5', '日本'),
('人', 'ジン、ニン', 'ひと', 'Người', 'Person', 2, 'N5', '日本人'),
('月', 'ゲツ、ガツ', 'つき', 'Tháng, mặt trăng', 'Month, moon', 4, 'N5', '一月'),
('火', 'カ', 'ひ', 'Lửa', 'Fire', 4, 'N5', '火曜日'),
('水', 'スイ', 'みず', 'Nước', 'Water', 4, 'N5', '水曜日'),
('木', 'モク、ボク', 'き', 'Cây', 'Tree, wood', 4, 'N5', '木曜日'),
('金', 'キン、コン', 'かね', 'Vàng, tiền', 'Gold, money', 8, 'N5', '金曜日'),
('土', 'ド、ト', 'つち', 'Đất', 'Earth, soil', 3, 'N5', '土曜日'),
('学', 'ガク', 'まな-ぶ', 'Học', 'Study, learning', 8, 'N5', '学生');

-- ============================================================
-- SAMPLE DATA - VOCABULARY
-- ============================================================

INSERT INTO vocabulary (word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level) VALUES
('こんにちは', 'こんにちは', 'konnichiwa', 'Xin chào (ban ngày)', 'Hello (daytime)', 'Greeting', 'N5'),
('ありがとう', 'ありがとう', 'arigatou', 'Cảm ơn', 'Thank you', 'Expression', 'N5'),
('さようなら', 'さようなら', 'sayounara', 'Tạm biệt', 'Goodbye', 'Greeting', 'N5'),
('学生', 'がくせい', 'gakusei', 'Học sinh, sinh viên', 'Student', 'Noun', 'N5'),
('先生', 'せんせい', 'sensei', 'Giáo viên', 'Teacher', 'Noun', 'N5'),
('日本', 'にほん', 'nihon', 'Nhật Bản', 'Japan', 'Noun', 'N5'),
('食べる', 'たべる', 'taberu', 'Ăn', 'To eat', 'Verb', 'N5'),
('飲む', 'のむ', 'nomu', 'Uống', 'To drink', 'Verb', 'N5'),
('行く', 'いく', 'iku', 'Đi', 'To go', 'Verb', 'N5'),
('来る', 'くる', 'kuru', 'Đến', 'To come', 'Verb', 'N5');

-- ============================================================
-- AUTO-UPDATE TIMESTAMP FUNCTION & TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kanji_updated_at BEFORE UPDATE ON kanji
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vocabulary_updated_at BEFORE UPDATE ON vocabulary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exam_goals_updated_at BEFORE UPDATE ON exam_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_study_progress_updated_at BEFORE UPDATE ON study_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
SELECT 'Database schema with game data created successfully!' AS status;
