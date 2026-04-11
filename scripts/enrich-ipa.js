/**
 * IPA Enrichment Script
 *
 * Adds IPA pronunciation to word-db.json using Free Dictionary API
 * https://api.dictionaryapi.dev/api/v2/entries/en/{word}
 *
 * Usage:
 *   node enrich-ipa.js           # Process all words without IPA
 *   node enrich-ipa.js --dry-run # Test with 10 words only
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../public/word-db.json');
const OUTPUT_FILE = path.join(__dirname, '../public/word-db.json');
const CHECKPOINT_FILE = path.join(__dirname, 'ipa-checkpoint.json');

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const RATE_LIMIT_MS = 500; // 500ms between calls (be nice to free API)
const MAX_RETRIES = 2;

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch IPA from Free Dictionary API
async function fetchIPA(word, retries = 0) {
  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(word)}`);

    if (response.status === 404) {
      // Word not found - expected for some words
      return null;
    }

    if (!response.ok) {
      if (response.status === 429 && retries < MAX_RETRIES) {
        console.log(`    Rate limited, waiting 5s...`);
        await sleep(5000);
        return fetchIPA(word, retries + 1);
      }
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();

    // Extract phonetic - try multiple sources
    // Priority: phonetic field > phonetics array with text
    if (data[0]?.phonetic) {
      return data[0].phonetic;
    }

    // Search through phonetics array for one with text
    const phonetics = data[0]?.phonetics || [];
    for (const p of phonetics) {
      if (p.text) {
        return p.text;
      }
    }

    return null;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await sleep(1000);
      return fetchIPA(word, retries + 1);
    }
    throw error;
  }
}

// Save checkpoint
function saveCheckpoint(processedIndex, successCount, failCount) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    processedIndex,
    successCount,
    failCount,
    timestamp: new Date().toISOString()
  }));
}

// Load checkpoint
function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
  }
  return null;
}

// Main function
async function enrichIPA(options = {}) {
  const { dryRun = false, resume = false } = options;

  console.log('='.repeat(50));
  console.log('IPA Enrichment Script (Free Dictionary API)');
  console.log('='.repeat(50));

  // Load word database
  console.log('\nLoading word-db.json...');
  const words = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`Total words: ${words.length}`);

  // Count existing IPA
  const existingIPA = words.filter(w => w.ipa).length;
  console.log(`Already have IPA: ${existingIPA}`);

  // Determine starting point
  let startIndex = 0;
  let successCount = 0;
  let failCount = 0;

  if (resume) {
    const checkpoint = loadCheckpoint();
    if (checkpoint) {
      startIndex = checkpoint.processedIndex + 1;
      successCount = checkpoint.successCount;
      failCount = checkpoint.failCount;
      console.log(`Resuming from index ${startIndex}`);
    }
  }

  // Filter words to process
  const limit = dryRun ? Math.min(10, words.length) : words.length;

  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}Processing ${limit - startIndex} words...`);
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between calls`);

  const estimatedMinutes = Math.ceil((limit - startIndex) * RATE_LIMIT_MS / 60000);
  console.log(`Estimated time: ~${estimatedMinutes} minutes`);
  console.log('\nStarting in 2 seconds...\n');
  await sleep(2000);

  // Process each word
  for (let i = startIndex; i < limit; i++) {
    const word = words[i];

    // Skip if already has IPA
    if (word.ipa) {
      console.log(`[${i + 1}/${limit}] ${word.word} - already has IPA, skipping`);
      successCount++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${limit}] ${word.word}... `);

    try {
      const ipa = await fetchIPA(word.word);

      if (ipa) {
        word.ipa = ipa;
        successCount++;
        console.log(`${ipa}`);
      } else {
        word.ipa = null; // Explicitly mark as checked but not found
        failCount++;
        console.log(`(not found)`);
      }
    } catch (error) {
      word.ipa = null;
      failCount++;
      console.log(`ERROR: ${error.message}`);
    }

    // Save checkpoint every 100 words
    if ((i + 1) % 100 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2));
      saveCheckpoint(i, successCount, failCount);
      console.log(`  [Checkpoint saved at ${i + 1}]`);
    }

    // Rate limiting
    if (i < limit - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // Final save
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2));

  // Clean up checkpoint on complete
  if (fs.existsSync(CHECKPOINT_FILE) && !dryRun) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }

  // Report
  console.log('\n' + '='.repeat(50));
  console.log('IPA ENRICHMENT COMPLETE');
  console.log('='.repeat(50));

  const total = successCount + failCount;
  const successRate = ((successCount / total) * 100).toFixed(1);

  console.log(`Success: ${successCount}/${total} (${successRate}%)`);
  console.log(`Not found: ${failCount}`);

  // Show samples
  console.log('\n--- Sample Output (10 words with IPA) ---');
  const samples = words.filter(w => w.ipa).slice(0, 10);
  for (const s of samples) {
    console.log(`  ${s.word}: ${s.ipa}`);
  }

  // Final verification
  const finalCount = words.filter(w => w.ipa).length;
  console.log(`\nFinal IPA count: ${finalCount}/${words.length} (${((finalCount / words.length) * 100).toFixed(1)}%)`);
}

// Parse arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  resume: args.includes('--resume')
};

// Run
enrichIPA(options).catch(console.error);
