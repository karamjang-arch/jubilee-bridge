/**
 * Word DB Enrichment Script
 *
 * Adds 3 fields to word-db.json using Gemini API:
 * - famous_quote: A famous quote using the word
 * - etymology: Root/prefix/suffix breakdown + related words
 * - quiz_choices: 4-choice definition quiz
 *
 * Also adds level field based on source:
 * - Level 1: oxford_3000 (essential)
 * - Level 2: oxford_3000 (intermediate)
 * - Level 3: oxford_3000 (advanced)
 * - Level 4: word_smart_1
 * - Level 5: word_smart_2_* + word_smart_1_arts/foreign/science
 *
 * Usage:
 *   node enrich-word-db.js              # Process all unprocessed words
 *   node enrich-word-db.js --resume     # Resume from last checkpoint
 *   node enrich-word-db.js --dry-run    # Test with 5 words only
 *   node enrich-word-db.js --level-only # Only add level field, skip Gemini
 */

const fs = require('fs');
const path = require('path');
const { loadGeminiApiKey } = require('./lib/config');

// Configuration
const GEMINI_API_KEY = loadGeminiApiKey();
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const INPUT_FILE = path.join(__dirname, '../public/word-db.json');
const BACKUP_FILE = path.join(__dirname, '../public/word-db-backup.json');
const OUTPUT_FILE = path.join(__dirname, '../public/word-db.json');
const CHECKPOINT_FILE = path.join(__dirname, 'enrich-checkpoint.json');
const ERROR_LOG_FILE = path.join(__dirname, 'enrich-errors.log');

const RATE_LIMIT_MS = 4000; // 4 seconds between calls (15 RPM safe)
const MAX_RETRIES = 3;

// Level mapping based on source and difficulty
function getLevel(word) {
  const source = word.source || '';
  const difficulty = word.difficulty || '';

  if (source === 'oxford_3000') {
    if (difficulty === 'essential') return 1;
    if (difficulty === 'intermediate') return 2;
    if (difficulty === 'advanced') return 3;
    // Fallback for oxford_3000 without difficulty
    return 2;
  }

  if (source === 'word_smart_1') return 4;

  // word_smart_2_*, word_smart_1_arts/foreign/science
  if (source.startsWith('word_smart_2') ||
      source === 'word_smart_1_arts' ||
      source === 'word_smart_1_foreign' ||
      source === 'word_smart_1_science') {
    return 5;
  }

  // Default fallback
  return 3;
}

// Create Gemini prompt for a word
function createPrompt(word) {
  return `Generate learning data for the English word "${word.word}" (${word.part_of_speech}).

Return a JSON object with exactly this structure:

{
  "famous_quote": {
    "text": "Full quote text here (a sentence using the word)",
    "source": "Book or speech title",
    "author": "Author name"
  },
  "etymology": {
    "prefix": "ab- (away from)" or null,
    "root": "errare (Latin: to wander)",
    "suffix": "-tion (noun forming)" or null,
    "related_words": ["word1", "word2", "word3"]
  },
  "quiz_choices": {
    "correct": "the actual definition in ~10 words",
    "wrong": ["plausible wrong def 1", "plausible wrong def 2", "plausible wrong def 3"]
  }
}

Rules:
- famous_quote.text: Use a real literary quote if available, otherwise create a memorable example sentence with source="Example" and author="—"
- etymology.root: A single string like "errare (Latin: to wander)" — NOT a nested object
- etymology.prefix/suffix: String with meaning or null — NOT nested objects
- etymology.related_words: Exactly 3 English words sharing the same root
- quiz_choices.wrong: 3 definitions that are plausible but incorrect

Return ONLY valid JSON, no explanation.`;
}

