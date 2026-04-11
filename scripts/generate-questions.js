/**
 * CB Questions Batch Generator
 *
 * Generates 5 multiple-choice questions per concept using Gemini API.
 * Saves to cb-questions-[subject].json
 *
 * Usage:
 *   node generate-questions.js --dry-run --limit 5    # Test 5 concepts
 *   node generate-questions.js --subject math         # Math only
 *   node generate-questions.js --resume               # Resume from checkpoint
 *   node generate-questions.js                        # Full batch (all subjects)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const GEMINI_API_KEY = 'AIzaSyDUiCcoHc-Nc4an3TGJLROvwNJJz1X15ak';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

const DATA_DIR = path.join(__dirname, '../public/data');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const CHECKPOINT_FILE = path.join(__dirname, 'questions-checkpoint.json');
const ERROR_LOG = path.join(__dirname, 'questions-errors.log');

const RATE_LIMIT_MS = 1000; // 1 second between calls (paid tier: 60 RPM)
const CHECKPOINT_INTERVAL = 50;
const MAX_RETRIES = 3;
const DAILY_LIMIT = 5000; // Full batch authorized

const SUBJECTS = ['math', 'english', 'physics', 'chemistry', 'biology', 'history', 'economics', 'cs'];

// Bloom level descriptions
const BLOOM_DESCRIPTIONS = {
  1: 'Remember - recall facts and basic concepts',
  2: 'Understand - explain ideas or concepts',
  3: 'Apply - use information in new situations',
  4: 'Analyze - draw connections among ideas',
  5: 'Evaluate - justify a decision or course of action',
  6: 'Create - produce new or original work'
};

// Default time targets by bloom level (seconds)
const DEFAULT_TIME = {
  1: 45, 2: 60, 3: 75, 4: 90, 5: 120, 6: 150
};

// Subject-specific prompt templates
const PROMPTS = {
  math: (data) => `You are a professional SAT Math question writer.

Create 5 multiple-choice questions for this concept:

CONCEPT: ${data.title_en}
GRADE: ${data.grade_us?.join(', ') || 'High School'}
BLOOM LEVEL: ${data.bloom_level} (${BLOOM_DESCRIPTIONS[data.bloom_level] || 'Apply'})
SAT DOMAIN: ${data.sat_domain || 'Problem Solving'}
SAT SKILL: ${data.sat_skill || 'General'}
COMMON STUDENT ERRORS: ${(data.common_errors || []).slice(0, 3).join('; ') || 'calculation mistakes'}
TIME TARGET: ${data.time_target || 75} seconds per question

REQUIREMENTS:
1. Questions MUST require actual calculation or problem-solving, NOT just recall of definitions.
2. Each question has exactly 4 choices (A, B, C, D).
3. Exactly 1 correct answer per question.
4. Wrong answers MUST come from common student errors:
   - One wrong answer = the result of a common calculation mistake
   - One wrong answer = the result of a conceptual misunderstanding
   - One wrong answer = a plausible but incorrect approach
5. Difficulty distribution: Q1: easy, Q2: easy-medium, Q3: medium, Q4: medium-hard, Q5: hard
6. For Apply+ level: include word problems that require translating English to math.
7. Include the complete solution steps in the explanation.

RESPOND ONLY IN JSON (no markdown, no code blocks):
[
  {
    "id": 1,
    "question": "...",
    "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "B",
    "explanation": "Step 1: ... Step 2: ... Therefore B.",
    "difficulty": "easy",
    "time_seconds": 60,
    "error_trap": "A is the result of forgetting to distribute the negative sign"
  }
]`,

  english: (data) => `You are a professional SAT Reading & Writing question writer.

Create 5 questions for this English concept:

CONCEPT: ${data.title_en}
GRADE: ${data.grade_us?.join(', ') || 'High School'}
SAT DOMAIN: ${data.sat_domain || 'Craft and Structure'}
SAT SKILL: ${data.sat_skill || 'Words in Context'}
QUESTION TYPE: ${data.question_type || 'reading comprehension'}
COMMON TRAPS: ${(data.common_errors || []).slice(0, 3).join('; ') || 'misreading context'}
TIME TARGET: ${data.time_target || 70} seconds

REQUIREMENTS:
1. Each question includes a SHORT passage (3-5 sentences) followed by a question with 4 choices.
2. Passages should be grade-appropriate, covering: Literature, Social science, Natural science, Historical documents. Mix the passage types.
3. For 'Words in Context': the target word must have a SECONDARY meaning revealed by context.
4. For 'Command of Evidence': include a claim and ask which sentence best supports it.
5. For 'Boundaries/Form': give a sentence with a blank and ask which punctuation/grammar is correct.
6. Wrong answers must be plausible traps.
7. Difficulty distribution: Q1 easy → Q5 hard

RESPOND ONLY IN JSON (no markdown, no code blocks):
[
  {
    "id": 1,
    "passage": "...",
    "question": "...",
    "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "C",
    "explanation": "...",
    "difficulty": "easy",
    "time_seconds": 70,
    "question_subtype": "main_idea"
  }
]`,

  science: (data) => `You are a science education assessment writer.

Create 5 multiple-choice questions for this concept:

CONCEPT: ${data.title_en}
SUBJECT: ${data.subject}
GRADE: ${data.grade_us?.join(', ') || 'High School'}
BLOOM LEVEL: ${data.bloom_level} (${BLOOM_DESCRIPTIONS[data.bloom_level] || 'Apply'})
PREREQUISITES: ${(data.prerequisites || []).join(', ') || 'none specified'}
COMMON ERRORS: ${(data.common_errors || []).slice(0, 3).join('; ') || 'conceptual misunderstandings'}

REQUIREMENTS:
1. Q1-Q2: Conceptual understanding (can the student explain WHY, not just WHAT)
2. Q3: Application (apply concept to new scenario)
3. Q4: Calculation or data interpretation (if applicable)
4. Q5: Cross-concept connection (connect to prerequisite or related concept)
5. Include units in all numerical answers.
6. Wrong answers from common misconceptions, not random numbers.
7. For physics/chemistry: include relevant formulas in the question stem when needed.
8. Explanation must include step-by-step reasoning.

RESPOND ONLY IN JSON (no markdown, no code blocks):
[
  {
    "id": 1,
    "question": "...",
    "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "B",
    "explanation": "...",
    "difficulty": "easy",
    "time_seconds": 75
  }
]`,

  social: (data) => `You are a social studies assessment writer.

Create 5 multiple-choice questions for this concept:

CONCEPT: ${data.title_en}
SUBJECT: ${data.subject}
GRADE: ${data.grade_us?.join(', ') || 'High School'}
BLOOM LEVEL: ${data.bloom_level} (${BLOOM_DESCRIPTIONS[data.bloom_level] || 'Apply'})
COMMON ERRORS: ${(data.common_errors || []).slice(0, 3).join('; ') || 'confusing similar events'}

REQUIREMENTS:
1. Q1: Factual recall (who/what/when/where)
2. Q2: Cause and effect (why did X happen?)
3. Q3: Primary source interpretation (give a quote or data, ask what it reveals)
4. Q4: Comparison (compare two events/concepts/systems)
5. Q5: Analysis/Evaluation (was X justified? what would have happened if...?)
6. Include brief context in each question stem.
7. Wrong answers should be common misconceptions, not obviously wrong.

RESPOND ONLY IN JSON (no markdown, no code blocks):
[
  {
    "id": 1,
    "question": "...",
    "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "A",
    "explanation": "...",
    "difficulty": "easy",
    "time_seconds": 60
  }
]`,

  cs: (data) => `You are a computer science education assessment writer.

Create 5 multiple-choice questions for this concept:

CONCEPT: ${data.title_en}
GRADE: ${data.grade_us?.join(', ') || 'High School'}
BLOOM LEVEL: ${data.bloom_level} (${BLOOM_DESCRIPTIONS[data.bloom_level] || 'Apply'})
COMMON ERRORS: ${(data.common_errors || []).slice(0, 3).join('; ') || 'syntax errors'}

REQUIREMENTS:
1. Q1-Q2: Conceptual (what does this do? what is this?)
2. Q3: Code reading (give code snippet, ask output)
3. Q4: Debugging (give code with bug, ask what's wrong)
4. Q5: Problem solving (describe task, ask best approach)
5. Code snippets in Python (most accessible).
6. Keep code SHORT (max 8 lines).
7. Use plain text for code, no markdown.

RESPOND ONLY IN JSON (no markdown, no code blocks):
[
  {
    "id": 1,
    "question": "...",
    "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "C",
    "explanation": "...",
    "difficulty": "easy",
    "time_seconds": 90
  }
]`
};

// Get appropriate prompt template
function getPromptTemplate(subject) {
  if (subject === 'math') return PROMPTS.math;
  if (subject === 'english') return PROMPTS.english;
  if (['physics', 'chemistry', 'biology'].includes(subject)) return PROMPTS.science;
  if (['history', 'economics'].includes(subject)) return PROMPTS.social;
  if (subject === 'cs') return PROMPTS.cs;
  return PROMPTS.science; // fallback
}

// Load CB data for a subject
function loadSubjectData(subject) {
  const cbContentPath = path.join(DATA_DIR, `cb-content-${subject}.json`);
  const conceptsPath = path.join(DATA_DIR, `concepts_master_${subject}.json`);

  let cbContent = {};
  let conceptsMaster = [];

  if (fs.existsSync(cbContentPath)) {
    cbContent = JSON.parse(fs.readFileSync(cbContentPath, 'utf-8'));
  }

  if (fs.existsSync(conceptsPath)) {
    const data = JSON.parse(fs.readFileSync(conceptsPath, 'utf-8'));
    // Handle both array format and {concepts: [...]} format
    conceptsMaster = Array.isArray(data) ? data : (data.concepts || []);
  }

  // Merge data
  const merged = {};
  for (const concept of conceptsMaster) {
    const id = concept.concept_id;
    const cb = cbContent[id] || {};
    merged[id] = {
      concept_id: id,
      title_en: concept.title_en || cb.title_en || id,
      grade_us: concept.grade_us || cb.grade_us,
      bloom_level: cb.bloom_level || 3,
      sat_domain: concept.sat_domain,
      sat_skill: concept.sat_skill,
      common_errors: cb.common_errors || [],
      time_target: cb.time_benchmarks?.target || DEFAULT_TIME[cb.bloom_level || 3],
      prerequisites: concept.relationships?.prerequisites || [],
      subject: subject,
      question_type: cb.question_type
    };
  }

  // Also include concepts only in cb-content
  for (const [id, cb] of Object.entries(cbContent)) {
    if (!merged[id]) {
      merged[id] = {
        concept_id: id,
        title_en: cb.title_en || cb.title_ko || id,
        grade_us: cb.grade_us,
        bloom_level: cb.bloom_level || 3,
        common_errors: cb.common_errors || [],
        time_target: cb.time_benchmarks?.target || DEFAULT_TIME[cb.bloom_level || 3],
        subject: subject
      };
    }
  }

  return merged;
}

// Call Gemini API
async function callGemini(prompt) {
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  return text;
}

// Parse JSON from Gemini response
function parseQuestions(text) {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try to extract JSON array if there's extra text
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    cleaned = arrayMatch[0];
  }

  // Fix literal newlines/tabs inside JSON string values
  // Strategy: process character by character, escape newlines only when inside quotes
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      // Inside a string: escape control characters
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        // Other control characters: remove
        continue;
      } else {
        result += char;
      }
    } else {
      // Outside string: keep structural whitespace, remove other control chars
      if (char === '\n' || char === '\r' || char === '\t' || char === ' ') {
        result += char;
      } else if (char.charCodeAt(0) < 32) {
        continue;
      } else {
        result += char;
      }
    }
  }

  let questions;

  try {
    questions = JSON.parse(result);
  } catch (parseError) {
    // Fallback: try to extract individual question objects
    // Match objects that have "id", "question", "choices", "answer" fields
    const objectMatches = result.match(/\{[^{}]*"id"\s*:\s*\d+[^{}]*"question"\s*:[^{}]*"choices"\s*:\s*\[[^\]]*\][^{}]*"answer"\s*:[^{}]*\}/g);

    if (!objectMatches || objectMatches.length === 0) {
      throw parseError; // No salvageable objects, throw original error
    }

    questions = [];
    for (const objStr of objectMatches) {
      try {
        // Clean and parse each object individually
        let cleanObj = objStr;
        // Fix trailing commas before closing brace
        cleanObj = cleanObj.replace(/,\s*\}/g, '}');
        // Fix trailing commas before closing bracket
        cleanObj = cleanObj.replace(/,\s*\]/g, ']');

        const obj = JSON.parse(cleanObj);
        questions.push(obj);
      } catch (e) {
        // Skip malformed objects
        continue;
      }
    }

    if (questions.length === 0) {
      throw parseError;
    }
  }

  if (!Array.isArray(questions)) {
    throw new Error('Response is not an array');
  }

  // Validate each question
  const valid = questions.filter(q => {
    if (!q.question || !q.choices || !q.answer) return false;
    if (!Array.isArray(q.choices) || q.choices.length !== 4) return false;
    if (!['A', 'B', 'C', 'D'].includes(q.answer.toUpperCase().charAt(0))) return false;
    return true;
  });

  return valid;
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Load checkpoint
function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { processed: [], results: {}, callCount: 0 };
}

// Save checkpoint
function saveCheckpoint(checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// Log error
function logError(conceptId, error) {
  const entry = `[${new Date().toISOString()}] ${conceptId}: ${error}\n`;
  fs.appendFileSync(ERROR_LOG, entry);
}

// Main generation function
async function generateQuestions(options = {}) {
  const { dryRun, limit, subject: targetSubject, resume } = options;

  console.log('=== CB Questions Generator ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Subject: ${targetSubject || 'all'}`);
  console.log('');

  let checkpoint = resume ? loadCheckpoint() : { processed: [], results: {}, callCount: 0 };
  const processedSet = new Set(checkpoint.processed);

  const subjects = targetSubject ? [targetSubject] : SUBJECTS;
  let totalProcessed = 0;
  let totalGenerated = 0;

  for (const subject of subjects) {
    console.log(`\n--- Processing ${subject.toUpperCase()} ---`);

    const data = loadSubjectData(subject);
    const conceptIds = Object.keys(data);
    console.log(`Loaded ${conceptIds.length} concepts`);

    const outputFile = path.join(OUTPUT_DIR, `cb-questions-${subject}.json`);
    let output = {};
    if (fs.existsSync(outputFile)) {
      output = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    }

    const promptFn = getPromptTemplate(subject);

    for (const conceptId of conceptIds) {
      // Skip if already processed
      if (processedSet.has(conceptId)) {
        continue;
      }

      // Check limits
      if (limit && totalProcessed >= limit) {
        console.log(`\nReached limit of ${limit} concepts`);
        break;
      }

      if (checkpoint.callCount >= DAILY_LIMIT) {
        console.log(`\nReached daily limit of ${DAILY_LIMIT} calls`);
        break;
      }

      const conceptData = data[conceptId];
      const prompt = promptFn(conceptData);

      console.log(`[${totalProcessed + 1}] ${conceptId}: ${conceptData.title_en?.substring(0, 40)}...`);

      let questions = null;
      let attempts = 0;

      while (attempts < MAX_RETRIES && !questions) {
        attempts++;
        try {
          if (!dryRun) {
            await sleep(RATE_LIMIT_MS);
          }

          const response = await callGemini(prompt);
          checkpoint.callCount++;

          questions = parseQuestions(response);

          if (questions.length < 3) {
            console.log(`  Warning: Only ${questions.length} valid questions, retrying...`);
            questions = null;
          }
        } catch (error) {
          console.log(`  Attempt ${attempts} failed: ${error.message}`);
          logError(conceptId, error.message);

          if (attempts < MAX_RETRIES) {
            await sleep(RATE_LIMIT_MS * 2);
          }
        }
      }

      if (questions && questions.length > 0) {
        output[conceptId] = questions;
        checkpoint.results[conceptId] = questions.length;
        totalGenerated += questions.length;
        console.log(`  ✓ Generated ${questions.length} questions`);

        // Print sample in dry-run mode
        if (dryRun && totalProcessed < 3) {
          console.log('\n--- SAMPLE OUTPUT ---');
          console.log(JSON.stringify(questions[0], null, 2));
          console.log('--- END SAMPLE ---\n');
        }
      } else {
        console.log(`  ✗ Failed after ${MAX_RETRIES} attempts`);
      }

      processedSet.add(conceptId);
      checkpoint.processed.push(conceptId);
      totalProcessed++;

      // Checkpoint save
      if (totalProcessed % CHECKPOINT_INTERVAL === 0) {
        saveCheckpoint(checkpoint);
        fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
        console.log(`  [Checkpoint saved: ${totalProcessed} concepts]`);
      }
    }

    // Save final output for this subject
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\nSaved ${Object.keys(output).length} concepts to ${outputFile}`);

    if (limit && totalProcessed >= limit) break;
    if (checkpoint.callCount >= DAILY_LIMIT) break;
  }

  // Final checkpoint
  saveCheckpoint(checkpoint);

  console.log('\n=== SUMMARY ===');
  console.log(`Concepts processed: ${totalProcessed}`);
  console.log(`Questions generated: ${totalGenerated}`);
  console.log(`API calls made: ${checkpoint.callCount}`);
  console.log('================');
}

// CLI
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  resume: args.includes('--resume'),
  limit: null,
  subject: null
};

const limitIdx = args.indexOf('--limit');
if (limitIdx !== -1 && args[limitIdx + 1]) {
  options.limit = parseInt(args[limitIdx + 1]);
}

const subjectIdx = args.indexOf('--subject');
if (subjectIdx !== -1 && args[subjectIdx + 1]) {
  options.subject = args[subjectIdx + 1];
}

generateQuestions(options).catch(console.error);
