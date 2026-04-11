#!/usr/bin/env node
/**
 * 모든 한국 시험 PDF → JSON 변환
 * 지원: 교육청, 평가원, 수능
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDUiCcoHc-Nc4an3TGJLROvwNJJz1X15ak';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const RAW_DIR = path.join(__dirname, '../public/tests/raw/korean');
const OUTPUT_DIR = path.join(__dirname, '../public/tests/json');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

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

  // Escape LaTeX for math
  cleaned = cleaned.replace(/\\frac/g, 'FRAC');
  cleaned = cleaned.replace(/\\sqrt/g, 'SQRT');
  cleaned = cleaned.replace(/\\times/g, 'x');
  cleaned = cleaned.replace(/\\div/g, '/');
  cleaned = cleaned.replace(/\\\\/g, '\\\\');

  // Escape control characters
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

function parseFilename(filename) {
  // Pattern 1: 2024-3월-고3-국어-문제.pdf (교육청)
  let match = filename.match(/(\d{4})-(\d+)월-고(\d)-(\S+)-문제\.pdf/);
  if (match) {
    return {
      type: 'gyoyukchung',
      year: parseInt(match[1]),
      month: parseInt(match[2]),
      grade: parseInt(match[3]),
      subject: match[4],
      id: `korean-${match[1]}-${match[2]}-g${match[3]}-${match[4]}`,
      name: `${match[1]}학년도 ${match[2]}월 고${match[3]} 교육청 모의고사 ${match[4]}`,
    };
  }

  // Pattern 2: 평가원-2024-6월-국어-문제.pdf
  match = filename.match(/평가원-(\d{4})-(\d+)월-(\S+)-문제\.pdf/);
  if (match) {
    return {
      type: 'pyeongwon',
      year: parseInt(match[1]),
      month: parseInt(match[2]),
      subject: match[3],
      id: `korean-pyeongwon-${match[1]}-${match[2]}-${match[3]}`,
      name: `${match[1]}학년도 ${match[2]}월 평가원 모의평가 ${match[3]}`,
    };
  }

  // Pattern 3: 수능-2024-국어-문제.pdf
  match = filename.match(/수능-(\d{4})-(\S+)-문제\.pdf/);
  if (match) {
    return {
      type: 'csat',
      year: parseInt(match[1]),
      month: 11,
      subject: match[2],
      id: `korean-csat-${match[1]}-${match[2]}`,
      name: `${match[1]}학년도 대학수학능력시험 ${match[2]}`,
    };
  }

  return null;
}

async function convertTest(pdfFile, info) {
  console.log(`\n변환: ${info.id}`);

  const pdfPath = path.join(RAW_DIR, pdfFile);
  console.log('  PDF 추출...');
  const text = await extractPdfText(pdfPath);
  console.log(`    ${text.length} 글자`);

  const isMath = info.subject === '수학';

  const prompt = `${info.name} 시험 PDF에서 모든 문제를 추출하세요.

${isMath ? `수학 문제 처리:
- LaTeX 수식을 일반 텍스트로 변환 (분수: a/b, 제곱근: sqrt(x), 지수: x^2)
- 주관식은 choices를 null로, answer에 숫자만
` : ''}

문제 텍스트:
${text.substring(0, 45000)}

JSON 형식:
{
  "questions": [
    {
      "number": 1,
      "passage": "지문 (있는 경우)",
      "question": "문제 텍스트",
      "choices": ${isMath ? 'null 또는 ["1", "2", "3", "4", "5"]' : '["1) ...", "2) ...", "3) ...", "4) ...", "5) ..."]'},
      "answer": "정답",
      "skill": "문항 유형"
    }
  ]
}

Return ONLY valid JSON.`;

  console.log('  Gemini 변환...');
  const result = await callGemini(prompt, 32000);
  const cleaned = cleanJsonResponse(result);

  try {
    const data = JSON.parse(cleaned);

    const output = {
      id: info.id,
      name: info.name,
      source: info.type === 'csat' ? '평가원' : info.type === 'pyeongwon' ? '평가원' : '교육청',
      type: 'korean_exam',
      testType: info.type,
      year: info.year,
      month: info.month,
      subject: info.subject,
      questions: data.questions || [],
      totalQuestions: data.questions?.length || 0,
      convertedAt: new Date().toISOString(),
    };

    const outputPath = path.join(OUTPUT_DIR, `${info.id}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`  저장: ${output.totalQuestions}문항`);

    return output;
  } catch (e) {
    console.error(`  실패: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('=== 한국 시험 전체 변환 ===\n');

  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('-문제.pdf'));
  console.log(`발견된 문제 PDF: ${files.length}개\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const info = parseFilename(file);
    if (!info) {
      console.log(`스킵 (패턴 불일치): ${file}`);
      continue;
    }

    const outputPath = path.join(OUTPUT_DIR, `${info.id}.json`);
    if (fs.existsSync(outputPath)) {
      console.log(`존재: ${info.id}`);
      continue;
    }

    try {
      const result = await convertTest(file, info);
      if (result && result.totalQuestions > 0) {
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`오류 (${info.id}): ${e.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${success}, 실패: ${failed}`);

  const jsonFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('korean-'));
  console.log(`총 한국 시험 JSON: ${jsonFiles.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