// Normalize result to ensure correct structure
function normalizeResult(result) {
  // Ensure etymology fields are strings, not objects
  if (result.etymology) {
    for (const key of ['prefix', 'root', 'suffix']) {
      if (typeof result.etymology[key] === 'object' && result.etymology[key] !== null) {
        // Convert object to string representation
        const obj = result.etymology[key];
        if (obj.text) {
          result.etymology[key] = obj.text;
        } else if (obj.word && obj.meaning) {
          result.etymology[key] = `${obj.word} (${obj.meaning})`;
        } else if (obj.value) {
          result.etymology[key] = obj.value;
        } else {
          result.etymology[key] = JSON.stringify(obj);
        }
      }
    }
    // Ensure related_words is an array of strings
    if (result.etymology.related_words) {
      result.etymology.related_words = result.etymology.related_words.map(w =>
        typeof w === 'string' ? w : (w.word || String(w))
      );
    }
  }

  // Ensure quiz_choices.wrong is an array
  if (result.quiz_choices && !Array.isArray(result.quiz_choices.wrong)) {
    result.quiz_choices.wrong = [];
  }

  return result;
}

// Attempt to repair malformed JSON
function repairJson(str) {
  // Remove any trailing incomplete content
  let fixed = str;

  // Find the last complete closing brace
  let braceCount = 0;
  let lastValidEnd = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < fixed.length; i++) {
    const c = fixed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"' && !escape) {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === '{') braceCount++;
      if (c === '}') {
        braceCount--;
        if (braceCount === 0) lastValidEnd = i;
      }
    }
  }

  if (lastValidEnd > 0 && lastValidEnd < fixed.length - 1) {
    fixed = fixed.substring(0, lastValidEnd + 1);
  }

  // If still not valid, try to close incomplete structures
  if (braceCount > 0) {
    // Find last complete value and close
    fixed = fixed.replace(/,\s*$/, '');
    while (braceCount > 0) {
      fixed += '}';
      braceCount--;
    }
  }

  return fixed;
}

// Call Gemini API
async function callGemini(prompt, retries = 0) {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 429 && retries < MAX_RETRIES) {
        // Rate limited - wait longer and retry
        console.log(`  Rate limited, waiting 60s before retry ${retries + 1}...`);
        await sleep(60000);
        return callGemini(prompt, retries + 1);
      }
      throw new Error(`API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    // Parse JSON from response (handle possible markdown code blocks)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    }

    // Try parsing, with fallback repair
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (e) {
      // Attempt to repair common JSON issues
      const repaired = repairJson(jsonStr);
      result = JSON.parse(repaired);
    }

    // Normalize and validate the result
    return normalizeResult(result);
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.log(`  Error: ${error.message}, retry ${retries + 1}...`);
      await sleep(5000);
      return callGemini(prompt, retries + 1);
    }
    throw error;
  }
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Log error to file
function logError(word, error) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} | ${word} | ${error.message}\n`;
  fs.appendFileSync(ERROR_LOG_FILE, line);
}

// Save checkpoint
function saveCheckpoint(processedIndex, words) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    processedIndex,
    timestamp: new Date().toISOString()
  }));
  // Also save progress to output file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2));
}

// Load checkpoint
function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
  }
  return null;
}

