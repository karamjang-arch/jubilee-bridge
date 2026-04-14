#!/usr/bin/env node
/**
 * B-2: 참고서 → 전략 DB 추출
 *
 * PWN Math → strategy-db-math.json (수학 세부 스킬 50-80개)
 * Black Book → strategy-db-reading.json (문제 유형별 풀이 전략)
 *
 * 학생 직접 노출 금지, 분류체계+전략만 추출
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { loadGeminiApiKey } = require('./lib/config');

const GEMINI_API_KEY = loadGeminiApiKey();
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const RAW_DIR = path.join(__dirname, '../public/tests/raw');
const OUTPUT_DIR = path.join(__dirname, '../public/data');

async function extractPdfText(pdfPath) {
  const fileUrl = `file://${path.resolve(pdfPath)}`;
  const parser = new PDFParse({ url: fileUrl });
  const result = await parser.getText();
  return result.text;
}

async function callGemini(prompt, maxTokens = 16000) {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  cleaned = cleaned.replace(/"([^"\\]|\\.)*"/g, (match) => {
    return match.replace(/[\x00-\x1F\x7F]/g, (char) => {
      if (char === '\n') return '\\n';
      if (char === '\r') return '\\r';
      if (char === '\t') return '\\t';
      return '';
    });
  });

  return cleaned;
}

/**
 * PWN Math Guide → 수학 스킬 추출
 */
