import { NextResponse } from 'next/server';

// ⛔ gemini-2.0-flash 사용 금지 (2026-03 deprecated)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// 숙제/시험 분석 시스템 프롬프트
const HOMEWORK_ANALYSIS_PROMPT = `You are analyzing a student's homework or test paper from a photo.

Tasks:
1. Identify each problem/question visible in the image
2. Read the student's written answer for each problem
3. Determine if each answer is correct or incorrect
4. Identify the mathematical/scientific concept being tested
5. If incorrect, identify the specific misconception

Return JSON only (no markdown, no code blocks):
{
  "problems": [
    {
      "problem_number": "1",
      "problem_text": "brief description of the problem",
      "student_answer": "what the student wrote",
      "correct_answer": "the actual correct answer",
      "is_correct": true/false,
      "concept_topic": "e.g. quadratic equations, Newton's second law",
      "concept_keywords": ["quadratic", "factoring"],
      "misconception": null or "description of misconception if wrong",
      "difficulty": "basic/intermediate/advanced"
    }
  ],
  "summary": {
    "total": 10,
    "correct": 7,
    "accuracy": 70,
    "weak_areas": ["factoring", "negative exponents"]
  }
}

If you cannot read the image clearly or it doesn't appear to be homework/test, return:
{
  "error": "Cannot analyze image",
  "reason": "description of the issue"
}`;

// 키워드로 개념 매칭 (간단한 includes 검색)
function matchConceptByKeywords(keywords, concepts) {
  if (!keywords || keywords.length === 0 || !concepts) return null;

  const normalizedKeywords = keywords.map(k => k.toLowerCase().trim());

  for (const [conceptId, concept] of Object.entries(concepts)) {
    const searchText = [
      concept.title_en || '',
      concept.title_ko || '',
      concept.core_description || '',
      concept.cluster || '',
    ].join(' ').toLowerCase();

    // 키워드 중 하나라도 매칭되면 반환
    for (const keyword of normalizedKeywords) {
      if (keyword.length >= 3 && searchText.includes(keyword)) {
        return {
          concept_id: conceptId,
          title: concept.title_ko || concept.title_en,
          cluster: concept.cluster,
        };
      }
    }
  }

  return null;
}

// XP 계산
function calculateXpReward(problems, accuracy) {
  let xp = 5; // 업로드 기본 XP

  // 정답당 +3 XP
  const correctCount = problems.filter(p => p.is_correct).length;
  xp += correctCount * 3;

  // 90% 이상 정확도 보너스
  if (accuracy >= 90) {
    xp += 20;
  }

  return xp;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      student_id,
      curriculum = 'us',
      image, // base64 encoded image
      subject = 'math', // default subject for concept matching
    } = body;

    // 필수 필드 검증
    if (!student_id || !image) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, image' },
        { status: 400 }
      );
    }

    // base64 크기 체크 (약 10MB)
    if (image.length > 14000000) {
      return NextResponse.json(
        { error: 'Image too large. Maximum 10MB allowed.' },
        { status: 400 }
      );
    }

    // Gemini Vision API 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: HOMEWORK_ANALYSIS_PROMPT },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: image.replace(/^data:image\/\w+;base64,/, ''),
                },
              },
            ],
          }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.3,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini Vision API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to analyze image', details: errorData },
        { status: 500 }
      );
    }

    const data = await response.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON 파싱 (코드 블록 제거)
    resultText = resultText.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();

    let analysisResult;
    try {
      analysisResult = JSON.parse(resultText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', resultText);
      return NextResponse.json(
        { error: 'Failed to parse analysis result', raw: resultText },
        { status: 500 }
      );
    }

    // 에러 응답 처리
    if (analysisResult.error) {
      return NextResponse.json({
        success: false,
        error: analysisResult.error,
        reason: analysisResult.reason,
      });
    }

    // 개념 매칭을 위한 CB 데이터 로드
    let concepts = null;
    const isKR = curriculum === 'kr';
    const subjectFile = isKR ? `cb-content-kr-${subject}.json` : `cb-content-${subject}.json`;

    try {
      const conceptsRes = await fetch(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/data/${subjectFile}`
      );
      if (conceptsRes.ok) {
        concepts = await conceptsRes.json();
      }
    } catch (err) {
      console.error('Failed to load concepts for matching:', err);
    }

    // 각 문제에 concept_id 매칭 추가
    const problemsWithConcepts = analysisResult.problems.map(problem => {
      const matched = matchConceptByKeywords(problem.concept_keywords, concepts);
      return {
        ...problem,
        matched_concept: matched,
      };
    });

    // XP 계산
    const accuracy = analysisResult.summary?.accuracy || 0;
    const xpEarned = calculateXpReward(problemsWithConcepts, accuracy);

    // concept_history에 기록
    const savedEvents = [];
    for (const problem of problemsWithConcepts) {
      try {
        const eventRes = await fetch(
          `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/concept-history`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id,
              event_type: 'homework_scan',
              curriculum,
              subject,
              concept_id: problem.matched_concept?.concept_id || null,
              score: problem.is_correct ? 100 : 0,
              detail: {
                problem_number: problem.problem_number,
                problem_text: problem.problem_text,
                student_answer: problem.student_answer,
                correct_answer: problem.correct_answer,
                misconception: problem.misconception,
                difficulty: problem.difficulty,
                source: 'homework_photo',
              },
            }),
          }
        );
        if (eventRes.ok) {
          savedEvents.push(problem.problem_number);
        }
      } catch (saveError) {
        console.error('Failed to save homework event:', saveError);
      }
    }

    // XP 기록
    try {
      await fetch(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/concept-history`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id,
            event_type: 'content_view', // XP 이벤트로 기록
            curriculum,
            subject,
            detail: {
              activity: 'homework_scan',
              xp_earned: xpEarned,
              accuracy,
              problems_count: problemsWithConcepts.length,
            },
          }),
        }
      );
    } catch (xpError) {
      console.error('Failed to record XP:', xpError);
    }

    return NextResponse.json({
      success: true,
      problems: problemsWithConcepts,
      summary: {
        ...analysisResult.summary,
        xp_earned: xpEarned,
        xp_breakdown: {
          upload: 5,
          correct_answers: problemsWithConcepts.filter(p => p.is_correct).length * 3,
          accuracy_bonus: accuracy >= 90 ? 20 : 0,
        },
      },
      saved_events: savedEvents.length,
    });

  } catch (error) {
    console.error('Homework scan API error:', error);
    return NextResponse.json(
      { error: '숙제 분석에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
