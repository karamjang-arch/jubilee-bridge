#!/usr/bin/env node
/**
 * 실패한 한국 시험 재변환
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { loadGeminiApiKey } = require('./lib/config');

const GEMINI_API_KEY = loadGeminiApiKey();
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const RAW_DIR = path.join(__dirname, '../public/tests/raw/korean');
const OUTPUT_DIR = path.join(__dirname, '../public/tests/json');

// Tests to retry
const RETRY_TESTS = [
  { file: '2023-3월-고3-수학-문제.pdf', id: 'korean-2023-3-g3-수학', subject: '수학', year: 2023, month: 3 },
  { file: '2025-9월-고3-국어-문제.pdf', id: 'korean-2025-9-g3-국어', subject: '국어', year: 2025, month: 9 },
];

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

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  // For math: escape LaTeX commands more aggressively
  // Replace common LaTeX that breaks JSON
  cleaned = cleaned.replace(/\\\\/g, '\\\\');
  cleaned = cleaned.replace(/\\frac/g, 'FRAC');
  cleaned = cleaned.replace(/\\sqrt/g, 'SQRT');
  cleaned = cleaned.replace(/\\times/g, 'x');
  cleaned = cleaned.replace(/\\div/g, '/');
  cleaned = cleaned.replace(/\\pm/g, '+-');
  cleaned = cleaned.replace(/\\leq/g, '<=');
  cleaned = cleaned.replace(/\\geq/g, '>=');
  cleaned = cleaned.replace(/\\neq/g, '!=');
  cleaned = cleaned.replace(/\\cdot/g, '*');

  // Escape control characters inside JSON strings
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

async function convertTest(testInfo) {
  const problemPdf = path.join(RAW_DIR, testInfo.file);
  const answerPdf = path.join(RAW_DIR, testInfo.file.replace('-문제.pdf', '-해설.pdf'));

  console.log(`\n변환: ${testInfo.id}`);

  if (!fs.existsSync(problemPdf)) {
    console.log('  문제 PDF 없음');
    return null;
  }

  console.log('  문제 PDF 추출...');
  const problemText = await extractPdfText(problemPdf);
  console.log(`    ${problemText.length} 글자`);

  let answerText = '';
  if (fs.existsSync(answerPdf)) {
    console.log('  해설 PDF 추출...');
    answerText = await extractPdfText(answerPdf);
    console.log(`    ${answerText.length} 글자`);
  }

  // Special prompt for math to handle LaTeX
  const isMath = testInfo.subject === '수학';

  const extractPrompt = `${isMath ? '수학' : '한국어'} 시험 PDF에서 모든 문제를 추출하세요.

시험 정보:
- 시험명: ${testInfo.year}학년도 ${testInfo.month}월 고3 교육청 모의고사 ${testInfo.subject}
- 과목: ${testInfo.subject}

${isMath ? `중요 - 수학 문제 처리:
- LaTeX 수식을 일반 텍스트로 변환
- 분수: a/b 형식
- 제곱근: sqrt(x) 형식
- 지수: x^2 형식
- 특수 기호: ×, ÷, ≤, ≥ 등은 문자 그대로
- 주관식 문제는 choices를 null로, answer에 숫자만
` : ''}

문제 텍스트:
${problemText.substring(0, 40000)}

${answerText ? `해설 텍스트 (정답 추출용):\n${answerText.substring(0, 15000)}` : ''}

JSON 형식:
{
  "questions": [
    {
      "number": 1,
      "question": "문제 텍스트 (수식은 일반 텍스트로)",
      "choices": ${isMath ? 'null 또는 ["1", "2", "3", "4", "5"]' : '["1) ...", "2) ...", "3) ...", "4) ...", "5) ..."]'},
      "answer": "정답",
      "skill": "문항 유형",
      "difficulty": "easy/medium/hard"
    }
  ]
}

Return ONLY valid JSON. No LaTeX commands (no backslash).`;

  console.log('  Gemini 변환 중...');
  const result = await callGemini(extractPrompt, 32000);
  const cleaned = cleanJsonResponse(result);

  try {
    const data = JSON.parse(cleaned);

    const output = {
      id: testInfo.id,
      name: `${testInfo.year}학년도 ${testInfo.month}월 고3 교육청 모의고사 ${testInfo.subject}`,
      source: '교육청',
      type: 'korean_exam',
      testType: 'gyoyukchung',
      year: testInfo.year,
      month: testInfo.month,
      subject: testInfo.subject,
      questions: data.questions || [],
      totalQuestions: data.questions?.length || 0,
      convertedAt: new Date().toISOString(),
    };

    const outputPath = path.join(OUTPUT_DIR, `${testInfo.id}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`  저장: ${outputPath}`);
    console.log(`  문항 수: ${output.totalQuestions}`);

    return output;
  } catch (e) {
    console.error(`  JSON 파싱 실패: ${e.message}`);
    console.error('  응답 샘플:', cleaned.substring(0, 300));
    return null;
  }
}

async function main() {
  console.log('=== 실패한 한국 시험 재변환 ===');

  for (const test of RETRY_TESTS) {
    // Delete existing if any
    const outputPath = path.join(OUTPUT_DIR, `${test.id}.json`);
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log(`삭제: ${test.id}`);
    }

    await convertTest(test);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=== 완료 ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
