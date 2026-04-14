#!/usr/bin/env node
/**
 * SAT Practice Test PDF → JSON 변환 스크립트
 *
 * 사용법:
 *   node scripts/convert-sat-tests.js [testNumber]
 *   node scripts/convert-sat-tests.js 7     # Test 7만 변환
 *   node scripts/convert-sat-tests.js all   # 모든 테스트 변환
 *
 * 출력: public/tests/json/sat-practice-test-{N}.json
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { loadGeminiApiKey } = require('./lib/config');

// Gemini API 설정
const GEMINI_API_KEY = loadGeminiApiKey();
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const RAW_DIR = path.join(__dirname, '../public/tests/raw');
const JSON_DIR = path.join(__dirname, '../public/tests/json');

// JSON 출력 디렉토리 생성
if (!fs.existsSync(JSON_DIR)) {
  fs.mkdirSync(JSON_DIR, { recursive: true });
}

/**
 * PDF에서 텍스트 추출
 */
async function extractPdfText(pdfPath) {
  // pdf-parse v2 requires url parameter - use file:// protocol for local files
  const fileUrl = `file://${path.resolve(pdfPath)}`;
  const parser = new PDFParse({ url: fileUrl });
  const result = await parser.getText();
  return result.text;
}

/**
 * Gemini API 호출
 */
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

/**
 * 문제 텍스트를 JSON으로 구조화 (Gemini 사용)
 */
async function structureQuestions(rawText, section, testNumber) {
  const prompt = `You are parsing SAT Practice Test ${testNumber}, ${section} section.

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
- skill: infer from question type (e.g., "Central Ideas", "Craft and Structure", "Linear Equations", "Quadratic Functions")
- difficulty: estimate based on complexity
- IMPORTANT: In JSON strings, replace all newlines with \\n and escape all special characters properly

RAW TEXT:
${rawText.substring(0, 50000)}

Return ONLY valid JSON, no markdown or explanation. Ensure all strings are properly escaped.`;

  const result = await callGemini(prompt, 16000);

  // Clean up response
  let cleaned = result.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Fix control characters inside JSON string values
  // This regex finds content inside double quotes and escapes control chars
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

    // Try to salvage partial JSON
    try {
      // Find the last complete question object
      const lastBracket = cleaned.lastIndexOf('}]');
      if (lastBracket > 0) {
        const truncated = cleaned.substring(0, lastBracket + 2) + '}';
        return JSON.parse(truncated);
      }
    } catch (e2) {
      // Give up
    }

    return { questions: [] };
  }
}

/**
 * 해설 PDF에서 정답과 설명 추출
 */
async function extractAnswers(rawText, testNumber) {
  const prompt = `You are parsing SAT Practice Test ${testNumber} ANSWER KEY.

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
- IMPORTANT: In JSON strings, replace all newlines with \\n and escape all special characters properly

RAW TEXT:
${rawText.substring(0, 80000)}

Return ONLY valid JSON. Ensure all strings are properly escaped.`;

  const result = await callGemini(prompt, 16000);

  let cleaned = result.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // Fix control characters inside JSON string values
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

/**
 * 문제와 정답 병합
 */
function mergeQuestionsAndAnswers(questions, answers) {
  const merged = questions.map(q => {
    const sectionKey = q.section.toLowerCase().includes('reading') || q.section.toLowerCase().includes('writing')
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

  return merged;
}

/**
 * 단일 테스트 변환
 */
async function convertTest(testNumber) {
  console.log(`\n=== Converting SAT Practice Test ${testNumber} ===`);

  const testPdf = path.join(RAW_DIR, `sat-practice-test-${testNumber}.pdf`);
  const answerPdf = path.join(RAW_DIR, `sat-practice-test-${testNumber}-answers.pdf`);

  if (!fs.existsSync(testPdf)) {
    console.error(`Test PDF not found: ${testPdf}`);
    return null;
  }

  // 1. PDF 텍스트 추출
  console.log('Extracting test PDF text...');
  const testText = await extractPdfText(testPdf);
  console.log(`  Extracted ${testText.length} characters`);

  // 2. 해설 PDF 텍스트 추출
  let answerText = '';
  if (fs.existsSync(answerPdf)) {
    console.log('Extracting answer PDF text...');
    answerText = await extractPdfText(answerPdf);
    console.log(`  Extracted ${answerText.length} characters`);
  }

  // 3. Reading & Writing 섹션 구조화
  console.log('Structuring Reading & Writing questions...');
  const rwData = await structureQuestions(testText, 'Reading and Writing', testNumber);
  console.log(`  Found ${rwData.questions?.length || 0} R&W questions`);

  // 4. Math 섹션 구조화
  console.log('Structuring Math questions...');
  const mathData = await structureQuestions(testText, 'Math', testNumber);
  console.log(`  Found ${mathData.questions?.length || 0} Math questions`);

  // 5. 정답/해설 추출
  let answers = { answers: {} };
  if (answerText) {
    console.log('Extracting answers and explanations...');
    answers = await extractAnswers(answerText, testNumber);
  }

  // 6. 병합
  const allQuestions = [
    ...(rwData.questions || []),
    ...(mathData.questions || []),
  ];
  const merged = mergeQuestionsAndAnswers(allQuestions, answers);

  // 7. 최종 JSON 생성
  const output = {
    id: `sat-practice-test-${testNumber}`,
    name: `SAT Practice Test ${testNumber}`,
    source: 'College Board Official',
    type: 'full_test',
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

  // 8. 저장
  const outputPath = path.join(JSON_DIR, `sat-practice-test-${testNumber}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved: ${outputPath}`);
  console.log(`Total questions: ${output.totalQuestions}`);

  return output;
}

/**
 * 메인 실행
 */
async function main() {
  const arg = process.argv[2];

  if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable not set');
    console.error('Usage: GEMINI_API_KEY=your_key node scripts/convert-sat-tests.js 7');
    process.exit(1);
  }

  if (!arg) {
    console.log('Usage:');
    console.log('  node scripts/convert-sat-tests.js 7      # Convert test 7');
    console.log('  node scripts/convert-sat-tests.js all    # Convert all tests');
    process.exit(0);
  }

  if (arg === 'all') {
    for (const num of [4, 5, 6, 7, 8, 9, 10]) {
      await convertTest(num);
    }
  } else {
    const testNum = parseInt(arg);
    if (isNaN(testNum) || testNum < 4 || testNum > 10) {
      console.error('Invalid test number. Use 4-10 or "all".');
      process.exit(1);
    }
    await convertTest(testNum);
  }

  console.log('\n=== Conversion complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
