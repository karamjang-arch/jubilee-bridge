'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';

// 과목 목록
const SUBJECTS = [
  { id: 'math', label: '수학', prefix: 'MATH' },
  { id: 'english', label: '영어', prefix: 'ENG' },
  { id: 'physics', label: '물리', prefix: 'PHY' },
  { id: 'chemistry', label: '화학', prefix: 'CHEM' },
  { id: 'biology', label: '생물', prefix: 'BIO' },
  { id: 'history', label: '역사', prefix: 'HIST' },
  { id: 'economics', label: '경제', prefix: 'ECON' },
  { id: 'cs', label: 'CS', prefix: 'CS' },
];

export default function GeminiTutorCard() {
  const { profile, studentId } = useProfile();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 약점 보강 상태
  const [selectedSubject, setSelectedSubject] = useState('');
  const [weaknesses, setWeaknesses] = useState([]);
  const [isLoadingWeaknesses, setIsLoadingWeaknesses] = useState(false);

  // 자유 주제 상태
  const [freeTopic, setFreeTopic] = useState('');
  const [isSearchingCB, setIsSearchingCB] = useState(false);

  const studentName = profile?.name || '학생';
  const grade = profile?.grade || 10;
  const school = profile?.school || 'Purdue';

  // 토스트 표시
  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // 클립보드 복사
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToastMessage('프롬프트가 복사되었습니다! Gemini에 붙여넣기 하세요.');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToastMessage('복사 실패. 다시 시도해주세요.');
    }
  };

  // 1. 숙제 분석 프롬프트
  const copyHomeworkPrompt = async () => {
    // 수학/영어 전략 힌트 모두 가져오기
    let strategyHints = '';
    try {
      const [mathRes, engRes] = await Promise.all([
        fetch('/api/tutor-hints?subject=math'),
        fetch('/api/tutor-hints?subject=english'),
      ]);
      const mathData = mathRes.ok ? await mathRes.json() : null;
      const engData = engRes.ok ? await engRes.json() : null;

      const hints = [];
      if (mathData?.hints?.length > 0) {
        hints.push('수학: ' + mathData.hints.slice(0, 2).map(h => h.strategyHint).filter(Boolean).join(' / '));
      }
      if (engData?.strategies?.length > 0) {
        hints.push('영어: ' + engData.strategies.slice(0, 2).map(s => s.tutorHints?.[0]).filter(Boolean).join(' / '));
      }
      if (hints.length > 0) {
        strategyHints = `\n\n[튜터 참고]\n${hints.join('\n')}`;
      }
    } catch (e) {}

    const prompt = `너는 Jubilee Tutor야.
학생 코드네임: ${studentName}
학년: ${grade}학년

아래 사진의 풀이를 분석해줘.
1. 어떤 개념의 문제인지 알려줘
2. 틀린 이유를 분류해줘:
   A) 선행 개념을 모름
   B) 비슷한 개념과 헷갈림
   C) 계산/표기 실수
3. 답을 바로 주지 말고, 질문으로 유도해줘
4. 4문장 이상 쓰지 말고 질문해
5. 끝나면 Concept Card를 만들어줘${strategyHints}`;

    copyToClipboard(prompt);
  };

  // 2. 약점 보강 - 과목 선택 시 약점 로드
  const handleSubjectChange = async (subjectId) => {
    setSelectedSubject(subjectId);
    if (!subjectId || !studentId) return;

    setIsLoadingWeaknesses(true);
    try {
      // concept_progress에서 약점 가져오기
      const res = await fetch(`/api/sheets?tab=concept_progress&student=${studentId}`);
      const data = await res.json();

      const subject = SUBJECTS.find(s => s.id === subjectId);
      if (!subject) return;

      // 해당 과목의 약점 필터링
      const subjectWeaknesses = (data.data || []).filter(p => {
        const isSubject = p.concept_id?.startsWith(subject.prefix);
        const needsReview = p.status === 'review_needed' ||
                           p.status === 'diagnosed_weakness' ||
                           p.status === 'struggling';
        return isSubject && needsReview;
      });

      setWeaknesses(subjectWeaknesses);
    } catch (error) {
      console.error('Failed to load weaknesses:', error);
      setWeaknesses([]);
    } finally {
      setIsLoadingWeaknesses(false);
    }
  };

  // 2. 약점 보강 프롬프트 복사 (전략 DB 힌트 포함)
  const copyWeaknessPrompt = async () => {
    if (!selectedSubject) {
      showToastMessage('과목을 먼저 선택해주세요.');
      return;
    }

    const subject = SUBJECTS.find(s => s.id === selectedSubject);

    // 전략 DB에서 힌트 가져오기
    let strategyHints = '';
    try {
      const hintsRes = await fetch(`/api/tutor-hints?subject=${selectedSubject}`);
      if (hintsRes.ok) {
        const hintsData = await hintsRes.json();
        if (hintsData.hints?.length > 0) {
          const topHints = hintsData.hints.slice(0, 3).map(h =>
            `• ${h.name}: ${h.strategyHint || ''} [흔한 실수: ${h.commonMistakes?.join(', ') || 'N/A'}]`
          ).join('\n');
          strategyHints = `\n\n[튜터 내부 참고 - 학생에게 직접 보여주지 말 것]\n${topHints}`;
        }
        if (hintsData.strategies?.length > 0) {
          const topStrategies = hintsData.strategies.slice(0, 2).map(s =>
            `• ${s.questionType}: ${s.tutorHints?.[0] || s.strategySteps?.[0] || ''}`
          ).join('\n');
          strategyHints += `\n${topStrategies}`;
        }
      }
    } catch (e) {
      console.log('Strategy hints not available');
    }

    if (weaknesses.length === 0) {
      const prompt = `너는 Jubilee Tutor야.
학생: ${studentName}, ${grade}학년

${subject.label}에서 약점이 없어요!
다음 도전 개념을 추천해줘.

학생의 현재 수준에 맞는 다음 단계 개념을 찾아서
소크라테스식으로 튜터링해줘.
4문장 넘기지 말고 질문해.${strategyHints}`;

      copyToClipboard(prompt);
      return;
    }

    const weaknessList = weaknesses.slice(0, 5).map(w =>
      `- ${w.concept_id}: ${w.status}${w.note ? ` — ${w.note}` : ''}`
    ).join('\n');

    const prompt = `너는 Jubilee Tutor야.
학생: ${studentName}, ${grade}학년

이 학생의 ${subject.label} 약점:
${weaknessList}

가장 기초적인 약점부터 시작해서
소크라테스식으로 튜터링해줘.
답을 바로 주지 말고 질문으로 유도해.
4문장 넘기지 말고 질문해.
각 개념을 이해하면 퀴즈 2~3문제로 확인해.
끝나면 Concept Card를 만들어줘.${strategyHints}`;

    copyToClipboard(prompt);
  };

  // 3. 자유 주제 프롬프트 생성
  const generateFreeTopicPrompt = async () => {
    if (!freeTopic.trim()) {
      showToastMessage('주제를 입력해주세요.');
      return;
    }

    setIsSearchingCB(true);
    let cbData = null;

    try {
      // CB에서 관련 개념 검색
      const searchRes = await fetch(`/api/concept-content?random=1&search=${encodeURIComponent(freeTopic)}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData && !searchData.error) {
          cbData = searchData;
        }
      }
    } catch (error) {
      console.error('CB search failed:', error);
    }

    let prompt;
    if (cbData && cbData.title_ko) {
      // CB 매칭됨
      prompt = `너는 Jubilee Tutor야.
학생: ${studentName}, ${grade}학년

이 학생이 '${freeTopic}'를 공부하고 싶어해.
관련 개념 정보:
- 개념: ${cbData.title_ko || cbData.title_en}
- 학년: ${cbData.grade_us?.join(', ') || '전체'}
- Bloom Level: ${cbData.bloom_level || 'N/A'}
- 선수개념: ${cbData.prerequisites?.join(', ') || '없음'}
- 흔한 실수: ${cbData.common_errors?.slice(0, 2).join('; ') || '없음'}
${cbData.sat_domain ? `- SAT: ${cbData.sat_domain} / ${cbData.sat_skill || ''}` : ''}

소크라테스식으로 튜터링해줘.
먼저 학생이 뭘 알고 있는지 물어봐.
4문장 넘기지 말고 질문해.
끝나면 Concept Card를 만들어줘.`;
    } else {
      // CB 매칭 안 됨
      prompt = `너는 Jubilee Tutor야.
학생: ${studentName}, ${grade}학년

이 학생이 '${freeTopic}'를 공부하고 싶어해.

소크라테스식으로 튜터링해줘.
먼저 학생이 뭘 알고 있는지 물어봐.
답을 바로 주지 말고 질문으로 유도해.
4문장 넘기지 말고 질문해.
끝나면 배운 내용을 정리해줘.`;
    }

    setIsSearchingCB(false);
    copyToClipboard(prompt);
    setFreeTopic('');
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <h3 className="text-heading text-text-primary">Gemini 튜터</h3>
              <p className="text-caption text-text-tertiary">AI 튜터와 함께 공부하기</p>
            </div>
          </div>

          {/* 1. 숙제 분석 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span>📸</span>
              <span className="text-ui font-medium text-text-primary">숙제 분석</span>
            </div>
            <p className="text-caption text-text-tertiary mb-2">틀린 문제 사진으로 분석하기</p>
            <button
              onClick={copyHomeworkPrompt}
              className="w-full btn btn-secondary justify-between text-sm"
            >
              <span>프롬프트 복사</span>
              <span className="text-text-tertiary">📋</span>
            </button>
          </div>

          {/* 2. 약점 보강 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span>📊</span>
              <span className="text-ui font-medium text-text-primary">약점 보강</span>
            </div>
            <p className="text-caption text-text-tertiary mb-2">스킬맵에서 발견된 약점 집중 튜터링</p>
            <div className="flex gap-2">
              <select
                value={selectedSubject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="flex-1 px-3 py-2 bg-bg-sidebar border border-border-subtle rounded-lg text-sm focus:border-purple-500 focus:outline-none"
              >
                <option value="">과목 선택</option>
                {SUBJECTS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={copyWeaknessPrompt}
                disabled={!selectedSubject || isLoadingWeaknesses}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                {isLoadingWeaknesses ? '...' : '📋'}
              </button>
            </div>
            {selectedSubject && !isLoadingWeaknesses && (
              <p className="text-xs text-text-tertiary mt-1">
                {weaknesses.length > 0
                  ? `${weaknesses.length}개 약점 발견`
                  : '약점 없음 - 다음 도전!'}
              </p>
            )}
          </div>

          {/* 3. 자유 주제 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span>📝</span>
              <span className="text-ui font-medium text-text-primary">자유 주제</span>
            </div>
            <p className="text-caption text-text-tertiary mb-2">공부하고 싶은 주제 직접 입력</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={freeTopic}
                onChange={(e) => setFreeTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateFreeTopicPrompt()}
                placeholder="예: SAT math / 뉴턴의 법칙"
                className="flex-1 px-3 py-2 bg-bg-sidebar border border-border-subtle rounded-lg text-sm focus:border-purple-500 focus:outline-none"
              />
              <button
                onClick={generateFreeTopicPrompt}
                disabled={!freeTopic.trim() || isSearchingCB}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                {isSearchingCB ? '...' : '📋'}
              </button>
            </div>
          </div>

          {/* SAT 전략 튜터링 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span>🎯</span>
              <span className="text-ui font-medium text-text-primary">SAT 전략</span>
            </div>
            <p className="text-caption text-text-tertiary mb-2">SAT 문제 유형별 전략 튜터링</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  const hintsRes = await fetch('/api/tutor-hints?subject=math');
                  const data = hintsRes.ok ? await hintsRes.json() : { hints: [] };
                  const skills = data.hints?.slice(0, 5).map(h => `• ${h.name}: ${h.strategyHint}`).join('\n') || '';

                  const prompt = `너는 SAT Math 전문 튜터야.
학생: ${studentName}, ${grade}학년

SAT Math 핵심 전략:
${skills}

먼저 학생이 어떤 유형에서 어려움을 겪는지 물어봐.
선택한 유형의 핵심 전략을 알려주고,
예제 문제로 연습시켜줘.
4문장 넘기지 말고 질문해.`;
                  copyToClipboard(prompt);
                }}
                className="btn btn-secondary text-xs py-2"
              >
                📐 Math
              </button>
              <button
                onClick={async () => {
                  const hintsRes = await fetch('/api/tutor-hints?subject=english');
                  const data = hintsRes.ok ? await hintsRes.json() : { strategies: [] };
                  const strats = data.strategies?.slice(0, 5).map(s => `• ${s.questionType}`).join('\n') || '';

                  const prompt = `너는 SAT Reading & Writing 전문 튜터야.
학생: ${studentName}, ${grade}학년

SAT R&W 문제 유형:
${strats}

먼저 학생이 어떤 유형에서 어려움을 겪는지 물어봐.
선택한 유형의 풀이 전략을 알려주고,
예제 문제로 연습시켜줘.
4문장 넘기지 말고 질문해.`;
                  copyToClipboard(prompt);
                }}
                className="btn btn-secondary text-xs py-2"
              >
                📖 R&W
              </button>
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t border-border-subtle my-5" />

          {/* 4. WL 학사·공부·입시 (Wisdom Pilot Gem) */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span>🎓</span>
              <span className="text-ui font-medium text-text-primary">WL 학사·공부·입시</span>
            </div>
            <p className="text-caption text-text-tertiary mb-2">Wisdom Pilot과 학사/공부/입시 상담</p>
            <a
              href="https://gemini.google.com/gem/1Wn64RfMM0eAWsHAGMncUZqihAZay1ofz"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full btn btn-secondary justify-between text-sm"
            >
              <span>Gemini Gem 열기</span>
              <span className="text-text-tertiary">→</span>
            </a>
          </div>

          {/* 5. 영어 코칭 (PLT) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span>🗣️</span>
              <span className="text-ui font-medium text-text-primary">영어 코칭</span>
            </div>
            <p className="text-caption text-text-tertiary mb-2">PLT Coach와 영어 회화 연습</p>
            <button
              onClick={async () => {
                const prompt = `너는 PLT Coach야.
학생: ${studentName}, ${grade}학년

Module 1 (Free Talk)으로 시작해.
- 자연스러운 대화로 워밍업
- 학생의 관심사에 대해 물어봐
- 문법 실수는 대화 흐름 끊지 않고 자연스럽게 교정

학생이 /check 입력하면 → Module 2 (Expression Check)
학생이 /drill 입력하면 → Module 3 (Pronunciation Drill)

발음 교정 시 물리적 교정 포함:
- 혀 위치, 입 모양, 호흡 설명
- 유사 단어와 비교

대화가 끝나면 아래 형식으로 출력해:
\`\`\`
## PLT Session
- Date: ${new Date().toISOString().split('T')[0]}
- Topics:
- New Expressions:
- Pronunciation Focus:
\`\`\``;
                try {
                  await navigator.clipboard.writeText(prompt);
                  showToastMessage('Gemini 앱에서 Live 모드로 음성 대화하세요!');
                } catch (err) {
                  console.error('Failed to copy:', err);
                  showToastMessage('복사 실패. 다시 시도해주세요.');
                }
              }}
              className="w-full btn btn-secondary justify-between text-sm"
            >
              <span>프롬프트 복사</span>
              <span className="text-text-tertiary">📋</span>
            </button>

            {/* PLT 자료 다운로드 */}
            <div className="mt-3 p-3 bg-bg-sidebar rounded-lg">
              <p className="text-xs text-text-tertiary mb-2">처음 한 번만 다운로드하세요:</p>
              <div className="flex flex-col gap-1">
                <a
                  href="https://drive.google.com/file/d/1vV2RCQXWdR_sg5oNqGpNe08hK_HtA_7u/view?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  📄 교수법 자료
                </a>
                <a
                  href="https://drive.google.com/file/d/1klDk-a927pbJQgbzkFeRwIZgz3m08Bf6/view?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline"
                >
                  📄 학교 컨텍스트 자료
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 토스트 */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-text-primary text-bg-card rounded-lg shadow-elevated z-50 text-sm">
          {toastMessage}
        </div>
      )}
    </>
  );
}
