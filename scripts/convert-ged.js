#!/usr/bin/env node
/**
 * 검정고시 PDF → JSON 변환
 * 지원: 고졸/중졸/초졸, 2020-2025년
 */

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDUiCcoHc-Nc4an3TGJLROvwNJJz1X15ak';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const RAW_DIR = path.join(__dirname, '../public/tests/raw/ged');
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
  cleaned = cleaned.replace(/\\pm/g, '+-');
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
  // Pattern: ged-[level]-[year]-[round]-[subject].pdf
  const match = filename.match(/ged-(high|mid|unknown)-(\d{4})-(\d)-(.+)\.pdf/);
  if (!match) return null;

  const levelMap = {
    high: '고졸',
    mid: '중졸',
    unknown: '초졸'
  };

  return {
    level: match[1],
    levelKo: levelMap[match[1]] || '초졸',
    year: parseInt(match[2]),
    round: parseInt(match[3]),
    subject: match[4],
    id: `ged-${match[1]}-${match[2]}-${match[3]}-${match[4]}`,
    name: `${match[2]}년도 제${match[3]}회 ${levelMap[match[1]]} 검정고시 ${match[4]}`,
  };
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
      "question": "문제 텍스트",
      "choices": ["1) ...", "2) ...", "3) ...", "4) ...", "5) ..."],
      "answer": "정답 번호",
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
      source: '검정고시지원센터',
      type: 'ged_exam',
      testType: 'ged',
      level: info.level,
      levelKo: info.levelKo,
      year: info.year,
      round: info.round,
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
  console.log('=== 검정고시 PDF → JSON 변환 ===\n');

  const files = fs.readdirSync(RAW_DIR).filter(f => f.startsWith('ged-') && f.endsWith('.pdf'));
  console.log(`발견된 PDF: ${files.length}개\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const info = parseFilename(file);
    if (!info) {
      console.log(`스킵 (패턴 불일치): ${file}`);
      skipped++;
      continue;
    }

    const outputPath = path.join(OUTPUT_DIR, `${info.id}.json`);
    if (fs.existsSync(outputPath)) {
      console.log(`존재: ${info.id}`);
      skipped++;
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

    // Rate limit: 1 request per 1.5 seconds
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n=== 결과 ===`);
  console.log(`성공: ${success}, 실패: ${failed}, 스킵: ${skipped}`);

  const jsonFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('ged-'));
  console.log(`총 검정고시 JSON: ${jsonFiles.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
