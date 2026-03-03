-- ============================================================
-- AYALEARNING PRODUCTION BASE SCHEMA (NON-DESTRUCTIVE)
-- PostgreSQL Schema for deployment environments
-- Notes:
--  - No DROP TABLE statements
--  - No sample seed inserts
--  - Safe to run repeatedly
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pos_enum') THEN
    CREATE TYPE pos_enum AS ENUM (
      'noun',
      'verb',
      'adjective',
      'adverb',
      'expression',
      'particle',
      'other'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_type_enum') THEN
    CREATE TYPE game_type_enum AS ENUM (
      'shiritori',
      'karuta',
      'fukuwarai'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  preferred_level VARCHAR(10),
  theme VARCHAR(20) DEFAULT 'light',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_exam_date DATE NOT NULL,
  target_level VARCHAR(10),
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kanji (
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

CREATE TABLE IF NOT EXISTS vocabulary (
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

CREATE TABLE IF NOT EXISTS words (
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

CREATE TABLE IF NOT EXISTS meanings (
  id SERIAL PRIMARY KEY,
  word_id INT REFERENCES words(id) ON DELETE CASCADE,
  meaning_vi TEXT NOT NULL,
  part_of_speech pos_enum DEFAULT 'other'
);

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE
);

CREATE TABLE IF NOT EXISTS word_tags (
  word_id INT REFERENCES words(id) ON DELETE CASCADE,
  tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (word_id, tag_id)
);

CREATE TABLE IF NOT EXISTS karuta_cards (
  id SERIAL PRIMARY KEY,
  reading_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  audio_url TEXT,
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kanji_chars (
  id SERIAL PRIMARY KEY,
  character CHAR(1) UNIQUE NOT NULL,
  meaning_vi TEXT,
  on_reading TEXT,
  kun_reading TEXT,
  stroke_count SMALLINT,
  jlpt_level SMALLINT CHECK (jlpt_level BETWEEN 1 AND 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS radicals (
  id SERIAL PRIMARY KEY,
  radical TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS kanji_radicals (
  kanji_id INT REFERENCES kanji_chars(id) ON DELETE CASCADE,
  radical_id INT REFERENCES radicals(id) ON DELETE CASCADE,
  PRIMARY KEY (kanji_id, radical_id)
);

CREATE TABLE IF NOT EXISTS game_word_sets (
  id SERIAL PRIMARY KEY,
  game_type game_type_enum NOT NULL,
  difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_set_words (
  set_id INT REFERENCES game_word_sets(id) ON DELETE CASCADE,
  word_id INT REFERENCES words(id) ON DELETE CASCADE,
  PRIMARY KEY (set_id, word_id)
);

CREATE TABLE IF NOT EXISTS study_progress (
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

CREATE TABLE IF NOT EXISTS study_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_type VARCHAR(50),
  duration_minutes INTEGER,
  items_studied INTEGER,
  accuracy_percentage DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_goals_user_id ON exam_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_goals_target_date ON exam_goals(target_exam_date);

CREATE INDEX IF NOT EXISTS idx_kanji_character ON kanji(character);
CREATE INDEX IF NOT EXISTS idx_kanji_jlpt_level ON kanji(jlpt_level);
CREATE INDEX IF NOT EXISTS idx_kanji_created_by_user_id ON kanji(created_by_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kanji_character_owner ON kanji(character, created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_vocabulary_word_jp ON vocabulary(word_jp);
CREATE INDEX IF NOT EXISTS idx_vocabulary_jlpt_level ON vocabulary(jlpt_level);
CREATE INDEX IF NOT EXISTS idx_vocabulary_created_by_user_id ON vocabulary(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_words_first_kana ON words(first_kana);
CREATE INDEX IF NOT EXISTS idx_words_jlpt ON words(jlpt_level);
CREATE INDEX IF NOT EXISTS idx_words_kana_trgm ON words USING gin (kana gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_meanings_word_id ON meanings(word_id);

CREATE INDEX IF NOT EXISTS idx_karuta_difficulty ON karuta_cards(difficulty);
CREATE INDEX IF NOT EXISTS idx_kanji_chars_jlpt ON kanji_chars(jlpt_level);
CREATE INDEX IF NOT EXISTS idx_game_word_sets_type ON game_word_sets(game_type);

CREATE INDEX IF NOT EXISTS idx_study_progress_user_id ON study_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_kanji_id ON study_progress(kanji_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_vocabulary_id ON study_progress(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_created_at ON study_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_game_records_user_id ON user_game_records(user_id);
CREATE INDEX IF NOT EXISTS idx_user_game_records_game_type ON user_game_records(game_type);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_kanji_updated_at ON kanji;
DROP TRIGGER IF EXISTS update_vocabulary_updated_at ON vocabulary;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_exam_goals_updated_at ON exam_goals;
DROP TRIGGER IF EXISTS update_study_progress_updated_at ON study_progress;

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

SELECT 'Production base schema applied successfully' AS status;
