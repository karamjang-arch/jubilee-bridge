import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// Google Sheets 인증 (concept_history 기록용)
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// concept_history에 에세이 채점 결과 기록
async function recordEssayToConceptHistory(studentId, result, metadata) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      console.log('GOOGLE_SHEET_ID not set, skipping concept_history recording');
      return;
    }

    const row = [
      studentId || 'anonymous',
      'essay_submit',
      new Date().toISOString(),
      metadata.language === 'ko' ? 'kr' : 'us',
      'essay',
      `ESSAY-${metadata.essayType?.toUpperCase() || 'GENERAL'}`,
      String(result.total_score || 0),
      '',  // duration_sec (not tracked for essays)
      JSON.stringify({
        track: metadata.essayType,
        gradeBand: metadata.gradeBand,
        axes: result.axes?.map(a => ({ key: a.key, score: a.score, max: a.max })),
        charCount: metadata.charCount,
        wordCount: metadata.wordCount
      })
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'concept_history!A:I',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });

    console.log('Recorded essay to concept_history:', studentId, result.total_score);
  } catch (error) {
    // 기록 실패해도 채점 결과는 반환
    console.error('Failed to record essay to concept_history:', error.message);
  }
}

// API 키는 .env.local에 설정 필요: GEMINI_API_KEY=...
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite-preview-06-17';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Load rubric reference
function loadRubric(isKorean = false) {
  const rubricFile = isKorean
    ? 'data/scoring_rubric_reference_ko.json'
    : 'data/scoring_rubric_reference.json';
  const rubricPath = path.join(process.cwd(), rubricFile);
  if (fs.existsSync(rubricPath)) {
    return JSON.parse(fs.readFileSync(rubricPath, 'utf-8'));
  }
  const fallbackPath = path.join(process.cwd(), 'data/scoring_rubric_reference.json');
  if (fs.existsSync(fallbackPath)) {
    return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
  }
  return null;
}

// Grade band expectations
const GRADE_EXPECTATIONS = {
  elementary: {
    label: 'Elementary (K-5)',
    labelKo: '초등',
    levelRange: [1, 2],
    wordMin: 50,
    description: '기초 수준 - 간단한 문장 구조, 기본적인 아이디어 전달'
  },
  middle: {
    label: 'Middle School (6-8)',
    labelKo: '중등',
    levelRange: [2, 3],
    wordMin: 100,
    description: '중급 수준 - 문단 구성, 논리적 연결, 증거 제시 시작'
  },
  high: {
    label: 'High School (9-12)',
    labelKo: '고등',
    levelRange: [3, 5],
    wordMin: 200,
    description: '고급 수준 - 정교한 논증, 다양한 문체, 깊이 있는 분석'
  }
};

