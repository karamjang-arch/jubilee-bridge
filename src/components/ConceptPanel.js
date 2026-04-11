'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LEARNING_PATHWAYS, BLOOM_LEVELS } from '@/lib/constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 자동 퀴즈 생성 (선택형 문제가 없을 때 fallback)
function generateAutoQuiz(cbContent, allConcepts = []) {
  if (!cbContent) return null;

  const { title_en, core_description, common_errors = [] } = cbContent;

  // common_errors가 2개 이상 있어야 자동 생성 가능
  if (!core_description || common_errors.length < 2) {
    return null; // 자기 체크로 fallback
  }

  // 정답: core_description 전체 사용
  const correctAnswer = core_description;

  // 오답: common_errors 전체 사용
  const wrongAnswers = common_errors.slice(0, 2);

  // 셔플된 선택지
  const choices = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
  const answerIndex = choices.indexOf(correctAnswer);

  return {
    question: `"${title_en}"에 대한 다음 설명 중 올바른 것은?`,
    choices,
    answer: correctAnswer,
    answerIndex,
    explanation: `이 개념의 핵심: ${core_description}`,
    type: 'auto_generated'
  };
}

// Free Resources 링크 생성
function generateResourceLinks(freeResources, titleEn) {
  const linkMap = {
    'Khan Academy': (q) => `https://www.khanacademy.org/search?referer=%2F&page_search_query=${encodeURIComponent(q)}`,
    'OpenStax': (q) => `https://openstax.org/search?q=${encodeURIComponent(q)}`,
    'PhET': (q) => `https://phet.colorado.edu/en/simulations/filter?query=${encodeURIComponent(q)}`,
    'Desmos': () => 'https://www.desmos.com/calculator',
    'GeoGebra': (q) => `https://www.geogebra.org/search/${encodeURIComponent(q)}`,
    'CK-12': (q) => `https://www.ck12.org/search/?q=${encodeURIComponent(q)}`,
    'MIT OCW': (q) => `https://ocw.mit.edu/search/?q=${encodeURIComponent(q)}`,
    'YouTube': (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  };

  const sourceCategories = {
    read: ['OpenStax', 'CK-12'],
    watch: ['Khan Academy', 'YouTube', 'MIT OCW'],
    interactive: ['PhET', 'Desmos', 'GeoGebra'],
  };

  // 기존 리소스에 링크 추가
  const enrichedResources = (freeResources || []).map(r => ({
    ...r,
    url: r.url || (linkMap[r.source] ? linkMap[r.source](r.title || titleEn) : ''),
  }));

  // 리소스가 없으면 기본 링크 생성
  if (enrichedResources.length === 0 && titleEn) {
    return [
      { source: 'Khan Academy', title: `Search: ${titleEn}`, url: linkMap['Khan Academy'](titleEn), type: 'watch' },
      { source: 'YouTube', title: `Search: ${titleEn}`, url: linkMap['YouTube'](titleEn), type: 'watch' },
    ];
  }

  return enrichedResources;
}

// Bloom Level → 제한시간 (초)
const BLOOM_TIME_LIMITS = {
  1: 30,   // Remember
  2: 60,   // Understand
  3: 90,   // Apply
  4: 120,  // Analyze
  5: 150,  // Evaluate
  6: 180,  // Create
};

const MAX_DIAGNOSIS_DEPTH = 3;

export default function ConceptPanel({
  concept,
  subject,
  onClose,
  onMastered,
  status = 'available',
  diagnosisStack = [],      // 재귀 추적 스택: [{conceptId, title}...]
  onNavigateToPrereq,       // 선수개념 이동 콜백
  onGoBack,                 // 이전 개념으로 돌아가기 콜백
}) {
  const [activeTab, setActiveTab] = useState('challenge'); // challenge, learn, resources
  const [activePathway, setActivePathway] = useState('real_life');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isMastering, setIsMastering] = useState(false);

  // CB 콘텐츠 상태
  const [cbContent, setCbContent] = useState(null);
  const [conceptMeta, setConceptMeta] = useState(null);
  const [loadingContent, setLoadingContent] = useState(true);

  // 도전 탭 상태
  const [challengePhase, setChallengePhase] = useState('ready'); // ready, question, result, triangulation, diagnosis
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef(null);

  // 삼각측량 진단 상태
  const [triangulationStep, setTriangulationStep] = useState(0);
  const [triangulationQuestions, setTriangulationQuestions] = useState([]);
  const [triangulationResults, setTriangulationResults] = useState([]);
  const [diagnosisResult, setDiagnosisResult] = useState(null);

  // CB Questions (실전 문제)
  const [cbQuestions, setCbQuestions] = useState([]);
  const [usedQuestionIds, setUsedQuestionIds] = useState(new Set());
  const [questionsSource, setQuestionsSource] = useState(null); // 'cb-questions', 'none', null

  // YouTube 추천 강의
  const [youtubeVideos, setYoutubeVideos] = useState(null);

  // 한국 개념인지 확인
  const conceptId = concept.concept_id || concept.id;
  const isKoreanConcept = conceptId?.startsWith('KR-');

  // CB 콘텐츠 로드
  useEffect(() => {
    if (!conceptId) return;

    setLoadingContent(true);
    setCbQuestions([]);
    setQuestionsSource(null);

    Promise.all([
      fetch(`/api/concept-content?id=${conceptId}`).then(r => r.json()),
      fetch(`/api/concepts?id=${conceptId}`).then(r => r.json()),
      fetch(`/api/concept-questions?id=${conceptId}`).then(r => r.json()).catch(() => ({ questions: [], source: 'none' })),
      fetch('/data/youtube_mapping.json').then(r => r.json()).catch(() => ({})),
    ])
      .then(([content, meta, questionsData, ytMapping]) => {
        if (!content.error) setCbContent(content);
        if (meta.concept) setConceptMeta(meta.concept);

        // Questions 로드 - curriculum이 'kr'이면 한국 준비 중
        setQuestionsSource(questionsData.source || 'none');
        if (questionsData.questions?.length > 0) {
          setCbQuestions(questionsData.questions);
        }

        // YouTube 매핑 로드
        if (ytMapping && ytMapping[conceptId]) {
          setYoutubeVideos(ytMapping[conceptId]);
        } else {
          setYoutubeVideos(null);
        }
      })
      .catch(err => console.error('Failed to load content:', err))
      .finally(() => setLoadingContent(false));
  }, [conceptId]);

  // 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 제한 시간 계산
  const getTimeLimit = useCallback(() => {
    const bloomLevel = cbContent?.bloom_level || 3;
    return BLOOM_TIME_LIMITS[bloomLevel] || 90;
  }, [cbContent]);

  // 타이머 시작
  const startTimer = useCallback((seconds) => {
    setTimeLeft(seconds);
    setTimedOut(false);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimedOut(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 도전 시작
  const startChallenge = useCallback(() => {
    // 1. CB Questions (실전 문제) 우선 사용
    if (cbQuestions.length > 0) {
      const unusedQuestions = cbQuestions.filter(q => !usedQuestionIds.has(q.id));
      const pool = unusedQuestions.length > 0 ? unusedQuestions : cbQuestions;
      const question = pool[Math.floor(Math.random() * pool.length)];

      // CB Questions 형식 변환
      const formattedQuestion = {
        ...question,
        type: 'cb_question',
        correctAnswer: question.choices?.find(c => c.startsWith(question.answer + ')')) || question.choices?.[0],
      };

      setCurrentQuestion(formattedQuestion);
      setUsedQuestionIds(prev => new Set([...prev, question.id]));
      setSelectedAnswer(null);
      setIsCorrect(null);
      setChallengePhase('question');
      startTimer(question.time_seconds || getTimeLimit());
      return;
    }

    // 2. 기존 diagnostic_questions 사용
    let questions = cbContent?.diagnostic_questions?.filter(q => q.choices?.length >= 3) || [];

    // 3. 선택형 문제가 없으면 자동 생성 시도
    if (questions.length === 0) {
      const autoQuiz = generateAutoQuiz(cbContent);
      if (autoQuiz) {
        questions = [autoQuiz];
      } else {
        // 자동 생성도 불가능하면 자기 체크 모드
        setChallengePhase('self_check');
        return;
      }
    }

    setCurrentQuestion(questions[0]);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setChallengePhase('question');
    startTimer(getTimeLimit());
  }, [cbContent, cbQuestions, usedQuestionIds, getTimeLimit, startTimer]);

  // 답안 제출
  const submitAnswer = useCallback(() => {
    if (!selectedAnswer || !currentQuestion) return;

    if (timerRef.current) clearInterval(timerRef.current);

    // 정답 체크
    let correct = false;
    if (currentQuestion.type === 'auto_generated') {
      const selectedIdx = currentQuestion.choices.indexOf(selectedAnswer);
      correct = selectedIdx === currentQuestion.answerIndex;
    } else if (currentQuestion.type === 'cb_question') {
      // CB Questions: "A) ..." 형식 선택지, answer는 "A"
      correct = selectedAnswer === currentQuestion.correctAnswer;
    } else {
      const correctAnswer = currentQuestion.answer || currentQuestion.choices[0];
      correct = selectedAnswer === correctAnswer;
    }
    setIsCorrect(correct);

    if (correct && !timedOut) {
      // 정답 + 시간 내 → 마스터 가능
      setChallengePhase('result');
    } else if (correct && timedOut) {
      // 정답 + 시간 초과 → review_needed
      setChallengePhase('result');
    } else {
      // 오답 → 삼각측량 시작
      setChallengePhase('result');
    }
  }, [selectedAnswer, currentQuestion, timedOut]);

  // 삼각측량 진단 시작
  const startTriangulation = useCallback(async () => {
    setChallengePhase('triangulation');
    setTriangulationStep(0);
    setTriangulationResults([]);

    // 삼각측량 문제 준비
    const questions = [];
    const prereqs = conceptMeta?.relationships?.prerequisites || [];
    const allDiagnosticQuestions = cbContent?.diagnostic_questions?.filter(q => q.choices?.length >= 2) || [];

    // 문제 1: prerequisite 확인
    if (prereqs.length > 0) {
      const prereqId = prereqs[Math.floor(Math.random() * prereqs.length)];
      try {
        const prereqContent = await fetch(`/api/concept-content?id=${prereqId}`).then(r => r.json());
        const prereqQuestion = prereqContent?.diagnostic_questions?.find(q => q.choices?.length >= 2);
        if (prereqQuestion) {
          questions.push({
            type: 'prerequisite',
            conceptId: prereqId,
            conceptTitle: prereqContent.title_ko || prereqContent.title_en,
            label: '혹시 이전 개념에서 빠진 게 있는지 확인할게요',
            ...prereqQuestion,
          });
        }
      } catch (e) {
        console.error('Failed to load prerequisite:', e);
      }
    }

    // 문제 2: 같은 cluster의 다른 개념 (common_confusions 대체)
    if (prereqs.length > 1) {
      const prereqId = prereqs.find(id => !questions.some(q => q.conceptId === id)) || prereqs[0];
      try {
        const prereqContent = await fetch(`/api/concept-content?id=${prereqId}`).then(r => r.json());
        const prereqQuestion = prereqContent?.diagnostic_questions?.find(q => q.choices?.length >= 2);
        if (prereqQuestion) {
          questions.push({
            type: 'confusion',
            conceptId: prereqId,
            conceptTitle: prereqContent.title_ko || prereqContent.title_en,
            label: '비슷한 개념과 헷갈리는지 확인할게요',
            ...prereqQuestion,
          });
        }
      } catch (e) {
        console.error('Failed to load confusion concept:', e);
      }
    }

    // 문제 3: 같은 개념의 다른 문제 (error_type 확인)
    if (allDiagnosticQuestions.length > 1) {
      const errorQuestion = allDiagnosticQuestions[1] || allDiagnosticQuestions[0];
      questions.push({
        type: 'error',
        conceptId: concept.concept_id || concept.id,
        conceptTitle: cbContent?.title_ko || concept.title_ko,
        label: '같은 개념을 다른 각도에서 확인할게요',
        ...errorQuestion,
      });
    }

    // 문제가 부족하면 같은 개념 문제로 채우기
    while (questions.length < 3 && allDiagnosticQuestions.length > questions.length) {
      const q = allDiagnosticQuestions[questions.length];
      questions.push({
        type: 'error',
        conceptId: concept.concept_id || concept.id,
        conceptTitle: cbContent?.title_ko || concept.title_ko,
        label: '추가 확인 문제입니다',
        ...q,
      });
    }

    setTriangulationQuestions(questions);
    if (questions.length > 0) {
      setCurrentQuestion(questions[0]);
      startTimer(getTimeLimit());
    } else {
      // 삼각측량 문제가 없으면 학습 탭으로
      setChallengePhase('diagnosis');
      setDiagnosisResult({ type: 'no_questions', message: '추가 진단 문제가 없습니다. 학습 탭에서 개념을 확인하세요.' });
    }
  }, [concept, conceptMeta, cbContent, getTimeLimit, startTimer]);

  // 삼각측량 답안 제출
  const submitTriangulationAnswer = useCallback(() => {
    if (!selectedAnswer || !currentQuestion) return;

    if (timerRef.current) clearInterval(timerRef.current);

    const correctAnswer = currentQuestion.answer || currentQuestion.choices[0];
    const correct = selectedAnswer === correctAnswer;

    const newResults = [...triangulationResults, {
      type: currentQuestion.type,
      conceptId: currentQuestion.conceptId,
      conceptTitle: currentQuestion.conceptTitle,
      correct,
      timedOut,
    }];
    setTriangulationResults(newResults);

    const nextStep = triangulationStep + 1;
    if (nextStep < triangulationQuestions.length) {
      // 다음 문제
      setTriangulationStep(nextStep);
      setCurrentQuestion(triangulationQuestions[nextStep]);
      setSelectedAnswer(null);
      setIsCorrect(null);
      startTimer(getTimeLimit());
    } else {
      // 진단 완료
      analyzeTriangulationResults(newResults);
    }
  }, [selectedAnswer, currentQuestion, triangulationStep, triangulationQuestions, triangulationResults, timedOut, getTimeLimit, startTimer]);

  // 삼각측량 결과 분석
  const analyzeTriangulationResults = useCallback((results) => {
    setChallengePhase('diagnosis');

    const prereqResult = results.find(r => r.type === 'prerequisite');
    const confusionResult = results.find(r => r.type === 'confusion');
    const errorResult = results.find(r => r.type === 'error');

    if (prereqResult && !prereqResult.correct) {
      // Case A: prerequisite 틀림
      setDiagnosisResult({
        type: 'prerequisite',
        conceptId: prereqResult.conceptId,
        conceptTitle: prereqResult.conceptTitle,
        message: `[${prereqResult.conceptTitle}]의 이해가 부족합니다. 여기부터 학습하면 이 개념도 풀 수 있어요!`,
      });
    } else if (confusionResult && !confusionResult.correct) {
      // Case B: common_confusion 틀림
      setDiagnosisResult({
        type: 'confusion',
        conceptId: confusionResult.conceptId,
        conceptTitle: confusionResult.conceptTitle,
        message: `[${confusionResult.conceptTitle}]과 헷갈리고 있어요. 두 개념의 차이를 먼저 정리해볼까요?`,
      });
    } else if (errorResult && !errorResult.correct) {
      // Case C: error_type만 틀림
      setDiagnosisResult({
        type: 'error',
        message: '개념은 알지만 문제 풀이에서 실수가 있어요. 학습 탭에서 오류 교정을 확인하세요.',
      });
    } else {
      // Case D: 전부 맞힘
      setDiagnosisResult({
        type: 'retry',
        message: '개념은 이해하고 있어요! 한 번 더 도전해볼까요?',
      });
    }
  }, []);

  // 마스터 처리
  const handleMastered = async () => {
    if (status === 'mastered' || status === 'locked') return;

    setIsMastering(true);
    try {
      await onMastered?.(concept.concept_id || concept.id, subject?.id, concept.prerequisites || []);
      toast('개념을 마스터했습니다! 🎉');
      setTimeout(() => onClose?.(), 1500);
    } catch (error) {
      console.error('Failed to mark as mastered:', error);
    } finally {
      setIsMastering(false);
    }
  };

  // Gemini 튜터 프롬프트 생성 (오답 시)
  const generateGeminiTutorPrompt = useCallback(() => {
    const studentName = localStorage.getItem('jb_student_name') || '학생';
    const grade = localStorage.getItem('jb_student_grade') || '10';
    const conceptTitle = cbContent?.title_ko || cbContent?.title_en || concept.title_ko || '';

    let prompt = `너는 Jubilee Tutor야.
학생: ${studentName}, ${grade}학년

방금 이 문제를 틀렸어:
---
문제: ${currentQuestion?.question || currentQuestion?.passage + '\n' + currentQuestion?.question || ''}
학생이 고른 답: ${selectedAnswer || ''}
정답: ${currentQuestion?.correctAnswer || currentQuestion?.answer || ''}
---

진단 결과:
- 틀린 개념: ${conceptTitle}`;

    if (diagnosisResult) {
      prompt += `
- 약점 원인: ${diagnosisResult.type === 'prerequisite' ? '선수개념 부족' : diagnosisResult.type === 'confusion' ? '유사 개념과 혼동' : diagnosisResult.type === 'error' ? '계산/표기 실수' : ''}`;
      if (diagnosisResult.conceptTitle) {
        prompt += `
- 관련 약점: ${diagnosisResult.conceptTitle}`;
      }
    }

    if (cbContent?.common_errors?.length > 0) {
      prompt += `
- 흔한 실수: ${cbContent.common_errors.slice(0, 2).join('; ')}`;
    }

    if (currentQuestion?.error_trap) {
      prompt += `
- 오답 함정: ${currentQuestion.error_trap}`;
    }

    if (currentQuestion?.explanation) {
      prompt += `
- 정답 풀이: ${currentQuestion.explanation.substring(0, 200)}...`;
    }

    prompt += `

이 학생이 왜 틀렸는지 이해하도록 도와줘.
답을 바로 알려주지 말고 질문으로 유도해.
4문장 넘기지 말고 질문해.
학생이 이해하면 비슷한 문제 2개를 더 내줘.
끝나면 Concept Card를 만들어줘.`;

    return prompt;
  }, [currentQuestion, selectedAnswer, cbContent, concept, diagnosisResult]);

  // 토스트
  const toast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // 클립보드 복사
  const copyToClipboard = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Gemini 추가 문제 프롬프트
  const generateExtraQuestionPrompt = () => {
    return `다음 개념에 대한 4지선다 문제 1개를 만들어주세요.
개념: ${cbContent?.title_en || concept.title_en}
학년: ${concept.grade_us?.join(', ')}학년
난이도: Bloom Level ${cbContent?.bloom_level || 3}
제한시간: ${getTimeLimit()}초
이 개념에서 학생이 자주 하는 실수:
${(cbContent?.common_errors || []).map((e, i) => `${i + 1}. ${e}`).join('\n')}

문제를 낸 후 답을 바로 알려주지 말고,
내가 답을 선택하면 맞았는지 확인해주세요.`;
  };

  // Learning pathways 데이터
  const pathways = cbContent?.learning_pathways || {};
  const bloomLevel = cbContent?.bloom_level || 3;

  // 시간 포맷
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}초`;
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/20 z-10" onClick={onClose} />

      {/* 패널 */}
      <div className="absolute top-0 right-0 h-full w-full max-w-md bg-bg-card border-l border-border-subtle shadow-elevated z-20 overflow-y-auto">
        {/* 상단 컬러 바 */}
        <div className="h-1" style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }} />

        <div className="p-6">
          {/* 진단 스택 브레드크럼 */}
          {diagnosisStack.length > 0 && (
            <div className="mb-4 -mt-2">
              <div className="flex items-center gap-1 text-caption text-text-tertiary overflow-x-auto pb-2">
                {diagnosisStack.map((item, idx) => (
                  <span key={idx} className="flex items-center gap-1 shrink-0">
                    <span
                      className="px-2 py-0.5 bg-bg-hover rounded cursor-pointer hover:bg-bg-selected"
                      onClick={() => onGoBack?.(idx)}
                    >
                      {item.title}
                    </span>
                    <span>→</span>
                  </span>
                ))}
                <span className="px-2 py-0.5 bg-info-light text-info rounded font-medium shrink-0">
                  현재
                </span>
              </div>
              <button
                onClick={() => onGoBack?.(diagnosisStack.length - 1)}
                className="text-caption text-info hover:underline flex items-center gap-1"
              >
                ← 이전 개념으로 돌아가기
              </button>
            </div>
          )}

          {/* 깊이 경고 */}
          {diagnosisStack.length >= MAX_DIAGNOSIS_DEPTH && (
            <div className="mb-4 p-3 bg-warning-light rounded-lg text-warning text-caption">
              ⚠️ 선수개념 탐색 최대 깊이({MAX_DIAGNOSIS_DEPTH})에 도달했습니다. 더 이전 개념을 먼저 학습하세요.
            </div>
          )}

          {/* 헤더 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }} />
                <span className="text-caption text-text-tertiary">
                  {concept.cluster} · {concept.grade_us?.join('-') || ''}학년
                </span>
              </div>
              <h2 className="text-heading text-text-primary">{cbContent?.title_en || concept.title_en}</h2>
              <p className="text-body text-text-secondary mt-1">{cbContent?.title_ko || concept.title_ko}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-bg-hover rounded-md transition-colors">
              <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 탭 - 순서 변경: 도전 | 학습 | 자료 */}
          <div className="flex gap-1 mb-4 p-1 bg-bg-sidebar rounded-lg">
            {[
              { id: 'challenge', label: '✏️ 도전' },
              { id: 'learn', label: '📚 학습' },
              { id: 'resources', label: '🔗 자료' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-caption rounded-md transition-colors ${
                  activeTab === tab.id ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loadingContent ? (
            <div className="py-8 text-center text-text-tertiary">콘텐츠 로딩 중...</div>
          ) : (
            <>
              {/* ===== 도전 탭 ===== */}
              {activeTab === 'challenge' && (
                <div>
                  {/* 준비 상태 */}
                  {challengePhase === 'ready' && (
                    <div className="text-center py-8">
                      {/* 한국 개념 - 실전 문제 준비 중 */}
                      {isKoreanConcept && cbQuestions.length === 0 ? (
                        <>
                          <div className="text-4xl mb-4">🇰🇷</div>
                          <h3 className="text-subheading text-text-primary mb-2">한국 실전 문제 준비 중</h3>
                          <p className="text-body text-text-secondary mb-4">
                            이 개념의 한국 교육과정 문제가 곧 추가될 예정입니다.
                          </p>
                          <div className="p-4 bg-info-light rounded-lg text-info">
                            <p className="mb-2">📚 학습 탭에서 개념을 먼저 학습해보세요!</p>
                            <button
                              onClick={() => setActiveTab('learn')}
                              className="btn btn-secondary mt-2"
                            >
                              학습 탭으로 이동
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl mb-4">🎯</div>
                          <h3 className="text-subheading text-text-primary mb-2">이 개념을 알고 있는지 확인해볼게요!</h3>
                          <p className="text-body text-text-secondary mb-6">
                            제한시간 <span className="font-bold text-warning">{formatTime(getTimeLimit())}</span> 안에 문제를 풀어보세요.
                          </p>

                          {status === 'mastered' ? (
                            <div className="p-4 bg-success-light rounded-lg text-success">
                              <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              이미 마스터한 개념입니다!
                            </div>
                          ) : status === 'locked' ? (
                            <div className="p-4 bg-bg-hover rounded-lg text-text-disabled">
                              <span className="text-2xl">🔒</span>
                              <p className="mt-2">선수 개념을 먼저 마스터하세요</p>
                            </div>
                          ) : (
                            <button
                              onClick={startChallenge}
                              className="btn text-white px-8"
                              style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                            >
                              도전 시작!
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* 문제 출제 상태 */}
                  {(challengePhase === 'question' || challengePhase === 'triangulation') && currentQuestion && (
                    <div>
                      {/* 타이머 */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-caption text-text-tertiary">
                          {challengePhase === 'triangulation' ? `삼각측량 ${triangulationStep + 1}/3` : '도전 문제'}
                        </span>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                          timeLeft <= 10 ? 'bg-danger-light text-danger' : 'bg-bg-sidebar text-text-secondary'
                        }`}>
                          <span>⏱️</span>
                          <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
                        </div>
                      </div>

                      {/* 삼각측량 라벨 */}
                      {challengePhase === 'triangulation' && currentQuestion.label && (
                        <div className="mb-4 p-3 bg-info-light rounded-lg text-info text-caption">
                          💡 {currentQuestion.label}
                        </div>
                      )}

                      {/* 지문 (Reading Comprehension 등) */}
                      {currentQuestion.passage && (
                        <div className="mb-4">
                          <div className="text-caption text-text-tertiary mb-2 flex items-center gap-1">
                            <span>📖</span> 지문
                          </div>
                          <div className="max-h-48 overflow-y-auto p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-body text-text-primary whitespace-pre-wrap leading-relaxed">
                              {currentQuestion.passage}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 문제 (마크다운 렌더링 지원) */}
                      <div className="p-4 bg-bg-sidebar rounded-lg mb-4 prose prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({node, ...props}) => (
                              <table className="w-full border-collapse text-sm my-2" {...props} />
                            ),
                            th: ({node, ...props}) => (
                              <th className="border border-border-subtle bg-bg-hover px-2 py-1 text-left" {...props} />
                            ),
                            td: ({node, ...props}) => (
                              <td className="border border-border-subtle px-2 py-1" {...props} />
                            ),
                            p: ({node, ...props}) => (
                              <p className="text-body text-text-primary mb-2" {...props} />
                            ),
                          }}
                        >
                          {currentQuestion.question}
                        </ReactMarkdown>
                      </div>

                      {/* 선택지 */}
                      <div className="space-y-2 mb-6">
                        {currentQuestion.choices?.map((choice, idx) => (
                          <button
                            key={idx}
                            onClick={() => !timedOut && setSelectedAnswer(choice)}
                            disabled={timedOut}
                            className={`w-full p-3 text-left rounded-lg transition-all flex items-center gap-3 ${
                              selectedAnswer === choice
                                ? 'border-2 bg-opacity-10'
                                : 'border-2 border-transparent bg-bg-card hover:border-border-subtle'
                            } ${timedOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                            style={selectedAnswer === choice ? {
                              borderColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)',
                              backgroundColor: subject ? `var(${subject.cssVar}-light)` : 'var(--subj-math-light)',
                            } : {}}
                          >
                            <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              selectedAnswer === choice ? 'border-current' : 'border-border-strong'
                            }`}
                            style={selectedAnswer === choice ? {
                              borderColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)',
                              backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)',
                            } : {}}
                            >
                              {selectedAnswer === choice && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="text-body text-text-primary flex-1 break-words whitespace-pre-wrap">{choice}</span>
                          </button>
                        ))}
                      </div>

                      {/* 시간 초과 알림 */}
                      {timedOut && (
                        <div className="mb-4 p-3 bg-warning-light rounded-lg text-warning text-center">
                          ⏰ 시간이 초과되었습니다!
                        </div>
                      )}

                      {/* 제출 버튼 */}
                      <button
                        onClick={challengePhase === 'triangulation' ? submitTriangulationAnswer : submitAnswer}
                        disabled={!selectedAnswer}
                        className="w-full btn text-white disabled:opacity-50"
                        style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                      >
                        답안 제출
                      </button>
                    </div>
                  )}

                  {/* 자기 체크 모드 (선택형 문제 없을 때) */}
                  {challengePhase === 'self_check' && (
                    <div className="text-center py-6">
                      <div className="text-4xl mb-4">📖</div>
                      <h3 className="text-subheading text-text-primary mb-2">자기 점검 모드</h3>
                      <p className="text-body text-text-secondary mb-4">
                        이 개념에 대한 선택형 문제가 없습니다.
                      </p>
                      <div className="p-4 bg-bg-sidebar rounded-lg mb-6 text-left">
                        <p className="text-caption text-text-tertiary mb-2">📌 이 개념의 핵심:</p>
                        <p className="text-body text-text-primary">{cbContent?.core_description || cbContent?.title_en}</p>
                      </div>
                      <p className="text-caption text-text-tertiary mb-4">
                        학습 탭에서 내용을 확인한 후, 이해했다면 마스터할 수 있습니다.
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={() => setActiveTab('learn')}
                          className="w-full btn text-white"
                          style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                        >
                          📚 학습하러 가기
                        </button>
                        {status !== 'mastered' && status !== 'locked' && (
                          <button
                            onClick={handleMastered}
                            disabled={isMastering}
                            className="w-full btn btn-secondary"
                          >
                            {isMastering ? '저장 중...' : '✓ 이해했어요, 마스터'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 결과 상태 */}
                  {challengePhase === 'result' && (
                    <div className="text-center py-6">
                      {isCorrect && !timedOut ? (
                        // 정답 + 시간 내
                        <>
                          <div className="text-5xl mb-4">🎉</div>
                          <h3 className="text-heading text-success mb-2">정답! 이미 알고 있네요!</h3>
                          <div className="p-4 bg-success-light rounded-lg mb-4 text-left">
                            <p className="text-caption text-success mb-1">💡 이 개념의 핵심:</p>
                            <p className="text-body text-text-secondary">
                              {cbContent?.core_description?.substring(0, 150) || ''}
                              {cbContent?.core_description?.length > 150 ? '...' : ''}
                            </p>
                          </div>
                          {cbContent?.faq?.[0] && (
                            <div className="p-3 bg-bg-sidebar rounded-lg mb-4 text-left">
                              <p className="text-caption text-text-tertiary">💡 알고 계셨나요?</p>
                              <p className="text-body text-text-secondary text-sm">
                                {cbContent.faq[0].substring(0, 120)}...
                              </p>
                            </div>
                          )}
                          <button
                            onClick={handleMastered}
                            disabled={isMastering}
                            className="w-full btn text-white"
                            style={{ backgroundColor: 'var(--success)' }}
                          >
                            {isMastering ? '저장 중...' : '✓ 마스터 완료'}
                          </button>
                        </>
                      ) : isCorrect && timedOut ? (
                        // 정답 + 시간 초과
                        <>
                          <div className="text-5xl mb-4">⏰</div>
                          <h3 className="text-heading text-warning mb-2">맞았지만 {formatTime(getTimeLimit())} 안에 풀어야 해요</h3>
                          <p className="text-body text-text-secondary mb-4">실전에서 빠르게 풀려면 복습이 필요합니다.</p>
                          {cbContent?.meta_cognition?.stuck_diagnosis && (
                            <div className="p-3 bg-warning-light rounded-lg mb-4 text-left">
                              <p className="text-caption text-warning">💡 빠르게 푸는 팁:</p>
                              <p className="text-body text-text-secondary text-sm">
                                {cbContent.meta_cognition.stuck_diagnosis.substring(0, 150)}...
                              </p>
                            </div>
                          )}
                          <button
                            onClick={() => setActiveTab('learn')}
                            className="w-full btn btn-secondary"
                          >
                            📚 학습하러 가기
                          </button>
                        </>
                      ) : (
                        // 오답
                        <>
                          <div className="text-5xl mb-4">🤔</div>
                          <h3 className="text-heading text-danger mb-2">아쉬워요!</h3>
                          {cbContent?.common_errors?.[0] && (
                            <div className="p-4 bg-danger-light rounded-lg mb-4 text-left">
                              <p className="text-caption text-danger mb-1">⚠️ 많은 학생이 이런 실수를 해요:</p>
                              <p className="text-body text-text-secondary text-sm">
                                {cbContent.common_errors[0].substring(0, 150)}...
                              </p>
                            </div>
                          )}
                          <p className="text-body text-text-secondary mb-4">어디서 막혔는지 확인해볼게요...</p>
                          <div className="space-y-3">
                            <button
                              onClick={startTriangulation}
                              className="w-full btn text-white"
                              style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                            >
                              🔍 진단 시작
                            </button>
                            <button
                              onClick={() => copyToClipboard(generateGeminiTutorPrompt(), '프롬프트가 복사되었습니다! Gemini에 붙여넣기 하세요.')}
                              className="w-full btn btn-secondary justify-between"
                            >
                              <span>🤖 Gemini 튜터와 풀어보기</span>
                              <span className="text-text-tertiary text-xs">복사</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 진단 결과 */}
                  {challengePhase === 'diagnosis' && diagnosisResult && (
                    <div className="py-6">
                      <div className="text-center mb-6">
                        <div className="text-4xl mb-4">📊</div>
                        <h3 className="text-subheading text-text-primary mb-2">진단 결과</h3>
                      </div>

                      <div className={`p-4 rounded-lg mb-6 ${
                        diagnosisResult.type === 'retry' ? 'bg-success-light' :
                        diagnosisResult.type === 'error' ? 'bg-warning-light' : 'bg-info-light'
                      }`}>
                        <p className={`text-body ${
                          diagnosisResult.type === 'retry' ? 'text-success' :
                          diagnosisResult.type === 'error' ? 'text-warning' : 'text-info'
                        }`}>
                          {diagnosisResult.message}
                        </p>
                      </div>

                      {/* 액션 버튼 */}
                      {diagnosisResult.type === 'prerequisite' || diagnosisResult.type === 'confusion' ? (
                        diagnosisStack.length >= MAX_DIAGNOSIS_DEPTH ? (
                          <div className="p-4 bg-bg-sidebar rounded-lg mb-3 text-center">
                            <p className="text-caption text-text-secondary mb-2">
                              선수개념 탐색 깊이 한계에 도달했습니다.
                            </p>
                            <p className="text-body text-text-primary">
                              [{diagnosisResult.conceptTitle}]을 스킬맵에서 직접 찾아 학습하세요.
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (onNavigateToPrereq) {
                                onNavigateToPrereq(diagnosisResult.conceptId, diagnosisResult.conceptTitle);
                              } else {
                                toast(`[${diagnosisResult.conceptTitle}] 개념으로 이동`);
                              }
                            }}
                            className="w-full btn text-white mb-3"
                            style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                          >
                            📍 {diagnosisResult.conceptTitle}(으)로 이동
                          </button>
                        )
                      ) : diagnosisResult.type === 'error' ? (
                        <button
                          onClick={() => {
                            setActiveTab('learn');
                            setActivePathway('error_correction');
                          }}
                          className="w-full btn text-white mb-3"
                          style={{ backgroundColor: 'var(--warning)' }}
                        >
                          🔧 오류 교정 학습하기
                        </button>
                      ) : diagnosisResult.type === 'retry' ? (
                        <button
                          onClick={() => {
                            setChallengePhase('ready');
                            setSelectedAnswer(null);
                            setIsCorrect(null);
                          }}
                          className="w-full btn text-white mb-3"
                          style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                        >
                          🔄 다시 도전하기
                        </button>
                      ) : null}

                      <button
                        onClick={() => copyToClipboard(generateGeminiTutorPrompt(), '프롬프트가 복사되었습니다! Gemini에 붙여넣기 하세요.')}
                        className="w-full btn btn-secondary justify-between mb-3"
                      >
                        <span>🤖 Gemini 튜터와 풀어보기</span>
                        <span className="text-text-tertiary text-xs">복사</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('learn')}
                        className="w-full btn btn-secondary"
                      >
                        📚 학습 탭으로 이동
                      </button>
                    </div>
                  )}

                  {/* Gemini 추가 문제 */}
                  {(challengePhase === 'result' || challengePhase === 'diagnosis') && !isCorrect && (
                    <div className="mt-6 pt-6 border-t border-border-subtle">
                      <p className="text-caption text-text-tertiary mb-3">추가 연습이 필요하다면:</p>
                      <button
                        onClick={() => copyToClipboard(generateExtraQuestionPrompt(), 'Gemini 프롬프트가 복사되었습니다!')}
                        className="w-full btn btn-secondary justify-between"
                      >
                        <span>🤖 Gemini에 문제 요청</span>
                        <span className="text-text-tertiary">복사</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ===== 학습 탭 ===== */}
              {activeTab === 'learn' && (
                <>
                  {/* Learning Pathways */}
                  <div className="mb-6">
                    <h3 className="text-subheading text-text-primary mb-3">Learning Pathways</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {LEARNING_PATHWAYS.map((pathway) => (
                        <button
                          key={pathway.id}
                          onClick={() => setActivePathway(pathway.id)}
                          className={`px-3 py-1.5 rounded-md text-caption transition-colors ${
                            activePathway === pathway.id ? 'text-white' : 'bg-bg-sidebar text-text-secondary hover:bg-bg-hover'
                          }`}
                          style={activePathway === pathway.id ? {
                            backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)'
                          } : {}}
                        >
                          {pathway.icon} {pathway.name}
                        </button>
                      ))}
                    </div>
                    <div className="p-4 bg-bg-sidebar rounded-lg text-body text-text-secondary leading-relaxed">
                      {pathways[activePathway] || '이 경로의 콘텐츠가 아직 없습니다.'}
                    </div>
                  </div>

                  {/* Bloom Level */}
                  <div className="mb-6">
                    <h3 className="text-subheading text-text-primary mb-3">Bloom Level</h3>
                    <div className="flex gap-1">
                      {BLOOM_LEVELS.map((level, idx) => (
                        <div
                          key={level.level}
                          className={`flex-1 h-8 flex items-center justify-center text-caption rounded ${
                            idx < bloomLevel ? 'text-white' : 'bg-bg-hover text-text-disabled'
                          }`}
                          style={idx < bloomLevel ? {
                            backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)',
                            opacity: 1 - (bloomLevel - 1 - idx) * 0.15
                          } : {}}
                          title={level.nameKo}
                        >
                          {idx < bloomLevel ? '★' : '☆'}
                        </div>
                      ))}
                    </div>
                    <p className="text-caption text-text-tertiary mt-2">
                      {BLOOM_LEVELS[bloomLevel - 1]?.name} ({BLOOM_LEVELS[bloomLevel - 1]?.nameKo}) · 제한시간 {formatTime(getTimeLimit())}
                    </p>
                  </div>

                  {/* Common Errors */}
                  {(cbContent?.common_errors || []).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-subheading text-text-primary mb-3">흔한 오류</h3>
                      <ul className="space-y-2">
                        {cbContent.common_errors.map((error, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-body text-text-secondary">
                            <span className="text-danger flex-shrink-0">⚠️</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Test Patterns */}
                  {(cbContent?.test_patterns?.sat || cbContent?.test_patterns?.csat) && (
                    <div className="mb-6">
                      <h3 className="text-subheading text-text-primary mb-3">시험 출제 패턴</h3>
                      {cbContent.test_patterns.sat && (
                        <div className="mb-3">
                          <div className="text-caption text-info font-medium mb-1">SAT</div>
                          <p className="text-body text-text-secondary p-3 bg-info-light rounded-lg">{cbContent.test_patterns.sat}</p>
                        </div>
                      )}
                      {cbContent.test_patterns.csat && (
                        <div>
                          <div className="text-caption text-success font-medium mb-1">수능</div>
                          <p className="text-body text-text-secondary p-3 bg-success-light rounded-lg">{cbContent.test_patterns.csat}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 학습 후 마스터 버튼 */}
                  <div className="pt-6 border-t border-border-subtle">
                    {status === 'mastered' ? (
                      <div className="w-full py-3 rounded-lg bg-success-light text-success text-center font-medium">
                        ✓ 이미 마스터한 개념입니다
                      </div>
                    ) : status === 'locked' ? (
                      <div className="w-full py-3 rounded-lg bg-bg-hover text-text-disabled text-center">
                        🔒 선수 개념을 먼저 마스터하세요
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveTab('challenge')}
                        className="w-full btn text-white"
                        style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                      >
                        ✏️ 도전하러 가기
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* ===== 자료 탭 ===== */}
              {activeTab === 'resources' && (
                <div>
                  {/* 📺 추천 강의 (YouTube 매핑) - 교육과정별 필터 */}
                  {(() => {
                    // 교육과정별 필터: US=en만, KR=ko만
                    const videos = isKoreanConcept ? youtubeVideos?.ko : youtubeVideos?.en;
                    const langLabel = isKoreanConcept ? '🇰🇷 한국 강의' : '🇺🇸 영어 강의';

                    // 검색어 정제 함수: "YouTube:", "Watch:" 접두사 제거
                    const cleanSearchQuery = (channel, title) => {
                      const cleanTitle = title
                        .replace(/^YouTube:\s*/i, '')
                        .replace(/^Watch:\s*/i, '');
                      return `${channel} ${cleanTitle}`;
                    };

                    if (!videos || videos.length === 0) return null;

                    return (
                      <div className="mb-6">
                        <h3 className="text-subheading text-text-primary mb-4">📺 추천 강의</h3>
                        <div>
                          <p className="text-caption text-text-tertiary mb-2">{langLabel}</p>
                          <div className="space-y-2">
                            {videos.slice(0, 3).map((video, idx) => (
                              <a
                                key={idx}
                                href={video.video_id
                                  ? `https://www.youtube.com/watch?v=${video.video_id}`
                                  : `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanSearchQuery(video.channel, video.title))}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-bg-sidebar rounded-lg hover:bg-bg-hover transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="text-xl text-red-500">▶️</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-body text-text-primary truncate">
                                      {video.title.replace(/^YouTube:\s*/i, '').replace(/^Watch:\s*/i, '')}
                                    </div>
                                    <div className="flex items-center gap-2 text-caption text-text-tertiary">
                                      <span>{video.channel}</span>
                                      <span>·</span>
                                      <span>{video.views} views</span>
                                      {video.video_id && <span className="text-success">✓ 직접 링크</span>}
                                    </div>
                                  </div>
                                  <span className="text-text-tertiary flex-shrink-0">→</span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Free Resources (링크 자동 생성) */}
                  <h3 className="text-subheading text-text-primary mb-4">학습 자료</h3>
                  {(() => {
                    const resources = generateResourceLinks(cbContent?.free_resources, cbContent?.title_en);
                    const watchResources = resources.filter(r => ['Khan Academy', 'YouTube', 'MIT OCW'].includes(r.source));
                    const readResources = resources.filter(r => ['OpenStax', 'CK-12'].includes(r.source));
                    const interactiveResources = resources.filter(r => ['PhET', 'Desmos', 'GeoGebra'].includes(r.source));
                    const otherResources = resources.filter(r => !['Khan Academy', 'YouTube', 'MIT OCW', 'OpenStax', 'CK-12', 'PhET', 'Desmos', 'GeoGebra'].includes(r.source));

                    const ResourceItem = ({ resource }) => (
                      <a
                        href={resource.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-bg-sidebar rounded-lg hover:bg-bg-hover transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {resource.source === 'Khan Academy' ? '📺' :
                             resource.source === 'YouTube' ? '▶️' :
                             resource.source === 'MIT OCW' ? '🎓' :
                             resource.source === 'OpenStax' ? '📖' :
                             resource.source === 'CK-12' ? '📚' :
                             resource.source === 'PhET' ? '🔬' :
                             resource.source === 'Desmos' ? '📊' :
                             resource.source === 'GeoGebra' ? '📐' : '🔗'}
                          </span>
                          <div className="flex-1">
                            <div className="text-body text-text-primary">{resource.title || resource.source}</div>
                            <div className="text-caption text-text-tertiary">{resource.source}</div>
                          </div>
                          <span className="text-text-tertiary">→</span>
                        </div>
                      </a>
                    );

                    return resources.length > 0 ? (
                      <div className="space-y-4 mb-6">
                        {watchResources.length > 0 && (
                          <div>
                            <p className="text-caption text-text-tertiary mb-2">🎥 Watch</p>
                            <div className="space-y-2">
                              {watchResources.map((r, idx) => <ResourceItem key={idx} resource={r} />)}
                            </div>
                          </div>
                        )}
                        {readResources.length > 0 && (
                          <div>
                            <p className="text-caption text-text-tertiary mb-2">📖 Read</p>
                            <div className="space-y-2">
                              {readResources.map((r, idx) => <ResourceItem key={idx} resource={r} />)}
                            </div>
                          </div>
                        )}
                        {interactiveResources.length > 0 && (
                          <div>
                            <p className="text-caption text-text-tertiary mb-2">🔬 Interactive</p>
                            <div className="space-y-2">
                              {interactiveResources.map((r, idx) => <ResourceItem key={idx} resource={r} />)}
                            </div>
                          </div>
                        )}
                        {otherResources.length > 0 && (
                          <div className="space-y-2">
                            {otherResources.map((r, idx) => <ResourceItem key={idx} resource={r} />)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-text-tertiary mb-6">
                        이 개념의 추천 자료가 아직 없어요.
                        <div className="mt-2 space-y-2">
                          <a
                            href={`https://www.khanacademy.org/search?referer=%2F&page_search_query=${encodeURIComponent(cbContent?.title_en || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-2 bg-bg-sidebar rounded text-info hover:bg-bg-hover"
                          >
                            📺 Khan Academy에서 검색
                          </a>
                          <a
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(cbContent?.title_en || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-2 bg-bg-sidebar rounded text-info hover:bg-bg-hover"
                          >
                            ▶️ YouTube에서 검색
                          </a>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Meta Cognition */}
                  {cbContent?.meta_cognition && (
                    <div className="mb-6">
                      <h4 className="text-ui text-text-primary mb-3">🧠 메타인지 도움말</h4>
                      {cbContent.meta_cognition.stuck_diagnosis && (
                        <div className="mb-4">
                          <div className="text-caption text-text-tertiary mb-1">막힐 때 체크리스트</div>
                          <p className="text-body text-text-secondary p-3 bg-bg-sidebar rounded-lg">{cbContent.meta_cognition.stuck_diagnosis}</p>
                        </div>
                      )}
                      {cbContent.meta_cognition.self_check && (
                        <div>
                          <div className="text-caption text-text-tertiary mb-1">자기 점검</div>
                          <p className="text-body text-text-secondary p-3 bg-bg-sidebar rounded-lg">{cbContent.meta_cognition.self_check}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 사진 분석 프롬프트 */}
                  <div className="pt-6 border-t border-border-subtle">
                    <h4 className="text-ui text-text-primary mb-3">📸 숙제 분석</h4>
                    <p className="text-caption text-text-tertiary mb-3">틀린 문제 사진을 Gemini에 분석해보세요:</p>
                    <button
                      onClick={() => copyToClipboard(
                        `아래 문제의 내 풀이를 분석해주세요.

1. 어떤 개념의 문제인지 알려주세요
2. 내가 틀렸다면, 틀린 이유를 분류해주세요:
   A) 선행 개념을 모름 — 어떤 개념인지 알려주세요
   B) 비슷한 개념과 헷갈림 — 어떤 개념인지 알려주세요
   C) 개념은 알지만 계산/표기 실수
3. 각 경우에 내가 복습해야 할 것을 알려주세요
4. 답을 바로 알려주지 말고, 내가 어디서 잘못했는지 질문으로 유도해주세요`,
                        '사진 분석 프롬프트가 복사되었습니다!'
                      )}
                      className="w-full btn btn-secondary justify-between"
                    >
                      <span>📸 사진 분석 프롬프트</span>
                      <span className="text-text-tertiary">복사</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 토스트 */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-text-primary text-bg-card rounded-lg shadow-elevated z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </>
  );
}
