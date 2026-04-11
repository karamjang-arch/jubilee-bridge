#!/usr/bin/env node
/**
 * PSAT Practice Test PDF → JSON 변환 스크립트
 *
 * 사용법:
 *   node scripts/convert-psat-tests.js psat-nmsqt-1
 *   node scripts/convert-psat-tests.js psat-10-1
 *   node scripts/convert-psat-tests.js psat-8-9-1
 *   node scripts/convert-psat-tests.js all
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

// Gemini API 설정
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDUiCcoHc-Nc4an3TGJLROvwNJJz1X15ak';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const RAW_DIR = path.join(__dirname, '../public/tests/raw');
const JSON_DIR = path.join(__dirname, '../public/tests/json');

// PSAT 테스트 목록
const PSAT_TESTS = [
  { id: 'psat-nmsqt-practice-test-1', name: 'PSAT/NMSQT Practice Test 1', type: 'psat-nmsqt' },
  { id: 'psat-nmsqt-practice-test-2', name: 'PSAT/NMSQT Practice Test 2', type: 'psat-nmsqt' },
  { id: 'psat-10-practice-test-1', name: 'PSAT 10 Practice Test 1', type: 'psat-10' },
  { id: 'psat-10-practice-test-2', name: 'PSAT 10 Practice Test 2', type: 'psat-10' },
  { id: 'psat-8-9-practice-test-1', name: 'PSAT 8/9 Practice Test 1', type: 'psat-8-9' },
  { id: 'psat-8-9-practice-test-2', name: 'PSAT 8/9 Practice Test 2', type: 'psat-8-9' },
];

if (!fs.existsSync(JSON_DIR)) {
  fs.mkdirSync(JSON_DIR, { recursive: true });
}

async function extractPdfText(pdfPath) {
  const fileUrl = `file://${path.resolve(pdfPath)}`;
  const parser = new PDFParse({ url: fileUrl });
  const result = await parser.getText();
  return result.text;
}

async function callGemini(prompt, maxTokens = 8000) {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1,
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

async function structureQuestions(rawText, section, testName) {
  const prompt = `You are parsing ${testName}, ${section} section.

Extract ALL questions from the following text. For each question, output JSON in this exact format:

{
  "questions": [
    {
      "number": 1,
      "module": 1,
      "section": "${section}",
      "passage": "passage text if any (null if none)",
      "question": "the question text",
      "choices": ["A) choice1", "B) choice2", "C) choice3", "D) choice4"],
      "answer": null,
      "explanation": null,
      "skill": "inferred skill category",
      "difficulty": "easy|medium|hard"
    }
  ]
}

Rules:
- ONLY extract ${section} questions - ignore all other sections
- For Reading and Writing: questions involve passages, vocabulary, grammar, rhetoric
- For Math: questions involve numbers, equations, graphs, geometry, algebra
- Include ALL questions from ${section} section, do not skip any
- For Reading/Writing: include the passage if the question refers to one
- choices must be array of 4 strings in format "A) text", "B) text", etc.
- skill: infer from question type
- difficulty: estimate based on complexity
- IMPORTANT: In JSON strings, replace all newlines with \\n and escape all special characters properly

RAW TEXT:
${rawText.substring(0, 50000)}

Return ONLY valid JSON, no markdown or explanation. Ensure all strings are properly escaped.`;

  const result = await callGemini(prompt, 16000);

  let cleaned = result.trim();
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

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse Gemini response:', e.message);
    console.error('Response:', cleaned.substring(0, 500));

    try {
      const lastBracket = cleaned.lastIndexOf('}]');
      if (lastBracket > 0) {
        const truncated = cleaned.substring(0, lastBracket + 2) + '}';
        return JSON.parse(truncated);
      }
    } catch (e2) {}

    return { questions: [] };
  }
}

async function extractAnswers(rawText, testName) {
  const prompt = `You are parsing ${testName} ANSWER KEY.

Extract ALL answers and explanations. Output JSON in this format:

{
  "answers": {
    "rw_module1": {
      "1": { "answer": "A", "explanation": "explanation text" },
      "2": { "answer": "C", "explanation": "explanation text" }
    },
    "rw_module2": { ... },
    "math_module1": { ... },
    "math_module2": { ... }
  }
}

Rules:
- rw = Reading and Writing section
- math = Math section
- module1 and module2 for each section
- answer should be just the letter (A, B, C, or D)
- explanation should capture the key reasoning
- IMPORTANT: Escape all newlines and special characters in strings

RAW TEXT:
${rawText.substring(0, 80000)}

Return ONLY valid JSON. Ensure all strings are properly escaped.`;

  const result = await callGemini(prompt, 16000);

  let cleaned = result.trim();
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

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse answers:', e.message);
    return { answers: {} };
  }
}

function mergeQuestionsAndAnswers(questions, answers) {
  return questions.map(q => {
    const sectionKey = q.section?.toLowerCase().includes('reading') || q.section?.toLowerCase().includes('writing')
      ? 'rw'
      : 'math';
    const moduleKey = `${sectionKey}_module${q.module || 1}`;
    const answerData = answers.answers?.[moduleKey]?.[String(q.number)];

    return {
      ...q,
      answer: answerData?.answer || q.answer,
      explanation: answerData?.explanation || q.explanation,
    };
  });
}

async function convertTest(testInfo) {
  console.log(`\n=== Converting ${testInfo.name} ===`);

  const testPdf = path.join(RAW_DIR, `${testInfo.id}.pdf`);
  const answerPdf = path.join(RAW_DIR, `${testInfo.id}-answers.pdf`);

  if (!fs.existsSync(testPdf)) {
    console.error(`Test PDF not found: ${testPdf}`);
    return null;
  }

  console.log('Extracting test PDF text...');
  const testText = await extractPdfText(testPdf);
  console.log(`  Extracted ${testText.length} characters`);

  let answerText = '';
  if (fs.existsSync(answerPdf)) {
    try {
      // Check if file is a valid PDF (not HTML error page)
      const pdfHeader = fs.readFileSync(answerPdf, { encoding: 'utf8', flag: 'r' }).substring(0, 10);
      if (pdfHeader.startsWith('%PDF')) {
        console.log('Extracting answer PDF text...');
        answerText = await extractPdfText(answerPdf);
        console.log(`  Extracted ${answerText.length} characters`);
      } else {
        console.log('Answer PDF is invalid (not a PDF), skipping...');
      }
    } catch (e) {
      console.log('Could not read answer PDF, skipping...');
    }
  }

  console.log('Structuring Reading & Writing questions...');
  const rwData = await structureQuestions(testText, 'Reading and Writing', testInfo.name);
  console.log(`  Found ${rwData.questions?.length || 0} R&W questions`);

  console.log('Structuring Math questions...');
  const mathData = await structureQuestions(testText, 'Math', testInfo.name);
  console.log(`  Found ${mathData.questions?.length || 0} Math questions`);

  let answers = { answers: {} };
  if (answerText) {
    console.log('Extracting answers and explanations...');
    answers = await extractAnswers(answerText, testInfo.name);
  }

  const allQuestions = [
    ...(rwData.questions || []),
    ...(mathData.questions || []),
  ];
  const merged = mergeQuestionsAndAnswers(allQuestions, answers);

  const output = {
    id: testInfo.id,
    name: testInfo.name,
    type: testInfo.type,
    source: 'College Board Official',
    testType: 'psat',
    sections: {
      reading_writing: {
        module1: merged.filter(q =>
          (q.section?.toLowerCase().includes('reading') || q.section?.toLowerCase().includes('writing'))
          && q.module === 1
        ),
        module2: merged.filter(q =>
          (q.section?.toLowerCase().includes('reading') || q.section?.toLowerCase().includes('writing'))
          && q.module === 2
        ),
      },
      math: {
        module1: merged.filter(q => q.section?.toLowerCase().includes('math') && q.module === 1),
        module2: merged.filter(q => q.section?.toLowerCase().includes('math') && q.module === 2),
      },
    },
    questions: merged,
    totalQuestions: merged.length,
    convertedAt: new Date().toISOString(),
  };

  const outputPath = path.join(JSON_DIR, `${testInfo.id}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved: ${outputPath}`);
  console.log(`Total questions: ${output.totalQuestions}`);

  return output;
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log('Usage:');
    console.log('  node scripts/convert-psat-tests.js psat-nmsqt-practice-test-1');
    console.log('  node scripts/convert-psat-tests.js all');
    console.log('\nAvailable tests:');
    PSAT_TESTS.forEach(t => console.log(`  - ${t.id}`));
    process.exit(0);
  }

  if (arg === 'all') {
    for (const test of PSAT_TESTS) {
      await convertTest(test);
    }
  } else {
    const test = PSAT_TESTS.find(t => t.id === arg || t.id.includes(arg));
    if (!test) {
      console.error(`Unknown test: ${arg}`);
      console.error('Available tests:', PSAT_TESTS.map(t => t.id).join(', '));
      process.exit(1);
    }
    await convertTest(test);
  }

  console.log('\n=== Conversion complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