// Track definitions
const TRACK_AXES = {
  general: {
    name: '일반 에세이',
    nameEn: 'General Essay',
    axes: [
      { key: 'thesis_focus', name: '주제 충실도', nameEn: 'Thesis Focus', max: 20 },
      { key: 'audience_awareness', name: '독자 인식', nameEn: 'Audience Awareness', max: 15 },
      { key: 'voice_style', name: '표현력', nameEn: 'Voice & Style', max: 20 },
      { key: 'organization', name: '구조', nameEn: 'Organization', max: 25 },
      { key: 'evidence_support', name: '근거 활용', nameEn: 'Evidence & Support', max: 20 }
    ]
  },
  book_response: {
    name: '독서 에세이',
    nameEn: 'Book Response',
    axes: [
      { key: 'text_comprehension', name: '텍스트 이해도', nameEn: 'Text Comprehension', max: 20 },
      { key: 'critical_perspective', name: '비평적 관점', nameEn: 'Critical Perspective', max: 15 },
      { key: 'personal_connection', name: '개인 연결', nameEn: 'Personal Connection', max: 20 },
      { key: 'organization', name: '구조', nameEn: 'Organization', max: 25 },
      { key: 'textual_evidence', name: '텍스트 근거', nameEn: 'Textual Evidence', max: 20 }
    ]
  },
  argumentative: {
    name: '입시 논술',
    nameEn: 'Argumentative Essay',
    axes: [
      { key: 'reading_comprehension', name: '독해력', nameEn: 'Reading Comprehension', max: 20 },
      { key: 'critical_thinking', name: '비판적 사고', nameEn: 'Critical Thinking', max: 15 },
      { key: 'synthesis', name: '종합적 재구성', nameEn: 'Synthesis', max: 20 },
      { key: 'logical_structure', name: '논리력', nameEn: 'Logical Structure', max: 25 },
      { key: 'expression', name: '표현력', nameEn: 'Expression', max: 20 }
    ]
  }
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { grade_band, language, essay_type, prompt_text, book_title, essay_text } = body;

    // Validation
    if (!essay_text || essay_text.trim().length < 30) {
      return NextResponse.json({ error: '에세이가 너무 짧습니다 (최소 30자)' }, { status: 400 });
    }

    // Default to 'general' if essay_type not specified
    const trackType = essay_type || 'general';
    if (!TRACK_AXES[trackType]) {
      return NextResponse.json({ error: '잘못된 에세이 유형입니다' }, { status: 400 });
    }

    const isKorean = language === 'ko';
    const rubric = loadRubric(isKorean);
    if (!rubric) {
      return NextResponse.json({ error: '채점 기준을 불러올 수 없습니다' }, { status: 500 });
    }

    const gradeExpect = GRADE_EXPECTATIONS[grade_band] || GRADE_EXPECTATIONS.high;
    const trackConfig = TRACK_AXES[trackType];

    // Build scoring prompt
    const scoringPrompt = buildScoringPrompt(rubric, gradeExpect, trackType, trackConfig, prompt_text, book_title, essay_text, isKorean);

    // Call Gemini
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: scoringPrompt }] }],
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json({ error: 'AI 채점 중 오류 발생' }, { status: 500 });
    }

    const data = await response.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    let result;
    try {
      if (resultText.includes('```json')) {
        resultText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (resultText.includes('```')) {
        resultText = resultText.replace(/```\n?/g, '');
      }
      result = JSON.parse(resultText.trim());
    } catch (e) {
      console.error('JSON parse error:', e, resultText);
      return NextResponse.json({ error: 'AI 응답 파싱 오류' }, { status: 500 });
    }

    // Add metadata
    result.metadata = {
      gradeBand: grade_band,
      language: language,
      essayType: trackType,
      trackName: isKorean ? trackConfig.name : trackConfig.nameEn,
      bookTitle: book_title || null,
      wordCount: essay_text.split(/\s+/).length,
      charCount: essay_text.length,
      scoredAt: new Date().toISOString(),
    };

    // concept_history에 기록 (비동기, 실패해도 결과 반환)
    const studentId = body.student_id || 'anonymous';
    recordEssayToConceptHistory(studentId, result, result.metadata).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    console.error('Essay scoring error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildScoringPrompt(rubric, gradeExpect, trackType, trackConfig, promptText, bookTitle, essayText, isKorean) {
  const lang = isKorean ? '한국어' : 'English';
  const levelDesc = `Level ${gradeExpect.levelRange[0]}-${gradeExpect.levelRange[1]} (${gradeExpect.description})`;
  const axes = trackConfig.axes;

  // Build axes description for prompt
  const axesDesc = axes.map((ax, i) => {
    const name = isKorean ? ax.name : ax.nameEn;
    return `${i + 1}. ${ax.key} (${ax.max}점): ${name}`;
  }).join('\n');

  // Build JSON template for prompt
  const axesTemplate = axes.map(ax => {
    const name = isKorean ? ax.name : ax.nameEn;
    return `    { "key": "${ax.key}", "name": "${name}", "score": ${Math.floor(ax.max * 0.75)}, "max": ${ax.max}, "feedback": "구체적 피드백" }`;
  }).join(',\n');

  // Get rubric summary based on track
  let rubricSummary = '';
  if (trackType === 'book_response' && rubric.bookResponseRubric) {
    rubricSummary = Object.entries(rubric.bookResponseRubric)
      .map(([key, val]) => {
        if (!val.criteria) return '';
        return `${val.name}: ${val.criteria.map(c => `L${c.level}: ${c.description}`).join(' | ')}`;
      })
      .filter(Boolean)
      .join('\n');
  } else {
    rubricSummary = Object.entries(rubric.rubric || {})
      .slice(0, 5)
      .map(([key, val]) => {
        if (!val.criteria) return '';
        return `${val.name}: ${val.criteria.map(c => `L${c.level}: ${c.description}`).join(' | ')}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  // Korean-specific rubric for argumentative essays
  let krSpecificSummary = '';
  if (isKorean && trackType === 'argumentative' && rubric.koreanSpecificRubric) {
    krSpecificSummary = Object.entries(rubric.koreanSpecificRubric)
      .map(([key, val]) => {
        if (!val.criteria) return '';
        return `${val.name}: ${val.criteria.map(c => `L${c.level}: ${c.description}`).join(' | ')}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  // Get writing tips
  const tips = isKorean
    ? (rubric.writingTips?.slice(0, 5).join('\n- ') || '')
    : '';

  // Get good/bad traits
  const goodTraits = isKorean
    ? (rubric.essayFeatures?.goodTraits?.slice(0, 4).map(t => t.trait).join(', ') || '')
    : (rubric.essayFeatures?.goodEssayTraits?.slice(0, 4).map(t => t.trait).join(', ') || '');
  const badTraits = isKorean
    ? (rubric.essayFeatures?.badTraits?.slice(0, 4).map(t => t.trait).join(', ') || '')
    : (rubric.essayFeatures?.badEssayTraits?.slice(0, 4).map(t => t.trait).join(', ') || '');

  // Build track-specific context
  let trackContext = '';
  if (trackType === 'general') {
    trackContext = isKorean
      ? '일반 에세이: 자유 주제로 자기 생각을 논리적으로 표현하는 글입니다.'
      : 'General Essay: Express your thoughts logically on a free topic.';
  } else if (trackType === 'book_response') {
    const bookInfo = bookTitle ? `\n책 제목: "${bookTitle}"` : '';
    trackContext = isKorean
      ? `독서 에세이: 책을 읽고 분석/감상을 작성하는 글입니다.${bookInfo}`
      : `Book Response: Analyze and respond to a book you've read.${bookInfo}`;
  } else if (trackType === 'argumentative') {
    trackContext = isKorean
      ? '입시 논술: 제시문을 분석하고 자신의 논점을 전개하는 학술적 글입니다.'
      : 'Argumentative Essay: Analyze given passages and develop your argument.';
  }

  // Build the prompt
  if (isKorean) {
    return `당신은 ${trackConfig.name} 채점 전문가입니다.

## 트랙
${trackContext}

## 채점 기준
${rubricSummary}
${krSpecificSummary ? `\n## 한국어 고유 기준\n${krSpecificSummary}` : ''}

## 글쓰기 원칙
- ${tips}

## 좋은 에세이 특징
${goodTraits}

## 피해야 할 특징
${badTraits}

## 학년 수준
${gradeExpect.labelKo} - ${levelDesc}

${promptText ? `## 프롬프트/제시문\n${promptText}\n` : ''}

## 학생 에세이
${essayText}

---

위 에세이를 다음 5개 축으로 채점하고 JSON으로 반환하세요:

${axesDesc}

JSON 형식:
{
  "total_score": 75,
  "axes": [
${axesTemplate}
  ],
  "strengths": ["강점 1", "강점 2"],
  "improvements": ["개선점 1", "개선점 2"],
  "model_sentence": "이 에세이에서 가장 잘 쓴 문장 또는 개선된 모범 문장 예시"
}

Return ONLY valid JSON.`;
  }

  // English prompt
  return `You are an expert ${trackConfig.nameEn} grader.

## Track
${trackContext}

## Scoring Rubric
${rubricSummary}

## Good Essay Traits
${goodTraits}

## Traits to Avoid
${badTraits}

## Grade Level
${gradeExpect.label} - ${levelDesc}

${promptText ? `## Prompt\n${promptText}\n` : ''}

## Student Essay
${essayText}

---

Score this essay on these 5 axes and return JSON:

${axesDesc}

JSON format:
{
  "total_score": 75,
  "axes": [
${axesTemplate}
  ],
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "model_sentence": "Best sentence from essay or improved example"
}

Return ONLY valid JSON.`;
}
