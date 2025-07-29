// server.js - Backend Server for Japanese Learning App

// Import các thư viện cần thiết
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

// Khởi tạo ứng dụng Express
const app = express();
const port = 3001;

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
      return res.status(409).json({ message: 'Kanji này đã tồn tại.' });
    }
    res.status(500).json({ message: 'Lỗi máy chủ khi thêm Kanji.' });
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
        return res.status(409).json({ message: 'Từ vựng này đã tồn tại.' });
    }
    res.status(500).json({ message: 'Lỗi máy chủ khi thêm Từ vựng.' });
  }
});

// Khởi động server Express
app.listen(port, () => {
  console.log(` Backend server đang chạy tại http://localhost:${port}`);
  console.log('Đảm bảo XAMPP (Apache và MySQL) đang chạy.');
});
