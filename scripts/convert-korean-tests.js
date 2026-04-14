#!/usr/bin/env node
/**
 * 한국 시험 PDF → JSON 변환
 * - 교육청 모의고사
 * - 수능/모의평가
 *
 * Gemini를 사용하여 문제 추출
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

// Ensure output directory exists
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

  // Fix LaTeX double backslashes (\\) which break JSON parsing
  // Convert \\\\ to a placeholder, then back
  cleaned = cleaned.replace(/\\\\\\\\/g, '__QUAD_BS__');
  cleaned = cleaned.replace(/\\\\/g, '__DOUBLE_BS__');

  // Escape control characters inside JSON strings
  cleaned = cleaned.replace(/"([^"\\]|\\.)*"/g, (match) => {
    return match.replace(/[\x00-\x1F\x7F]/g, (char) => {
      if (char === '\n') return '\\n';
      if (char === '\r') return '\\r';
      if (char === '\t') return '\\t';
      return '';
    });
  });

  // Restore backslashes as single backslash (valid for JSON strings)
  cleaned = cleaned.replace(/__QUAD_BS__/g, '\\\\');
  cleaned = cleaned.replace(/__DOUBLE_BS__/g, '\\\\');

  // Try to fix truncated JSON by closing arrays/objects
  if (!cleaned.endsWith('}')) {
    // Count open brackets
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/\]/g) || []).length;
    const openBraces = (cleaned.match(/\{/g) || []).length;
    const closeBraces = (cleaned.match(/\}/g) || []).length;

    // Find last complete question
    const lastCompleteQ = cleaned.lastIndexOf('"number":');
    if (lastCompleteQ > 0) {
      // Find the start of this question object
      let braceCount = 0;
      let questionStart = lastCompleteQ;
      for (let i = lastCompleteQ; i >= 0; i--) {
        if (cleaned[i] === '}') braceCount++;
        if (cleaned[i] === '{') {
          braceCount--;
          if (braceCount < 0) {
            questionStart = i;
            break;
          }
        }
      }

      // Truncate to before this incomplete question and close properly
      cleaned = cleaned.substring(0, questionStart);
      // Remove trailing comma if present
      cleaned = cleaned.replace(/,\s*$/, '');
      // Close the array and object
      cleaned += ']}';
    }
  }

  return cleaned;
}

async function convertKoreanTest(problemPdf, answerPdf, testInfo) {
  console.log(`\n변환: ${testInfo.id}`);

  // Extract text from PDFs
  console.log('  문제 PDF 추출...');
  const problemText = await extractPdfText(problemPdf);
  console.log(`    ${problemText.length} 글자`);

  let answerText = '';
  if (fs.existsSync(answerPdf)) {
    console.log('  해설 PDF 추출...');
    answerText = await extractPdfText(answerPdf);
    console.log(`    ${answerText.length} 글자`);
  }

  // Convert with Gemini
  const extractPrompt = `이 한국 ${testInfo.subject} 시험 PDF에서 모든 문제를 추출하세요.

시험 정보:
- 시험명: ${testInfo.name}
- 과목: ${testInfo.subject}
- 년도: ${testInfo.year}
- 월: ${testInfo.month}

문제 텍스트:
${problemText.substring(0, 50000)}

${answerText ? `해설 텍스트 (정답 추출용):\n${answerText.substring(0, 20000)}` : ''}

JSON 형식으로 출력:
{
  "questions": [
    {
      "number": 1,
      "passage": "지문 또는 문제 상황 (있는 경우)",
      "question": "문제 텍스트",
      "choices": ["1) ...", "2) ...", "3) ...", "4) ...", "5) ..."],
      "answer": "정답 번호 (1-5)",
      "skill": "문항 유형 (독서/문학/어법/어휘/함수/도형 등)",
      "difficulty": "easy/medium/hard"
    }
  ]
}

중요:
- 한국어 유지, 번역 금지
- 모든 문항 추출 (국어 45문항, 수학 30문항, 영어 45문항 등)
- 5지선다형 문항이 대부분
- 수학은 주관식(단답형) 포함 가능 → choices를 null로, answer에 숫자만

Return ONLY valid JSON.`;

  console.log('  Gemini 변환 중...');
  const result = await callGemini(extractPrompt, 32000);
  const cleaned = cleanJsonResponse(result);

  try {
    const data = JSON.parse(cleaned);

    const output = {
      id: testInfo.id,
      name: testInfo.name,
      source: '교육청/평가원',
      type: 'korean_exam',
      testType: testInfo.testType,
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
    console.error('  응답:', cleaned.substring(0, 300));
    return null;
  }
}

async function main() {
  console.log('=== 한국 시험 PDF → JSON 변환 ===\n');

  // Find all test PDFs
  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('-문제.pdf'));
  console.log(`발견된 문제 PDF: ${files.length}개`);

  let converted = 0;
  let failed = 0;

  for (const file of files) {
    // Parse filename: 2024-3월-고3-국어-문제.pdf
    const match = file.match(/(\d{4})-(\d+)월-고(\d)-(\S+)-문제\.pdf/);
    if (!match) {
      console.log(`스킵 (패턴 불일치): ${file}`);
      continue;
    }

    const [, year, month, grade, subject] = match;
    const testId = `korean-${year}-${month}-g${grade}-${subject}`;
    const outputPath = path.join(OUTPUT_DIR, `${testId}.json`);

    // Skip if already converted
    if (fs.existsSync(outputPath)) {
      console.log(`이미 존재: ${testId}`);
      continue;
    }

    const problemPdf = path.join(RAW_DIR, file);
    const answerPdf = path.join(RAW_DIR, file.replace('-문제.pdf', '-해설.pdf'));

    const testInfo = {
      id: testId,
      name: `${year}학년도 ${month}월 고${grade} 교육청 모의고사 ${subject}`,
      testType: 'gyoyukchung',
      year: parseInt(year),
      month: parseInt(month),
      grade: parseInt(grade),
      subject,
    };

    try {
      const result = await convertKoreanTest(problemPdf, answerPdf, testInfo);
      if (result && result.totalQuestions > 0) {
        converted++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`변환 실패 (${testId}): ${e.message}`);
      failed++;
    }

    // Delay between conversions
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n=== 변환 완료 ===`);
  console.log(`성공: ${converted}`);
  console.log(`실패: ${failed}`);

  // List output files
  const outputFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('korean-'));
  console.log(`\n총 한국 시험 JSON: ${outputFiles.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