// Main enrichment function
async function enrichWords(options = {}) {
  const { dryRun = false, resume = false, levelOnly = false } = options;

  console.log('='.repeat(50));
  console.log('Word DB Enrichment Script');
  console.log('='.repeat(50));

  // Load word database
  console.log('\nLoading word-db.json...');
  const words = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`Total words: ${words.length}`);

  // Create backup if not exists
  if (!fs.existsSync(BACKUP_FILE)) {
    console.log('Creating backup: word-db-backup.json');
    fs.copyFileSync(INPUT_FILE, BACKUP_FILE);
  }

  // Add level field to all words first
  console.log('\nAdding level field...');
  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const word of words) {
    word.level = getLevel(word);
    levelCounts[word.level]++;
  }
  console.log('Level distribution:');
  for (const [level, count] of Object.entries(levelCounts)) {
    console.log(`  Level ${level}: ${count} words`);
  }

  if (levelOnly) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2));
    console.log('\nLevel-only mode complete. Saved to word-db.json');
    return;
  }

  // Determine starting point
  let startIndex = 0;
  if (resume) {
    const checkpoint = loadCheckpoint();
    if (checkpoint) {
      startIndex = checkpoint.processedIndex + 1;
      console.log(`\nResuming from index ${startIndex} (checkpoint: ${checkpoint.timestamp})`);
    }
  }

  // Filter words to process
  const wordsToProcess = dryRun ? words.slice(0, 5) : words;
  const limit = dryRun ? 5 : words.length;

  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}Processing ${limit - startIndex} words...`);
  console.log('Rate limit: 1 request per 4 seconds (15 RPM)');
  console.log('Estimated time:', formatTime((limit - startIndex) * RATE_LIMIT_MS));
  console.log('\nStarting in 3 seconds...');
  await sleep(3000);

  // Process each word
  let successCount = 0;
  let errorCount = 0;

  for (let i = startIndex; i < limit; i++) {
    const word = wordsToProcess[i];

    // Skip if already enriched
    if (word.famous_quote && word.etymology && word.quiz_choices) {
      console.log(`[${i + 1}/${limit}] ${word.word} - already enriched, skipping`);
      successCount++;
      continue;
    }

    console.log(`[${i + 1}/${limit}] ${word.word} (${word.part_of_speech})...`);

    try {
      const prompt = createPrompt(word);
      const result = await callGemini(prompt);

      // Validate and add fields
      const missing = [];
      if (!result.famous_quote) missing.push('famous_quote');
      if (!result.etymology) missing.push('etymology');
      if (!result.quiz_choices) missing.push('quiz_choices');

      if (missing.length === 0) {
        word.famous_quote = result.famous_quote;
        word.etymology = result.etymology;
        word.quiz_choices = result.quiz_choices;
        successCount++;
        console.log(`  ✓ Success`);
      } else {
        throw new Error(`Missing fields: ${missing.join(', ')}`);
      }
    } catch (error) {
      errorCount++;
      console.log(`  ✗ Failed: ${error.message}`);
      logError(word.word, error);
    }

    // Save checkpoint every 50 words
    if ((i + 1) % 50 === 0) {
      saveCheckpoint(i, words);
      console.log(`  [Checkpoint saved at ${i + 1}]`);
    }

    // Rate limiting
    if (i < limit - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // Final save
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2));

  // Clean up checkpoint on success
  if (fs.existsSync(CHECKPOINT_FILE) && errorCount === 0) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }

  // Report
  console.log('\n' + '='.repeat(50));
  console.log('ENRICHMENT COMPLETE');
  console.log('='.repeat(50));
  console.log(`Success: ${successCount}/${limit - startIndex} (${((successCount / (limit - startIndex)) * 100).toFixed(1)}%)`);
  console.log(`Errors: ${errorCount}`);

  if (errorCount > 0) {
    console.log(`\nError log: ${ERROR_LOG_FILE}`);
  }

  // Show sample output
  console.log('\n--- Sample Output (5 words) ---');
  const samples = words.filter(w => w.famous_quote).slice(0, 5);
  for (const sample of samples) {
    console.log(`\n${sample.word} (Level ${sample.level}):`);
    console.log(`  Quote: "${sample.famous_quote.text.substring(0, 60)}..."`);
    console.log(`  Source: ${sample.famous_quote.source} - ${sample.famous_quote.author}`);
    console.log(`  Root: ${sample.etymology.root}`);
    console.log(`  Related: ${sample.etymology.related_words.join(', ')}`);
  }

  // Verification
  console.log('\n--- Verification ---');
  const enrichedCount = words.filter(w => w.famous_quote && w.etymology && w.quiz_choices).length;
  console.log(`Total words: ${words.length}`);
  console.log(`Enriched: ${enrichedCount}`);
  console.log(`Pending: ${words.length - enrichedCount}`);
}

function formatTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  resume: args.includes('--resume'),
  levelOnly: args.includes('--level-only')
};

// Run
enrichWords(options).catch(console.error);