async function extractMathSkills() {
  console.log('\n=== Extracting Math Skills from PWN Guide ===');

  const pdfPath = path.join(RAW_DIR, 'pwn-sat-math.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('PWN Math PDF not found');
    return null;
  }

  console.log('Extracting PDF text...');
  const text = await extractPdfText(pdfPath);
  console.log(`  Extracted ${text.length} characters`);

  // Extract table of contents and skill categories first
  const tocPrompt = `Analyze this SAT Math prep book text and extract the complete skill taxonomy.

Create a JSON structure with 50-80 specific math skills organized by category.
For each skill, include:
- id: unique identifier (e.g., "MATH-ALG-LINEAR-1")
- name: skill name in English
- category: main category (Algebra, Geometry, Advanced Math, Problem Solving)
- subcategory: more specific area
- description: 1-2 sentence description of what this skill covers
- difficulty: easy/medium/hard
- sat_frequency: high/medium/low (how often it appears on SAT)
- key_concepts: array of 2-4 key concepts to master
- common_mistakes: array of 1-2 common student errors
- strategy_hint: brief strategy tip (for tutor use, not student-facing)

Format:
{
  "source": "PWN the SAT Math Guide",
  "version": "internal-only",
  "skills": [
    {
      "id": "MATH-ALG-LINEAR-1",
      "name": "Solving Linear Equations",
      "category": "Algebra",
      "subcategory": "Linear Equations",
      "description": "...",
      "difficulty": "easy",
      "sat_frequency": "high",
      "key_concepts": ["isolating variables", "..."],
      "common_mistakes": ["..."],
      "strategy_hint": "..."
    }
  ],
  "categories": {
    "Algebra": ["Linear Equations", "Systems", "..."],
    "Geometry": [...],
    ...
  }
}

IMPORTANT: This is for INTERNAL tutor use only. Extract strategic insights, not verbatim content.

TEXT (first 60000 chars):
${text.substring(0, 60000)}

Return ONLY valid JSON.`;

  console.log('Analyzing with Gemini...');
  const result = await callGemini(tocPrompt, 32000);
  const cleaned = cleanJsonResponse(result);

  try {
    const data = JSON.parse(cleaned);
    const outputPath = path.join(OUTPUT_DIR, 'strategy-db-math.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\nSaved: ${outputPath}`);
    console.log(`Total skills: ${data.skills?.length || 0}`);
    return data;
  } catch (e) {
    console.error('Failed to parse response:', e.message);
    console.error('Response:', cleaned.substring(0, 500));
    return null;
  }
}

/**
 * Black Book → Reading/Writing 전략 추출
 */
async function extractReadingStrategies() {
  console.log('\n=== Extracting Reading Strategies from Black Book ===');

  const pdfPath = path.join(RAW_DIR, 'sat-black-book.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('Black Book PDF not found');
    return null;
  }

  console.log('Extracting PDF text...');
  const text = await extractPdfText(pdfPath);
  console.log(`  Extracted ${text.length} characters`);

  const strategyPrompt = `Analyze this SAT prep book (Black Book) and extract reading/writing strategies.

Create a JSON structure with problem-solving strategies for the SAT Reading and Writing sections.
For each question type, extract:
- id: unique identifier
- question_type: type of question (e.g., "Main Idea", "Vocabulary in Context", "Evidence")
- section: "Reading" or "Writing"
- description: what this question type asks
- recognition_clues: how to identify this question type
- strategy_steps: numbered steps to solve
- time_allocation: suggested time in seconds
- common_traps: wrong answer patterns to avoid
- tutor_hints: hints for AI tutor to give (not student-facing)

Format:
{
  "source": "SAT Prep Black Book",
  "version": "internal-only",
  "strategies": [
    {
      "id": "RW-MAIN-IDEA",
      "question_type": "Main Idea / Central Theme",
      "section": "Reading",
      "description": "Questions asking about the main point or central idea of a passage",
      "recognition_clues": ["'main idea'", "'primarily concerned with'", "'central theme'"],
      "strategy_steps": [
        "1. Read the question first",
        "2. Skim passage for topic sentences",
        "3. Eliminate answers that are too specific or too broad"
      ],
      "time_allocation": 60,
      "common_traps": ["Answers that are true but not the MAIN idea"],
      "tutor_hints": ["Guide student to distinguish between details and themes"]
    }
  ],
  "general_principles": [
    "Every correct answer is directly supported by the text",
    ...
  ]
}

IMPORTANT: Extract strategic PATTERNS, not verbatim content. This is for internal AI tutor use.

TEXT (first 60000 chars):
${text.substring(0, 60000)}

Return ONLY valid JSON.`;

  console.log('Analyzing with Gemini...');
  const result = await callGemini(strategyPrompt, 32000);
  const cleaned = cleanJsonResponse(result);

  try {
    const data = JSON.parse(cleaned);
    const outputPath = path.join(OUTPUT_DIR, 'strategy-db-reading.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\nSaved: ${outputPath}`);
    console.log(`Total strategies: ${data.strategies?.length || 0}`);
    return data;
  } catch (e) {
    console.error('Failed to parse response:', e.message);
    console.error('Response:', cleaned.substring(0, 500));
    return null;
  }
}

/**
 * dsat-practice → 추가 모의고사 변환
 */
async function convertDsatPractice() {
  console.log('\n=== Converting DSAT Practice Test ===');

  const pdfPath = path.join(RAW_DIR, 'dsat-practice.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('DSAT Practice PDF not found');
    return null;
  }

  console.log('Extracting PDF text...');
  const text = await extractPdfText(pdfPath);
  console.log(`  Extracted ${text.length} characters`);

  // Check if it's a practice test
  if (text.length < 20000) {
    console.log('PDF too short to be a full practice test, skipping...');
    return null;
  }

  const extractPrompt = `Analyze this Digital SAT practice test PDF and extract all questions.

For each question, output:
{
  "questions": [
    {
      "number": 1,
      "section": "Reading and Writing" or "Math",
      "module": 1 or 2,
      "passage": "passage text if any",
      "question": "question text",
      "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "answer": "A/B/C/D if known",
      "skill": "skill category"
    }
  ]
}

TEXT:
${text.substring(0, 80000)}

Return ONLY valid JSON.`;

  console.log('Extracting questions...');
  const result = await callGemini(extractPrompt, 32000);
  const cleaned = cleanJsonResponse(result);

  try {
    const questionsData = JSON.parse(cleaned);

    if (!questionsData.questions || questionsData.questions.length < 10) {
      console.log('Not enough questions found, skipping...');
      return null;
    }

    const output = {
      id: 'dsat-practice-extra',
      name: 'Digital SAT Practice (Additional)',
      source: 'Third Party',
      type: 'full_test',
      testType: 'sat',
      sections: {
        reading_writing: {
          module1: questionsData.questions.filter(q =>
            (q.section?.toLowerCase().includes('reading') || q.section?.toLowerCase().includes('writing')) && q.module === 1
          ),
          module2: questionsData.questions.filter(q =>
            (q.section?.toLowerCase().includes('reading') || q.section?.toLowerCase().includes('writing')) && q.module === 2
          ),
        },
        math: {
          module1: questionsData.questions.filter(q => q.section?.toLowerCase().includes('math') && q.module === 1),
          module2: questionsData.questions.filter(q => q.section?.toLowerCase().includes('math') && q.module === 2),
        },
      },
      questions: questionsData.questions,
      totalQuestions: questionsData.questions.length,
      convertedAt: new Date().toISOString(),
    };

    const outputPath = path.join(__dirname, '../public/tests/json/dsat-practice-extra.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nSaved: ${outputPath}`);
    console.log(`Total questions: ${output.totalQuestions}`);
    return output;
  } catch (e) {
    console.error('Failed to parse response:', e.message);
    return null;
  }
}

async function main() {
  console.log('=== B-2: Reference Book Strategy Extraction ===\n');

  // 1. PWN Math skills
  await extractMathSkills();

  // 2. Black Book reading strategies
  await extractReadingStrategies();

  // 3. DSAT practice test
  await convertDsatPractice();

  console.log('\n=== B-2 Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
