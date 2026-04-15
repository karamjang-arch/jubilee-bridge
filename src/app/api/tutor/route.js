import { NextResponse } from 'next/server';

// ⛔ gemini-2.0-flash 사용 금지 (2026-03 deprecated)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// 한글 포함 여부로 언어 감지
function detectLanguage(text) {
  const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;
  return koreanRegex.test(text) ? 'ko' : 'en';
}

// 메시지에서 주 언어 감지
function detectConversationLanguage(messages) {
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
  return detectLanguage(userMessages);
}

// Socratic Tutor 시스템 프롬프트 생성
function buildSystemPrompt(context) {
  const {
    concept_title,
    concept_description,
    prerequisite_ids = [],
    mastery_status = 'learning',
    student_grade = null,
    curriculum = 'us', // 'us' or 'kr'
    question_context = null,
    language = 'ko',
  } = context;

  const langInstruction = language === 'ko'
    ? 'Respond in Korean (한국어로 응답하세요).'
    : 'Respond in English.';

  let systemPrompt = `You are a Socratic AI tutor for K-12 students.

## CORE IDENTITY
- You guide students to discover answers, NEVER give direct answers
- You are both an academic coach and a caring mentor
- Your tone: warm but direct. Clear language, no vague comfort
- ${langInstruction}

## SOCRATIC METHOD (4 Question Types)
1. CLARIFICATION: "What do you think is the most important information here?"
2. PROBING ASSUMPTIONS: "Why did you think this strategy fits this problem?"
3. ALTERNATIVE PERSPECTIVES: "Could you approach this differently?"
4. EVIDENCE & REASONS: "What specific evidence supports your conclusion?"

Use in order: Clarify → Probe assumptions → Offer alternatives → Demand evidence

## MISCONCEPTION TRACKING
- Wrong answers are NOT simple mistakes. They reveal BUGS in the student's logic
- When a student answers incorrectly: "Walk me through your thinking step by step"
- Find the ROOT misconception, not the surface mistake

## RESPONSE RULES
- Maximum 3 sentences per response (unless doing a worked example)
- First response: ALWAYS a diagnostic question, never an explanation
- Use real-world analogies before formal definitions
- For math: visual/spatial explanations first, then algebraic
- Never say "wrong" - say "interesting approach, let's think about..."

## CURRICULUM AWARENESS`;

  if (curriculum === 'kr') {
    systemPrompt += `
### Korean Curriculum (수능 prep)
- 수능 스타일: 개념의 정확한 이해 + 빠른 적용 강조
- 수학: 공식 유도 과정을 이해시킨 후 적용 연습
- 과학: 개념 간 연결고리와 그래프 해석 능력 강조
- EBS 연계 학습 패턴 인지
- 한국어로 질문하면 한국어로 답변`;
  } else {
    systemPrompt += `
### US Curriculum (SAT prep)
- Emphasize context clues, Desmos visualization, adaptive thinking
- "What nuance does this word carry in context?"
- Reference Common Core / Indiana Academic Standards when relevant
- Students may be in Excel (2yr ahead) or Challenge (1yr ahead) tracks`;
  }

  systemPrompt += `

## EMOTIONAL AWARENESS
- Frustration (짧은 답, "모르겠어요"): "어려운 부분이죠. 작은 조각으로 나눠볼까요?"
- Anxiety (완벽주의): "완벽하지 않아도 괜찮아요. 같이 탐색해봅시다."
- Cynicism ("이거 왜 배워요?"): "좋은 질문이에요. 너는 왜 필요 없다고 생각해?" - give them control
- Never force motivation. Ask what THEY think would help.

## SESSION MANAGEMENT
- Maximum 10 turns per session
- At turn 8+, or when student says thanks/끝/고마워:
  "Before we finish, can you tell me in ONE sentence what was the most important thing you learned today?"
- End with encouragement, not homework

## DATA TAGS (include in your responses when applicable)
- [PREREQ: concept_name] - when you identify a missing prerequisite
- [MISCONCEPTION: brief description] - when you identify a specific misconception the student has
These tags will be parsed by the system. Place them at the end of your response.

## Current Context
- Concept: ${concept_title}
- Description: ${concept_description || 'None'}
- Prerequisites: ${prerequisite_ids.length > 0 ? prerequisite_ids.join(', ') : 'None'}
- Student grade: ${student_grade || 'Unknown'}
- Curriculum: ${curriculum === 'kr' ? '한국 수능' : 'US SAT'}
- Mastery: ${mastery_status}`;

  if (question_context) {
    systemPrompt += `

## Wrong Answer Context
- Question: ${question_context.question}
- Student's answer: ${question_context.user_answer}
- Correct answer: ${question_context.correct_answer}
- Error trap: ${question_context.error_trap || 'None'}`;
  }

  return systemPrompt;
}

