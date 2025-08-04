// server.js - Backend Server for Japanese Learning App

// Import các thư viện cần thiết
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

// Khởi tạo ứng dụng Express
const app = express();
const port = process.env.PORT || 3001;

// --- CẢI TIẾN: SỬ DỤNG CONNECTION POOL THAY VÌ SINGLE CONNECTION ---
// createPool quản lý một nhóm kết nối, giúp tăng hiệu suất và ổn định.
// .promise() cho phép sử dụng cú pháp async/await hiện đại, giúp code sạch hơn.
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Mặc định là rỗng cho MySQL trên XAMPP
  database: 'japanese_learning',
  waitForConnections: true, // Chờ nếu tất cả kết nối đang bận
  connectionLimit: 10,      // Số kết nối tối đa trong pool
  queueLimit: 0             // Không giới hạn hàng chờ
}).promise();

// Middleware
app.use(cors());       // Cho phép tất cả các domain truy cập API (cho mục đích phát triển)
app.use(express.json()); // Cho phép Express đọc và phân tích JSON từ body của request

// --- API Endpoints cho Kanji ---

// Lấy tất cả Kanji
// CẢI TIẾN: Sử dụng async/await cho code dễ đọc hơn
app.get('/api/kanji', async (req, res) => {
  try {
    const query = 'SELECT * FROM kanji ORDER BY id DESC';
    const [results] = await db.query(query);
    res.json(results);
  } catch (err) {
    console.error('Lỗi khi lấy Kanji:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy Kanji.' });
  }
});

// Thêm Kanji mới
app.post('/api/kanji', async (req, res) => {
  try {
    const { kanji_char, han_tu, onyomi, kunyomi, meaning, level } = req.body;

    // Validate dữ liệu đầu vào (cơ bản)
    if (!kanji_char || !han_tu || !meaning || !level) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }

    const query = 'INSERT INTO kanji (kanji_char, han_tu, onyomi, kunyomi, meaning, level) VALUES (?, ?, ?, ?, ?, ?)';
    const [result] = await db.query(query, [kanji_char, han_tu, onyomi, kunyomi, meaning, level]);

    res.status(201).json({ id: result.insertId, ...req.body, message: 'Kanji đã được thêm thành công.' });
  } catch (err) {
    console.error('Lỗi khi thêm Kanji:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        message: 'Kanji này đã tồn tại.', 
        code: 'ER_DUP_ENTRY' 
      });
    }
    res.status(500).json({ message: 'Lỗi máy chủ khi thêm Kanji.' });
  }
});

// Cập nhật Kanji
app.put('/api/kanji/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { kanji_char, han_tu, onyomi, kunyomi, meaning, level } = req.body;

    console.log('Updating kanji with ID:', id, 'Data:', req.body);

    // Validate dữ liệu đầu vào
    if (!kanji_char || !han_tu || !meaning || !level) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }

    // Kiểm tra kanji có tồn tại không
    const checkQuery = 'SELECT * FROM kanji WHERE id = ?';
    const [checkResult] = await db.query(checkQuery, [id]);
    
    if (checkResult.length === 0) {
      return res.status(404).json({ message: 'Kanji không tồn tại.' });
    }

    const updateQuery = 'UPDATE kanji SET kanji_char = ?, han_tu = ?, onyomi = ?, kunyomi = ?, meaning = ?, level = ? WHERE id = ?';
    const [result] = await db.query(updateQuery, [kanji_char, han_tu, onyomi || '', kunyomi || '', meaning, level, id]);

    console.log('Update result:', result);

    res.status(200).json({ 
      id: parseInt(id), 
      kanji_char,
      han_tu,
      onyomi: onyomi || '',
      kunyomi: kunyomi || '',
      meaning,
      level,
      message: 'Kanji đã được cập nhật thành công.' 
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật Kanji:', err);
    res.status(500).json({ 
      message: 'Lỗi máy chủ khi cập nhật Kanji.', 
      error: err.message 
    });
  }
});

// Xóa Kanji
app.delete('/api/kanji/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('=== DELETING KANJI ===');
    console.log('Deleting kanji with ID:', id);

    // Kiểm tra kanji có tồn tại không
    const checkQuery = 'SELECT * FROM kanji WHERE id = ?';
    const [checkResult] = await db.query(checkQuery, [id]);
    
    console.log('Check result:', checkResult);

    if (checkResult.length === 0) {
      console.log('Kanji not found in database');
      return res.status(404).json({ message: 'Kanji không tồn tại.' });
    }

    // Thực sự xóa từ database
    const deleteQuery = 'DELETE FROM kanji WHERE id = ?';
    const [result] = await db.query(deleteQuery, [id]);
    
    console.log('Delete result:', result);
    console.log('Affected rows:', result.affectedRows);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Kanji không tồn tại hoặc đã bị xóa.' });
    }

    // Verify deletion
    const verifyQuery = 'SELECT * FROM kanji WHERE id = ?';
    const [verifyResult] = await db.query(verifyQuery, [id]);
    console.log('Verify after delete:', verifyResult.length === 0 ? 'DELETED' : 'STILL EXISTS');

    console.log('Kanji deleted successfully from database');
    res.status(200).json({ 
      message: 'Kanji đã được xóa thành công.',
      deletedId: parseInt(id),
      affectedRows: result.affectedRows,
      success: true
    });
  } catch (err) {
    console.error('Lỗi khi xóa Kanji:', err);
    res.status(500).json({ 
      message: 'Lỗi máy chủ khi xóa Kanji.', 
      error: err.message 
    });
  }
});

