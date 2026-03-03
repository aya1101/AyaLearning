// Shiritori game utilities with proper hiragana normalization

// Map Romanji to Hiragana
const romanjiToHiragana = {
  // Vowels
  'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
  // K sounds
  'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
  'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
  // S sounds
  'sa': 'さ', 'si': 'し', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
  'za': 'ざ', 'zi': 'じ', 'ji': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
  // T sounds
  'ta': 'た', 'ti': 'ち', 'chi': 'ち', 'tu': 'つ', 'tsu': 'つ', 'te': 'て', 'to': 'と',
  'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
  // N sounds
  'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
  // H sounds
  'ha': 'は', 'hi': 'ひ', 'hu': 'ふ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
  'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
  'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
  // M sounds
  'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
  // Y sounds
  'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
  // R sounds
  'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
  // W sounds
  'wa': 'わ', 'wi': 'ゐ', 'we': 'ゑ', 'wo': 'を', 'n': 'ん',
  // Palatalized (small y combinations)
  'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
  'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
  'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
  'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',
  'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
  'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
  'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
  'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
  'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
  'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
  'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ'
};

// Map Katakana to Hiragana
const katakanaToHiragana = {
  'ア': 'あ', 'イ': 'い', 'ウ': 'う', 'エ': 'え', 'オ': 'お',
  'カ': 'か', 'キ': 'き', 'ク': 'く', 'ケ': 'け', 'コ': 'こ',
  'ガ': 'が', 'ギ': 'ぎ', 'グ': 'ぐ', 'ゲ': 'げ', 'ゴ': 'ご',
  'サ': 'さ', 'シ': 'し', 'ス': 'す', 'セ': 'せ', 'ソ': 'そ',
  'ザ': 'ざ', 'ジ': 'じ', 'ズ': 'ず', 'ゼ': 'ぜ', 'ゾ': 'ぞ',
  'タ': 'た', 'チ': 'ち', 'ツ': 'つ', 'テ': 'て', 'ト': 'と',
  'ダ': 'だ', 'ヂ': 'ぢ', 'ヅ': 'づ', 'デ': 'で', 'ド': 'ど',
  'ナ': 'な', 'ニ': 'に', 'ヌ': 'ぬ', 'ネ': 'ね', 'ノ': 'の',
  'ハ': 'は', 'ヒ': 'ひ', 'フ': 'ふ', 'ヘ': 'へ', 'ホ': 'ほ',
  'バ': 'ば', 'ビ': 'び', 'ブ': 'ぶ', 'ベ': 'べ', 'ボ': 'ぼ',
  'パ': 'ぱ', 'ピ': 'ぴ', 'プ': 'ぷ', 'ペ': 'ぺ', 'ポ': 'ぽ',
  'マ': 'ま', 'ミ': 'み', 'ム': 'む', 'メ': 'め', 'モ': 'も',
  'ヤ': 'や', 'ユ': 'ゆ', 'ヨ': 'よ',
  'ラ': 'ら', 'リ': 'り', 'ル': 'る', 'レ': 'れ', 'ロ': 'ろ',
  'ワ': 'わ', 'ウィ': 'うぃ', 'ヴェ': 'ゔぇ', 'ヲ': 'を', 'ン': 'ん',
  'ッ': 'っ', 'ャ': 'ゃ', 'ュ': 'ゅ', 'ョ': 'ょ',
  'ァ': 'ぁ', 'ィ': 'ぃ', 'ゥ': 'ぅ', 'ェ': 'ぇ', 'ォ': 'ぉ'
};

// Small kana to normal kana conversion (for final character detection)
const smallToNormalKana = {
  'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
  'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ',
  'ゎ': 'わ', 'っ': 'つ'
};

/**
 * Convert romanji to hiragana
 * Handles longest match first to catch combinations like 'sha', 'chu'
 */
function convertRomanjiToHiragana(text) {
  if (!text) return '';
  
  let result = '';
  let input = text.toLowerCase();
  let i = 0;
  
  while (i < input.length) {
    let found = false;
    
    // Try 3-character combinations first (longest match)
    if (i + 3 <= input.length) {
      const threeChar = input.substring(i, i + 3);
      if (romanjiToHiragana[threeChar]) {
        result += romanjiToHiragana[threeChar];
        i += 3;
        found = true;
      }
    }
    
    // Try 2-character combinations
    if (!found && i + 2 <= input.length) {
      const twoChar = input.substring(i, i + 2);
      if (romanjiToHiragana[twoChar]) {
        result += romanjiToHiragana[twoChar];
        i += 2;
        found = true;
      }
    }
    
    // Try 1-character
    if (!found && i + 1 <= input.length) {
      const oneChar = input.substring(i, i + 1);
      if (romanjiToHiragana[oneChar]) {
        result += romanjiToHiragana[oneChar];
        i += 1;
        found = true;
      }
    }
    
    // If no match found, keep the character as is (might be kanji, etc)
    if (!found) {
      result += input[i];
      i += 1;
    }
  }
  
  return result;
}

