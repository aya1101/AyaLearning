const express = require('express');
const router = express.Router();

// Example middleware for database connection (you'll need to set this up)
// const db = require('../config/database');

// Kanji routes
router.get('/kanji', async (req, res) => {
  try {
    // Get all kanji from database
    // const kanji = await db.query('SELECT * FROM kanji ORDER BY id DESC');
    // res.json(kanji);
    
    // Temporary response until database is set up
    res.json([]);
  } catch (error) {
    console.error('Error fetching kanji:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/kanji', async (req, res) => {
  try {
    const { kanji_char, han_tu, onyomi, kunyomi, meaning, level } = req.body;
    
    // Validation
    if (!kanji_char || !han_tu || !meaning) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Insert kanji to database
    // const result = await db.query(
    //   'INSERT INTO kanji (kanji_char, han_tu, onyomi, kunyomi, meaning, level) VALUES (?, ?, ?, ?, ?, ?)',
    //   [kanji_char, han_tu, onyomi, kunyomi, meaning, level]
    // );
    
    // Temporary response
    const newKanji = {
      id: Date.now(),
      kanji_char,
      han_tu,
      onyomi: onyomi || '',
      kunyomi: kunyomi || '',
      meaning,
      level
    };
    
    res.status(201).json(newKanji);
  } catch (error) {
    console.error('Error adding kanji:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Vocabulary routes
router.get('/vocabulary', async (req, res) => {
  try {
    // Get all vocabulary from database
    // const vocabulary = await db.query('SELECT * FROM vocabulary ORDER BY id DESC');
    // res.json(vocabulary);
    
    // Temporary response until database is set up
    res.json([]);
  } catch (error) {
    console.error('Error fetching vocabulary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/vocabulary', async (req, res) => {
  try {
    // Accept both old and new field names for compatibility
    const {
      word_jp, word_kana, word_romaji, meaning_vi, meaning_en, part_of_speech, jlpt_level,
      word, furigana, meaning, level
    } = req.body;

    // Prefer new fields if present
    const _word = word_jp || word;
    const _furigana = word_kana || furigana;
    const _meaning = meaning_vi || meaning;
    const _level = jlpt_level || level;

    // Validation
    if (!_word || !_furigana || !_meaning) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Temporary response (simulate DB)
    const newVocabulary = {
      id: Date.now(),
      word: _word,
      furigana: _furigana,
      romaji: word_romaji || '',
      meaning: _meaning,
      meaning_en: meaning_en || '',
      part_of_speech: part_of_speech || '',
      level: _level || '',
    };

    res.status(201).json(newVocabulary);
  } catch (error) {
    console.error('Error adding vocabulary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Chat route
router.post('/chat', async (req, res) => {
  try {
    const { message, role } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }
    
    // Use Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return res.status(500).json({ message: 'API configuration error' });
    }

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
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

module.exports = router;
