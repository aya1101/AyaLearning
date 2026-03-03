const { Pool } = require('pg');

const db = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5433,
  database: 'japanese_learning'
});

const vocabData = [
  { word_jp: '来る', word_kana: 'くる', word_romaji: 'kuru', meaning_vi: 'đến', meaning_en: 'To come', pos: 'verb', jlpt: 'N5' },
  { word_jp: '行く', word_kana: 'いく', word_romaji: 'iku', meaning_vi: 'đi', meaning_en: 'To go', pos: 'verb', jlpt: 'N5' },
  { word_jp: '飲む', word_kana: 'のむ', word_romaji: 'nomu', meaning_vi: 'uống', meaning_en: 'To drink', pos: 'verb', jlpt: 'N5' },
  { word_jp: '食べる', word_kana: 'たべる', word_romaji: 'taberu', meaning_vi: 'ăn', meaning_en: 'To eat', pos: 'verb', jlpt: 'N5' },
  { word_jp: '日本', word_kana: 'にほん', word_romaji: 'nihon', meaning_vi: 'Nhật Bản', meaning_en: 'Japan', pos: 'noun', jlpt: 'N5' },
  { word_jp: '先生', word_kana: 'せんせい', word_romaji: 'sensei', meaning_vi: 'thầy cô', meaning_en: 'Teacher', pos: 'noun', jlpt: 'N5' },
  { word_jp: '学生', word_kana: 'がくせい', word_romaji: 'gakusei', meaning_vi: 'học sinh', meaning_en: 'Student', pos: 'noun', jlpt: 'N5' },
  { word_jp: 'さようなら', word_kana: 'さようなら', word_romaji: 'sayounara', meaning_vi: 'tạm biệt', meaning_en: 'Goodbye', pos: 'interjection', jlpt: 'N5' },
  { word_jp: 'ありがとう', word_kana: 'ありがとう', word_romaji: 'arigatou', meaning_vi: 'cảm ơn', meaning_en: 'Thank you', pos: 'interjection', jlpt: 'N5' },
  { word_jp: 'こんにちは', word_kana: 'こんにちは', word_romaji: 'konnichiwa', meaning_vi: 'xin chào', meaning_en: 'Hello (daytime)', pos: 'interjection', jlpt: 'N5' }
];

async function importVocab() {
  try {
    await db.query('DELETE FROM vocabulary');
    
    for (const vocab of vocabData) {
      await db.query(
        'INSERT INTO vocabulary (word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [vocab.word_jp, vocab.word_kana, vocab.word_romaji, vocab.meaning_vi, vocab.meaning_en, vocab.pos, vocab.jlpt]
      );
    }
    
    const result = await db.query('SELECT COUNT(*) as count FROM vocabulary');
    console.log(`✅ Imported ${result.rows[0].count} vocabulary items successfully!`);
    
    const check = await db.query('SELECT word_jp, word_kana, meaning_en FROM vocabulary LIMIT 3');
    console.log('Sample data:', check.rows);
    
    await db.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

importVocab();