/**
 * Detect if input is romanji or kana/kanji
 */
function detectInputType(text) {
  if (!text) return 'unknown';
  
  // Check for hiragana
  if (/[\u3040-\u309F]/.test(text)) return 'hiragana';
  
  // Check for katakana
  if (/[\u30A0-\u30FF]/.test(text)) return 'katakana';
  
  // Check for kanji
  if (/[\u4E00-\u9FFF]/.test(text)) return 'kanji';
  
  // Assume romanji if only ascii
  if (/^[a-z\s'-]+$/i.test(text)) return 'romanji';
  
  return 'mixed';
}

/**
 * Step 2: Process long vowel mark (ー)
 * Removes ー and finds the real last character
 */
function removeLongVowelMark(text) {
  // Remove all ー marks for processing
  return text.replace(/ー/g, '');
}

/**
 * Step 3: Normalize small kana to normal form (only for last character matching)
 * ゃゅょ → やゆよ
 * ぁぃぅぇぉ → あいうえお
 * This is used for ending character detection
 */
function normalizeSmallKana(char) {
  return smallToNormalKana[char] || char;
}

/**
 * Step 1: Convert all characters to hiragana
 * Converts katakana, romanji and mixed kana to pure hiragana
 */
function convertToHiragana(text) {
  if (!text) return '';
  
  // Detect input type
  const inputType = detectInputType(text);
  
  // If romanji, convert directly
  if (inputType === 'romanji') {
    return convertRomanjiToHiragana(text);
  }
  
  // If kanji + kana mix or other, process character by character
  let result = '';
  for (let char of text) {
    result += katakanaToHiragana[char] || char;
  }
  return result;
}

/**
 * Full normalization pipeline for shiritori matching
 * 1) Convert everything to hiragana
 * 2) Remove long vowel marks (ー)
 * 3) Remove spaces
 */
function normalizeKana(text) {
  if (!text) return '';

  const hiraganaText = convertToHiragana(text);
  const noLongVowels = removeLongVowelMark(hiraganaText);

  return noLongVowels.replace(/\s+/g, '').trim();
}

/**
 * Get the last character for shiritori matching
 * @param {string} text - The word in any kana form
 * @returns {string} - The normalized last character
 */
function getLastKana(text) {
  // Normalize the text
  let normalized = normalizeKana(text);
  
  if (!normalized || normalized.length === 0) {
    return null;
  }
  
  // Get the last character
  const lastChar = normalized[normalized.length - 1];
  
  // Normalize small kana if needed
  return normalizeSmallKana(lastChar);
}

/**
 * Get the first character for shiritori matching
 * @param {string} text - The word in any kana form
 * @returns {string} - The normalized first character
 */
function getFirstKana(text) {
  let normalized = normalizeKana(text);
  
  if (!normalized || normalized.length === 0) {
    return null;
  }
  
  const firstChar = normalized[0];
  return normalizeSmallKana(firstChar);
}

/**
 * Check if word ends with ん (game over condition)
 */
function endsWithN(text) {
  const normalized = normalizeKana(text);
  return normalized && normalized[normalized.length - 1] === 'ん';
}

/**
 * Validate a shiritori move
 * @param {string} newWord - The new word entered
 * @param {string} lastWordKana - The last word's kana
 * @returns {object} - { valid: boolean, message: string }
 */
function validateShiritori(newWord, lastWordKana) {
  if (!newWord) {
    return { valid: false, message: 'Please enter a word' };
  }
  
  if (endsWithN(newWord)) {
    return { valid: false, message: 'Cannot use words ending in ん' };
  }
  
  const newWordFirst = getFirstKana(newWord);
  const lastWordLast = getLastKana(lastWordKana);
  
  if (newWordFirst !== lastWordLast) {
    return { 
      valid: false, 
      message: `Word must start with 「${lastWordLast}」, not 「${newWordFirst}」` 
    };
  }
  
  return { valid: true, message: 'Valid word!' };
}

module.exports = {
  convertToHiragana,
  normalizeKana,
  getLastKana,
  getFirstKana,
  endsWithN,
  validateShiritori,
  removeLongVowelMark,
  normalizeSmallKana,
  convertRomanjiToHiragana,
  detectInputType
};