// 오답 모드 초기 메시지 생성
function buildWrongAnswerInitialMessage(language) {
  if (language === 'ko') {
    return `방금 문제를 풀었는데, 정답이 아니었네요. 괜찮아요! 😊

**어떻게 그 답을 골랐는지 설명해줄래요?** 네가 생각한 과정을 듣고 싶어요.`;
  }
  return `You just answered a question, and it wasn't quite right. That's okay! 😊

**Can you walk me through how you got to that answer?** I'd like to understand your thinking.`;
}

// 오답 모드 시스템 프롬프트 추가
function buildWrongAnswerSystemAddendum(language) {
  if (language === 'ko') {
    return `

## WRONG ANSWER MODE
학생이 오답을 선택했습니다. 아직 왜 틀렸는지 설명하지 마세요.

Step 1: "어떻게 그 답을 골랐는지 설명해줄래요?"라고 물어보세요
Step 2: 학생의 논리적 버그를 찾으세요 (표면적 실수가 아닌)
Step 3: 그 버그를 드러내는 타겟 질문을 하세요 - [MISCONCEPTION: 발견된 오개념] 태그 추가
Step 4: 올바른 추론으로 유도하세요
Step 5: 이해 확인을 위해 비슷한 문제 하나를 제시하세요

기억하세요: 오답은 무지가 아니라 오개념을 드러냅니다.`;
  }
  return `

## WRONG ANSWER MODE
The student chose the wrong answer. DO NOT explain why it's wrong yet.

Step 1: Ask "Walk me through how you got to that answer"
Step 2: Listen for the logical bug (not the surface mistake)
Step 3: Ask a targeted question that exposes the bug - add [MISCONCEPTION: description] tag
Step 4: Guide them to the correct reasoning
Step 5: Give ONE similar problem to verify understanding

Remember: the wrong answer reveals a misconception, not ignorance.`;
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
      parts: [{ text: 'Understood. I\'m ready to help the student using the Socratic method.' }]
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

// 응답에서 오개념 추출
function extractMisconceptions(text) {
  const misconceptionMatches = text.matchAll(/\[MISCONCEPTION:\s*([^\]]+)\]/gi);
  const misconceptions = [];
  for (const match of misconceptionMatches) {
    misconceptions.push(match[1].trim());
  }
  return misconceptions;
}

// 모든 메시지에서 오개념 추출
function extractAllMisconceptions(messages) {
  const misconceptions = [];
  for (const msg of messages) {
    if (msg.role === 'assistant' || msg.role === 'model') {
      const extracted = extractMisconceptions(msg.content);
      misconceptions.push(...extracted);
    }
  }
  return [...new Set(misconceptions)]; // 중복 제거
}

// 모든 메시지에서 선수개념 추출
function extractAllPrerequisites(messages) {
  const prerequisites = [];
  for (const msg of messages) {
    if (msg.role === 'assistant' || msg.role === 'model') {
      const extracted = extractSuggestedPrerequisites(msg.content);
      prerequisites.push(...extracted);
    }
  }
  return [...new Set(prerequisites)]; // 중복 제거
}

