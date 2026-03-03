// Import data from CSV files to PostgreSQL database
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Pool } = require('pg');
const wanakana = require('wanakana');

// Database connection
const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'japanese_learning',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5433,
});

// Get first character of kana string
const getFirstChar = (kana) => {
  if (!kana) return '';
  return kana.charAt(0);
};

// Get last character of kana string
const getLastChar = (kana) => {
  if (!kana) return '';
  return kana.charAt(kana.length - 1);
};

// Convert JLPT level string to number (N5 -> 5, N4 -> 4, etc.)
const convertJLPTLevel = (levelStr) => {
  if (!levelStr) return null;
  const match = levelStr.match(/N(\d)/);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
};

// Convert kana to romaji using wanakana
const toRomaji = (kana) => {
  if (!kana) return '';
  try {
    return wanakana.toRomaji(kana, { upcaseKatakana: false });
  } catch (err) {
    console.error(`Error converting ${kana}:`, err);
    return kana;
  }
};

// Import data from CSV files
const importData = async () => {
  try {
    console.log('🚀 Starting data import...');

    // Dictionary folder path
    const dictionaryPath = path.join(__dirname, '../frontend/public/dictionary');

    // JLPT level files to import
    const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
    
    // Keep track of imported words to avoid duplicates
    const importedWords = new Set();
    let totalImported = 0;

    for (const level of levels) {
      const csvFile = path.join(dictionaryPath, `${level}.csv`);
      
      if (!fs.existsSync(csvFile)) {
        console.log(`⚠️  File not found: ${csvFile}`);
        continue;
      }

      console.log(`\n📖 Processing ${level.toUpperCase()} level...`);

      const words = [];

      // Read CSV file
      await new Promise((resolve, reject) => {
        fs.createReadStream(csvFile)
          .pipe(csv())
          .on('data', (row) => {
            try {
              const { kanji, kana, waller_definition } = row;

              // Skip if kana is empty
              if (!kana || kana.trim() === '') {
                return;
              }

              // Create unique key to avoid duplicates within same level
              const uniqueKey = `${kanji || ''}-${kana}`;
              if (importedWords.has(uniqueKey)) {
                return;
              }

              importedWords.add(uniqueKey);

              // Prepare word data
              const word = {
                kanji: kanji && kanji.trim() ? kanji.trim() : null,
                kana: kana.trim(),
                romaji: toRomaji(kana.trim()),
                first_kana: getFirstChar(kana.trim()),
                last_kana: getLastChar(kana.trim()),
                jlpt_level: convertJLPTLevel(level.toUpperCase()),
                meaning: waller_definition || 'N/A'
              };

              words.push(word);
            } catch (err) {
              console.error('Error processing row:', err);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      console.log(`  Found ${words.length} unique words in ${level.toUpperCase()}`);

      // Insert words into database
      for (const word of words) {
        try {
          // Check if word already exists
          const checkQuery = `
            SELECT id FROM words 
            WHERE kana = $1 AND jlpt_level = $2
            LIMIT 1
          `;
          const checkResult = await db.query(checkQuery, [word.kana, word.jlpt_level]);

          // Skip if already exists
          if (checkResult.rows.length > 0) {
            continue;
          }

          // Insert into words table
          const wordQuery = `
            INSERT INTO words (kanji, kana, romaji, first_kana, last_kana, jlpt_level)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `;

          const wordResult = await db.query(wordQuery, [
            word.kanji,
            word.kana,
            word.romaji,
            word.first_kana,
            word.last_kana,
            word.jlpt_level
          ]);

          if (wordResult.rows.length > 0) {
            const wordId = wordResult.rows[0].id;

            // Insert meaning
            const meaningQuery = `
              INSERT INTO meanings (word_id, meaning_vi)
              VALUES ($1, $2)
            `;

            await db.query(meaningQuery, [wordId, word.meaning]);
            totalImported++;

            if (totalImported % 500 === 0) {
              console.log(`  ✓ Imported ${totalImported} words...`);
            }
          }
        } catch (err) {
          console.error(`Error importing word "${word.kana}":`, err.message);
        }
      }

      console.log(`  ✅ Imported ${words.length} words from ${level.toUpperCase()}`);
    }

    console.log(`\n✅ Import complete! Total words imported: ${totalImported}`);

    // Print statistics
    const stats = await db.query(`
      SELECT 
        jlpt_level,
        COUNT(*) as count
      FROM words
      GROUP BY jlpt_level
      ORDER BY jlpt_level
    `);

    console.log('\n📊 Database Statistics:');
    console.log('═══════════════════════');
    for (const row of stats.rows) {
      console.log(`  ${row.jlpt_level}: ${row.count} words`);
    }

    await db.end();
  } catch (err) {
    console.error('❌ Import failed:', err);
    process.exit(1);
  }
};

// Run import
importData();
