import { NextResponse } from 'next/server';

// ⛔ gemini-2.0-flash 사용 금지 (2026-03 deprecated)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Deep Solve 시스템 프롬프트 생성
function buildSystemPrompt(context) {
  const {
    concept_title,
    concept_description,
    prerequisites = [],
    mastery_status = 'learning',
    common_errors = [],
    question_context = null,
  } = context;

  let systemPrompt = `You are a patient, Socratic math/science tutor for K-12 students.

When a student asks a question or says they don't understand:

**Step 1 - Diagnose**: Identify what specific part they're stuck on. Ask ONE clarifying question.

**Step 2 - Trace prerequisites**: Check if the confusion comes from a missing prerequisite concept. If so:
- ALWAYS include a tag in this exact format: [PREREQ: prerequisite_concept_name]
- This tag helps the system show a "review this first" button to the student
- Example: If a student struggles with quadratic equations due to weak factoring skills, include [PREREQ: Factoring Polynomials] in your response

**Step 3 - Explain**: Give a clear, step-by-step explanation using:
- A concrete real-world analogy first
- Then the formal definition
- Then a worked example

**Step 4 - Verify**: Ask the student a simple check question to confirm understanding.

## Rules
- Never give the full answer immediately. Guide them to discover it.
- Use simple language. Avoid jargon unless you define it first.
- If the student is wrong, don't say "wrong". Say "interesting approach, but let's think about..."
- Maximum 3 sentences per response unless doing a worked example.
- Reference the concept's prerequisites when relevant.
- Respond in Korean (한국어로 응답하세요).

## Current Context
- 개념: ${concept_title}
- 설명: ${concept_description || '없음'}
- 선수개념: ${prerequisites.length > 0 ? prerequisites.map(p => p.title || p.concept_id).join(', ') : '없음'}
- 학생 숙달도: ${mastery_status}`;

  if (common_errors.length > 0) {
    systemPrompt += `\n- 흔한 실수: ${common_errors.slice(0, 3).join('; ')}`;
  }

  if (question_context) {
    systemPrompt += `\n\n## 오답 문제 컨텍스트
- 문제: ${question_context.question}
- 학생의 답: ${question_context.user_answer}
- 정답: ${question_context.correct_answer}
- 오답 함정: ${question_context.error_trap || '없음'}`;
  }

  return systemPrompt;
}

// Socratic 오답 초기 메시지 생성
function buildWrongAnswerInitialMessage(question_context) {
  return `방금 문제를 풀었는데, 정답이 아니었네요. 괜찮아요, 이런 실수를 통해 배우는 거예요! 😊

먼저 궁금해요 — **왜 그 답을 선택했어요?** 어떤 생각으로 그 답이 맞다고 생각했는지 알려주세요.`;
}

// 대화 이력을 Gemini 형식으로 변환
function formatMessagesForGemini(messages, systemPrompt) {
  const contents = [];

  // 시스템 프롬프트를 첫 user 메시지로 포함
  if (systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: `[System Instructions]\n${systemPrompt}\n\n[Start of Conversation]` }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: '네, 이해했습니다. 학생을 도와드릴 준비가 되었습니다.' }]
    });
  }

  // 대화 이력 추가
  for (const msg of messages) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  }

  return contents;
}

// 응답에서 선수개념 추출
function extractSuggestedPrerequisites(text) {
  const prereqMatches = text.matchAll(/\[PREREQ:\s*([^\]]+)\]/gi);
  const prerequisites = [];
  for (const match of prereqMatches) {
    prerequisites.push(match[1].trim());
  }
  return prerequisites;
}

// 응답에서 [PREREQ: ...] 태그 제거
function cleanResponse(text) {
  return text.replace(/\[PREREQ:\s*[^\]]+\]/gi, '').trim();
}

// Step-by-step visual solution prompt
const STEP_BY_STEP_PROMPT = `Create a step-by-step HTML animation solving this problem:
{problem_text}

Requirements:
- Show each step one at a time when clicking "Next" button
- Highlight the current operation in each step
- Use KaTeX for math rendering (CDN: https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js and katex.min.css)
- Clean, minimal design with white background
- Max 5 steps
- Include step numbers and brief explanation for each step
- Make it responsive (works in 400px width)
- Self-contained HTML with inline styles

Return ONLY the HTML code, no markdown wrapping.`;

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      student_id,
      concept_id,
      messages = [],
      action = 'chat', // 'chat' | 'wrong_answer_help' | 'step_by_step_visual'
      context = {},
    } = body;

    // 필수 필드 검증
    if (!concept_id) {
      return NextResponse.json(
        { error: 'Missing required field: concept_id' },
        { status: 400 }
      );
    }

    // Step-by-step visual solution
    if (action === 'step_by_step_visual') {
      const problemText = context.question_context?.question || context.problem_text || '';
      if (!problemText) {
        return NextResponse.json(
          { error: 'Missing problem_text for step_by_step_visual' },
          { status: 400 }
        );
      }

      const prompt = STEP_BY_STEP_PROMPT.replace('{problem_text}', problemText);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.5,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        return NextResponse.json(
          { error: 'Failed to generate step-by-step solution' },
          { status: 500 }
        );
      }

      const data = await response.json();
      let html = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean up HTML response
      html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();

      return NextResponse.json({
        html,
        type: 'step_by_step_visual',
      });
    }

    // 대화 턴 제한 (최대 10회)
    if (messages.length > 20) { // 10턴 = 20메시지 (user+assistant)
      return NextResponse.json({
        reply: '대화가 많이 길어졌네요! 🙌 여기까지 배운 내용을 정리해볼까요? 더 궁금한 건 선생님에게 직접 질문해보세요.',
        suggested_prerequisites: [],
        follow_up_question: '',
        turn_limit_reached: true,
      });
    }

    // 시스템 프롬프트 생성
    const systemPrompt = buildSystemPrompt({
      concept_title: context.concept_title || concept_id,
      concept_description: context.concept_description,
      prerequisites: context.prerequisites || [],
      mastery_status: context.mastery_status || 'learning',
      common_errors: context.common_errors || [],
      question_context: action === 'wrong_answer_help' ? context.question_context : null,
    });

    // 오답 모드일 때 초기 메시지 생성
    let messagesToSend = [...messages];
    if (action === 'wrong_answer_help' && messages.length === 0) {
      // 첫 메시지가 없으면 Socratic 질문으로 시작
      return NextResponse.json({
        reply: buildWrongAnswerInitialMessage(context.question_context),
        suggested_prerequisites: [],
        follow_up_question: '',
        is_initial: true,
      });
    }

    // Gemini API 호출
    const contents = formatMessagesForGemini(messagesToSend, systemPrompt);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      throw new Error('Gemini API 호출 실패');
    }

    const data = await response.json();
    const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 생성할 수 없습니다.';

    // 선수개념 추출 및 응답 정리
    const suggestedPrerequisites = extractSuggestedPrerequisites(rawReply);
    const cleanedReply = cleanResponse(rawReply);

    return NextResponse.json({
      reply: cleanedReply,
      suggested_prerequisites: suggestedPrerequisites,
      follow_up_question: '', // 향후 확장용
    });

  } catch (error) {
    console.error('Tutor API error:', error);
    return NextResponse.json(
      { error: '튜터 응답 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
