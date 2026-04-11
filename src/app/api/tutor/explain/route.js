import { NextResponse } from 'next/server';

// ⛔ gemini-2.0-flash 사용 금지
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDUiCcoHc-Nc4an3TGJLROvwNJJz1X15ak';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export async function POST(request) {
  try {
    const { question, choices, userAnswer, correctAnswer, skill, passage } = await request.json();

    // 선택지 텍스트 추출
    const userChoice = choices?.[userAnswer - 1] || `선택지 ${userAnswer}`;
    const correctChoice = choices?.[correctAnswer - 1] || `선택지 ${correctAnswer}`;

    const prompt = `학생이 시험 문제를 틀렸습니다. 친절하고 이해하기 쉽게 설명해주세요.

${passage ? `[지문]\n${passage}\n\n` : ''}[문제]
${question}

[선택지]
${choices?.map((c, i) => `${i + 1}. ${c}`).join('\n')}

[학생의 답] ${userChoice}
[정답] ${correctChoice}
[관련 개념] ${skill || '없음'}

다음 형식으로 설명해주세요:
1. 왜 학생의 답이 틀렸는지
2. 정답이 맞는 이유
3. 이 유형의 문제를 풀 때 주의할 점
4. 관련 개념 요약 (2-3문장)

한국어로 친절하게 설명해주세요. 학생을 격려하는 톤으로 작성하세요.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      throw new Error('Gemini API 호출 실패');
    }

    const data = await response.json();
    const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text || '설명을 생성할 수 없습니다.';

    return NextResponse.json({ explanation });

  } catch (error) {
    console.error('Tutor API error:', error);
    return NextResponse.json(
      { error: '튜터 응답 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
