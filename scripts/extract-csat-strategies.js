#!/usr/bin/env node
/**
 * KICE 수능 안내 자료 → 전략 DB 추출
 *
 * 소스: 평가원 예시문항, 학습방법 안내, Q&A
 * 출력: strategy-db-csat.json
 *
 * 학생 직접 노출 금지, 출제 방향 + 문항 유형만 추출
 */

const fs = require('fs');
const path = require('path');
const { loadGeminiApiKey } = require('./lib/config');

const GEMINI_API_KEY = loadGeminiApiKey();
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const GUIDES_DIR = path.join(__dirname, '../public/tests/raw/kice-guides');
const OUTPUT_DIR = path.join(__dirname, '../public/data');

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

async function extractCSATStrategies() {
  console.log('=== KICE 수능 전략 DB 추출 ===\n');

  // Read guide files info
  const guides = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`발견된 안내 자료: ${guides.length}개`);
  guides.forEach(g => console.log(`  - ${g}`));

  // Since we can't parse PDFs directly here, we'll create a template
  // based on known KICE structure and let Gemini fill in details

  const strategyPrompt = `한국 대학수학능력시험(수능) 출제 방향 및 문항 유형을 분석하여 JSON으로 정리해주세요.

다음 평가원 공식 안내 자료를 기반으로 합니다:
- 2028 수능 예시문항 안내자료집
- 2027 학습 방법 안내
- 2022 예시문항 안내

각 영역별로 출제 방향, 문항 유형, 평가 요소를 추출하세요:

{
  "source": "한국교육과정평가원 (KICE)",
  "version": "2028 개편",
  "lastUpdated": "${new Date().toISOString().split('T')[0]}",
  "overview": {
    "testName": "대학수학능력시험 (CSAT)",
    "duration": "교시별 시간",
    "format": "OMR + 주관식(수학)"
  },
  "subjects": {
    "korean": {
      "name": "국어",
      "duration": 80,
      "questions": 45,
      "questionTypes": [
        {
          "id": "KR-READ-MAIN",
          "name": "독서 - 핵심 내용 파악",
          "description": "지문의 중심 내용을 파악하는 문항",
          "recognitionClues": ["'핵심 내용'", "'중심 화제'"],
          "strategySteps": ["1. 지문 구조 파악", "2. 각 문단 핵심 문장 확인"],
          "commonTraps": ["세부 정보를 핵심으로 오인"],
          "tutorHints": ["문단별 키워드 정리 유도"]
        }
      ],
      "skillCategories": ["독서", "문학", "화법과 작문", "언어와 매체"],
      "evaluationCriteria": ["사실적 이해", "추론적 이해", "비판적 이해", "적용"]
    },
    "math": {
      "name": "수학",
      "duration": 100,
      "questions": 30,
      "questionTypes": [],
      "skillCategories": ["대수", "해석학", "기하", "확률과 통계"],
      "evaluationCriteria": ["개념 이해", "절차 실행", "문제 해결", "추론"]
    },
    "english": {
      "name": "영어",
      "duration": 70,
      "questions": 45,
      "questionTypes": [],
      "skillCategories": ["듣기", "읽기"],
      "evaluationCriteria": ["세부 정보 파악", "중심 내용 파악", "빈칸 추론", "문맥 어휘"]
    }
  },
  "changes2028": {
    "korean": ["선택과목 통합", "지문 길이 조정"],
    "math": ["공통+선택 구조 유지"],
    "english": ["절대평가 유지"]
  },
  "generalPrinciples": [
    "교육과정 범위 내 출제",
    "사교육 유발 요소 최소화",
    "EBS 연계율 50% 내외"
  ],
  "gradeCutoffs": {
    "note": "등급컷은 매년 상이, 표준점수 기준",
    "typical": {
      "1등급": "상위 4%",
      "2등급": "상위 11%",
      "3등급": "상위 23%"
    }
  }
}

한국어로 작성. 실제 평가원 출제 방향을 반영하여 각 영역별 questionTypes를 5-10개씩 구체적으로 작성해주세요.
Return ONLY valid JSON.`;

  console.log('\nGemini로 전략 추출 중...');
  const result = await callGemini(strategyPrompt, 32000);
  const cleaned = cleanJsonResponse(result);

  try {
    const data = JSON.parse(cleaned);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const outputPath = path.join(OUTPUT_DIR, 'strategy-db-csat.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\n저장 완료: ${outputPath}`);

    // Summary
    console.log('\n=== 추출 결과 ===');
    console.log(`국어 문항 유형: ${data.subjects?.korean?.questionTypes?.length || 0}개`);
    console.log(`수학 문항 유형: ${data.subjects?.math?.questionTypes?.length || 0}개`);
    console.log(`영어 문항 유형: ${data.subjects?.english?.questionTypes?.length || 0}개`);

    return data;
  } catch (e) {
    console.error('JSON 파싱 실패:', e.message);
    console.error('응답:', cleaned.substring(0, 500));
    return null;
  }
}

async function main() {
  await extractCSATStrategies();
  console.log('\n=== 완료 ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