// --- API Endpoints cho Từ Vựng (goi) ---

// Lấy tất cả Từ vựng
app.get('/api/vocabulary', async (req, res) => {
  try {
    const query = 'SELECT * FROM goi ORDER BY id DESC';
    const [results] = await db.query(query);
    res.json(results);
  } catch (err) {
    console.error('Lỗi khi lấy Từ vựng:', err);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy Từ vựng.' });
  }
});

// Thêm Từ vựng mới
app.post('/api/vocabulary', async (req, res) => {
  try {
    const { word, furigana, meaning, level } = req.body;
    
    // CẢI TIẾN: Tạo ngày thêm ở phía server để đảm bảo tính chính xác
    const added_date = new Date();

    // Validate dữ liệu
    if (!word || !furigana || !meaning || !level) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }

    const query = 'INSERT INTO goi (word, furigana, meaning, added_date, level) VALUES (?, ?, ?, ?, ?)';
    const [result] = await db.query(query, [word, furigana, meaning, added_date, level]);

    res.status(201).json({ id: result.insertId, ...req.body, added_date, message: 'Từ vựng đã được thêm thành công.' });
  } catch (err) {
    console.error('Lỗi khi thêm Từ vựng:', err);
    // CẢI TIẾN: Thêm kiểm tra lỗi trùng lặp cho từ vựng
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ 
          message: 'Từ vựng này đã tồn tại.', 
          code: 'ER_DUP_ENTRY' 
        });
    }
    res.status(500).json({ message: 'Lỗi máy chủ khi thêm Từ vựng.' });
  }
});

// Cập nhật Từ vựng
app.put('/api/vocabulary/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { word, furigana, meaning, level } = req.body;

    console.log('Updating vocabulary with ID:', id, 'Data:', req.body);

    // Validate dữ liệu đầu vào
    if (!word || !furigana || !meaning || !level) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }

    // Kiểm tra từ vựng có tồn tại không
    const checkQuery = 'SELECT * FROM goi WHERE id = ?';
    const [checkResult] = await db.query(checkQuery, [id]);
    
    if (checkResult.length === 0) {
      return res.status(404).json({ message: 'Từ vựng không tồn tại.' });
    }

    const updateQuery = 'UPDATE goi SET word = ?, furigana = ?, meaning = ?, level = ? WHERE id = ?';
    const [result] = await db.query(updateQuery, [word, furigana, meaning, level, id]);

    console.log('Update result:', result);

    res.status(200).json({ 
      id: parseInt(id), 
      word, 
      furigana, 
      meaning, 
      level,
      added_date: checkResult[0].added_date, // Giữ nguyên ngày thêm cũ
      message: 'Từ vựng đã được cập nhật thành công.' 
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật Từ vựng:', err);
    res.status(500).json({ 
      message: 'Lỗi máy chủ khi cập nhật Từ vựng.', 
      error: err.message 
    });
  }
});

// Xóa Từ vựng
app.delete('/api/vocabulary/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('=== DELETING VOCABULARY ===');
    console.log('Deleting vocabulary with ID:', id);

    // Kiểm tra từ vựng có tồn tại không
    const checkQuery = 'SELECT * FROM goi WHERE id = ?';
    const [checkResult] = await db.query(checkQuery, [id]);
    
    console.log('Check result:', checkResult);

    if (checkResult.length === 0) {
      console.log('Vocabulary not found in database');
      return res.status(404).json({ message: 'Từ vựng không tồn tại.' });
    }

    // Thực sự xóa từ database
    const deleteQuery = 'DELETE FROM goi WHERE id = ?';
    const [result] = await db.query(deleteQuery, [id]);
    
    console.log('Delete result:', result);
    console.log('Affected rows:', result.affectedRows);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Từ vựng không tồn tại hoặc đã bị xóa.' });
    }

    // Verify deletion
    const verifyQuery = 'SELECT * FROM goi WHERE id = ?';
    const [verifyResult] = await db.query(verifyQuery, [id]);
    console.log('Verify after delete:', verifyResult.length === 0 ? 'DELETED' : 'STILL EXISTS');

    console.log('Vocabulary deleted successfully from database');
    res.status(200).json({ 
      message: 'Từ vựng đã được xóa thành công.',
      deletedId: parseInt(id),
      affectedRows: result.affectedRows,
      success: true
    });
  } catch (err) {
    console.error('Lỗi khi xóa Từ vựng:', err);
    res.status(500).json({ 
      message: 'Lỗi máy chủ khi xóa Từ vựng.', 
      error: err.message 
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
    
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Khởi động server Express
app.listen(port, () => {
  console.log(`Backend server đang chạy tại http://localhost:${port}`);
  console.log('Đảm bảo XAMPP (Apache và MySQL) đang chạy.');
  console.log(`Health check: http://localhost:${port}/health`);
  console.log('Environment variables loaded:', {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Not set'
  });
  
  // Test database connection
  db.query('SELECT 1').then(() => {
    console.log('✅ Database connection successful');
  }).catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });
});