// 응답에서 데이터 태그 제거
function cleanResponse(text) {
  return text
    .replace(/\[PREREQ:\s*[^\]]+\]/gi, '')
    .replace(/\[MISCONCEPTION:\s*[^\]]+\]/gi, '')
    .trim();
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
      action = 'chat', // 'chat' | 'wrong_answer_help' | 'step_by_step_visual' | 'save_session'
      context = {},
    } = body;

    // 필수 필드 검증
    if (!concept_id) {
      return NextResponse.json(
        { error: 'Missing required field: concept_id' },
        { status: 400 }
      );
    }

    // 언어 감지 (메시지 기반)
    const language = messages.length > 0
      ? detectConversationLanguage(messages)
      : (context.curriculum === 'kr' ? 'ko' : 'en');

    // === 세션 저장 액션 ===
    if (action === 'save_session') {
      if (!student_id) {
        return NextResponse.json(
          { error: 'Missing student_id for save_session' },
          { status: 400 }
        );
      }

      // 메시지에서 데이터 추출
      const misconceptions = extractAllMisconceptions(messages);
      const prerequisites = extractAllPrerequisites(messages);
      const turnCount = Math.floor(messages.length / 2);
      const durationSec = context.duration_sec || 0;
      const studentSummary = context.student_summary || '';

      // concept_history에 저장
      const sessionDetail = {
        messages: messages.map(m => ({
          role: m.role,
          content: cleanResponse(m.content),
          timestamp: m.timestamp || new Date().toISOString(),
        })),
        turn_count: turnCount,
        duration_sec: durationSec,
        misconceptions,
        prerequisites_suggested: prerequisites,
        student_summary: studentSummary,
        language,
      };

      try {
        const saveRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/concept-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id,
            event_type: 'tutor_session',
            curriculum: context.curriculum || 'us',
            subject: context.subject || '',
            concept_id,
            duration_sec: durationSec,
            detail: sessionDetail,
          }),
        });

        if (!saveRes.ok) {
          console.error('Failed to save tutor session to concept_history');
        }

        return NextResponse.json({
          success: true,
          session_saved: true,
          misconceptions,
          prerequisites_suggested: prerequisites,
          turn_count: turnCount,
        });
      } catch (saveError) {
        console.error('Error saving tutor session:', saveError);
        return NextResponse.json({
          success: false,
          error: 'Failed to save session',
        }, { status: 500 });
      }
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
    const turnCount = Math.floor(messages.length / 2);
    if (messages.length > 20) { // 10턴 = 20메시지 (user+assistant)
      const limitMsg = language === 'ko'
        ? '대화가 많이 길어졌네요! 🙌 마무리하기 전에, 오늘 가장 중요하게 배운 것 한 문장으로 말해줄 수 있어요?'
        : 'We\'ve had quite a conversation! 🙌 Before we finish, can you tell me in ONE sentence what was the most important thing you learned today?';

      return NextResponse.json({
        reply: limitMsg,
        suggested_prerequisites: [],
        misconceptions: extractAllMisconceptions(messages),
        follow_up_question: '',
        turn_limit_reached: true,
        request_summary: true,
        turn_count: turnCount,
      });
    }

    // 8턴 이상이면 마무리 요청 플래그
    const shouldRequestSummary = turnCount >= 8;

    // 시스템 프롬프트 생성
    let systemPrompt = buildSystemPrompt({
      concept_title: context.concept_title || concept_id,
      concept_description: context.concept_description,
      prerequisite_ids: context.prerequisite_ids || context.prerequisites?.map(p => p.concept_id) || [],
      mastery_status: context.mastery_status || 'learning',
      student_grade: context.student_grade,
      curriculum: context.curriculum || 'us',
      question_context: action === 'wrong_answer_help' ? context.question_context : null,
      language,
    });

    // 오답 모드일 때 추가 지침
    if (action === 'wrong_answer_help') {
      systemPrompt += buildWrongAnswerSystemAddendum(language);
    }

    // 오답 모드일 때 초기 메시지 생성
    if (action === 'wrong_answer_help' && messages.length === 0) {
      return NextResponse.json({
        reply: buildWrongAnswerInitialMessage(language),
        suggested_prerequisites: [],
        misconceptions: [],
        follow_up_question: '',
        is_initial: true,
        turn_count: 0,
      });
    }

    // Gemini API 호출
    const contents = formatMessagesForGemini(messages, systemPrompt);

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
    const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text ||
      (language === 'ko' ? '응답을 생성할 수 없습니다.' : 'Unable to generate a response.');

    // 데이터 추출 및 응답 정리
    const suggestedPrerequisites = extractSuggestedPrerequisites(rawReply);
    const misconceptions = extractMisconceptions(rawReply);
    const cleanedReply = cleanResponse(rawReply);

    // 누적된 모든 오개념
    const allMisconceptions = [
      ...extractAllMisconceptions(messages),
      ...misconceptions,
    ];

    return NextResponse.json({
      reply: cleanedReply,
      suggested_prerequisites: suggestedPrerequisites,
      misconceptions: [...new Set(allMisconceptions)],
      follow_up_question: '',
      turn_count: turnCount + 1,
      request_summary: shouldRequestSummary,
    });

  } catch (error) {
    console.error('Tutor API error:', error);
    return NextResponse.json(
      { error: '튜터 응답 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
