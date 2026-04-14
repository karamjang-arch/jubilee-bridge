'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LEARNING_PATHWAYS, BLOOM_LEVELS } from '@/lib/constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProfile } from '@/hooks/useProfile';

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
  const { studentId } = useProfile();
  const [activeTab, setActiveTab] = useState('challenge'); // challenge, learn, resources, history
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

  // 대학 강의 (subject 기반 필터링)
  const [universityCourses, setUniversityCourses] = useState([]);

  // 대학 강의 타임스탬프 매핑 (MIT에서 이렇게 설명해요)
  const [timestampSegments, setTimestampSegments] = useState([]);

  // 학습 이력 (이 개념에 대한)
  const [conceptHistory, setConceptHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // AI 튜터 상태 (Deep Solve 패턴)
  const [tutorMessages, setTutorMessages] = useState([]);
  const [tutorInput, setTutorInput] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorMode, setTutorMode] = useState('chat'); // 'chat' | 'wrong_answer_help'
  const [tutorSessionStartTime, setTutorSessionStartTime] = useState(null);
  const [suggestedPrereqs, setSuggestedPrereqs] = useState([]);
  const tutorMessagesEndRef = useRef(null);

  // 한국 개념인지 확인
  const conceptId = concept.concept_id || concept.id;
  const isKoreanConcept = conceptId?.startsWith('KR-');
  const curriculum = isKoreanConcept ? 'kr' : 'us';

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
      fetch('/data/university_courses.json').then(r => r.json()).catch(() => []),
      fetch('/data/course_concept_map.json').then(r => r.json()).catch(() => []),
      fetch('/data/timestamp_mappings.json').then(r => r.json()).catch(() => []),
    ])
      .then(([content, meta, questionsData, ytMapping, uniCourses, courseMap, timestampMappings]) => {
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

        // 대학 강의 필터링 (매핑 우선, 없으면 subject 기반)
        // 1. 이 개념에 직접 매핑된 강의 찾기
        const mappedCourseIds = (courseMap || [])
          .filter(m => m.concept_ids?.includes(conceptId) && m.relevance !== 'low')
          .map(m => m.course_id);

        let filtered = [];
        if (mappedCourseIds.length > 0) {
          // 매핑된 강의 우선
          filtered = (uniCourses || [])
            .filter(c => mappedCourseIds.includes(c.course_id))
            .slice(0, 5);
        }

        // 2. 매핑된 게 없으면 subject 기반 fallback
        if (filtered.length === 0) {
          const subjectMap = {
            math: 'mathematics',
            physics: 'physics',
            chemistry: 'chemistry',
          };
          const courseCategory = subjectMap[subject] || subject;
          filtered = (uniCourses || [])
            .filter(c => c.category === courseCategory)
            .slice(0, 5);
        }

        setUniversityCourses(filtered);

        // 3. 타임스탬프 세그먼트 (이 개념에 매칭된 것만)
        const matchedSegments = [];
        (timestampMappings || []).forEach(course => {
          (course.videos || []).forEach(video => {
            (video.segments || []).forEach(seg => {
              if (seg.concept_ids?.includes(conceptId)) {
                matchedSegments.push({
                  course_id: course.course_id,
                  course_title: course.title,
                  video_id: video.video_id,
                  video_title: video.title,
                  ...seg,
                });
              }
            });
          });
        });
        setTimestampSegments(matchedSegments.slice(0, 3)); // 최대 3개
      })
      .catch(err => console.error('Failed to load content:', err))
      .finally(() => setLoadingContent(false));
  }, [conceptId]);

  // 이 개념의 학습 이력 로드
  useEffect(() => {
    if (!studentId || !conceptId) return;

    setHistoryLoading(true);
    fetch(`/api/concept-history?student_id=${studentId}&concept_id=${conceptId}&limit=50`)
      .then(r => r.json())
      .then(data => {
        if (data.events) {
          // 이 개념에 대한 통계 계산
          const quizEvents = data.events.filter(e =>
            e.event_type === 'test_complete' || e.event_type === 'test_attempt'
          );
          const correctCount = quizEvents.filter(e => e.score >= 70).length;
          const totalAttempts = quizEvents.length;
          const lastStudied = data.events[0]?.timestamp || null;

          setConceptHistory({
            events: data.events,
            totalAttempts,
            correctCount,
            accuracy: totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : null,
            lastStudied,
            isMastered: status === 'mastered' || status === 'placement_mastered',
          });
        }
      })
      .catch(err => console.error('Failed to load concept history:', err))
      .finally(() => setHistoryLoading(false));
  }, [studentId, conceptId, status]);

  // 학습 이벤트 기록 (비동기, fire-and-forget)
  const recordEvent = useCallback(async (eventType, score = null, source = 'quiz', detail = {}) => {
    if (!studentId || !conceptId) return;

    try {
      await fetch('/api/concept-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          event_type: eventType,
          curriculum,
          subject: subject?.id,
          concept_id: conceptId,
          score,
          detail: { ...detail, source },
        }),
      });
    } catch (error) {
      console.error('Failed to record event:', error);
    }
  }, [studentId, conceptId, curriculum, subject]);

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

    // 학습 이벤트 기록 (퀴즈 결과)
    recordEvent(
      'test_complete',
      correct ? 100 : 0,
      'quiz',
      {
        correct,
        timed_out: timedOut,
        question_type: currentQuestion.type || 'diagnostic',
        time_taken: getTimeLimit() - timeLeft,
      }
    );

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
  }, [selectedAnswer, currentQuestion, timedOut, recordEvent, getTimeLimit, timeLeft]);

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

  // AI 튜터 메시지 전송 (Deep Solve 패턴)
  const handleTutorSend = useCallback(async (message) => {
    if (!message?.trim() || tutorLoading) return;

    // 세션 시작 시간 기록
    if (!tutorSessionStartTime) {
      setTutorSessionStartTime(Date.now());
    }

    // 사용자 메시지 추가
    const userMessage = { role: 'user', content: message.trim() };
    const newMessages = [...tutorMessages, userMessage];
    setTutorMessages(newMessages);
    setTutorInput('');
    setTutorLoading(true);

    // 스크롤
    setTimeout(() => {
      tutorMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      // 컨텍스트 구성
      const context = {
        concept_title: cbContent?.title_ko || cbContent?.title_en || concept.title_ko || conceptId,
        concept_description: cbContent?.core_description || '',
        prerequisites: cbContent?.prerequisites?.map(p => ({ concept_id: p })) || [],
        mastery_status: status,
        common_errors: cbContent?.common_errors || [],
      };

      // 오답 모드일 때 문제 컨텍스트 추가
      if (tutorMode === 'wrong_answer_help' && currentQuestion) {
        context.question_context = {
          question: currentQuestion.question || currentQuestion.passage?.substring(0, 200),
          user_answer: selectedAnswer || '',
          correct_answer: currentQuestion.correctAnswer || currentQuestion.answer || '',
          error_trap: currentQuestion.error_trap || '',
        };
      }

      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          concept_id: conceptId,
          messages: newMessages,
          action: tutorMode,
          context,
        }),
      });

      if (!response.ok) throw new Error('API 호출 실패');

      const data = await response.json();

      // 튜터 응답 추가
      const assistantMessage = { role: 'assistant', content: data.reply };
      setTutorMessages(prev => [...prev, assistantMessage]);

      // 선수개념 추천 업데이트
      if (data.suggested_prerequisites?.length > 0) {
        setSuggestedPrereqs(prev => [...new Set([...prev, ...data.suggested_prerequisites])]);
      }

      // 턴 제한 도달 시 세션 저장
      if (data.turn_limit_reached && studentId) {
        const duration = tutorSessionStartTime
          ? Math.round((Date.now() - tutorSessionStartTime) / 1000)
          : 0;
        recordEvent('tutor_session', null, 'tutor', {
          messages: [...newMessages, assistantMessage],
          diagnosed_prerequisites: suggestedPrereqs,
          mode: tutorMode,
          turn_count: 10,
          duration_sec: duration,
          completed: true,
        });
      }
    } catch (error) {
      console.error('Tutor API error:', error);
      setTutorMessages(prev => [
        ...prev,
        { role: 'assistant', content: '죄송해요, 잠시 문제가 생겼어요. 다시 시도해주세요!' }
      ]);
    } finally {
      setTutorLoading(false);
      setTimeout(() => {
        tutorMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [tutorMessages, tutorLoading, tutorMode, tutorSessionStartTime, cbContent, concept, conceptId, currentQuestion, selectedAnswer, status, studentId, suggestedPrereqs, recordEvent]);

  // 오답 시 튜터 탭으로 이동 + 오답 모드 시작
  const startWrongAnswerHelp = useCallback(async () => {
    setTutorMode('wrong_answer_help');
    setTutorMessages([]);
    setSuggestedPrereqs([]);
    setTutorSessionStartTime(Date.now());
    setActiveTab('tutor');

    // 초기 메시지 가져오기
    try {
      const context = {
        concept_title: cbContent?.title_ko || cbContent?.title_en || concept.title_ko || conceptId,
        concept_description: cbContent?.core_description || '',
        prerequisites: cbContent?.prerequisites?.map(p => ({ concept_id: p })) || [],
        mastery_status: status,
        common_errors: cbContent?.common_errors || [],
        question_context: {
          question: currentQuestion?.question || currentQuestion?.passage?.substring(0, 200) || '',
          user_answer: selectedAnswer || '',
          correct_answer: currentQuestion?.correctAnswer || currentQuestion?.answer || '',
          error_trap: currentQuestion?.error_trap || '',
        },
      };

      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          concept_id: conceptId,
          messages: [],
          action: 'wrong_answer_help',
          context,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTutorMessages([{ role: 'assistant', content: data.reply }]);
      }
    } catch (error) {
      console.error('Failed to start wrong answer help:', error);
      setTutorMessages([{
        role: 'assistant',
        content: '방금 문제가 틀렸네요. 왜 그 답을 선택했는지 말해줄래요? 같이 생각해봐요! 😊'
      }]);
    }
  }, [cbContent, concept, conceptId, currentQuestion, selectedAnswer, status, studentId]);

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

          {/* 탭 - 순서 변경: 도전 | 학습 | 튜터 | 자료 | 이력 */}
          <div className="flex gap-1 mb-4 p-1 bg-bg-sidebar rounded-lg">
            {[
              { id: 'challenge', label: '✏️ 도전' },
              { id: 'learn', label: '📚 학습' },
              { id: 'tutor', label: '🤖 튜터' },
              { id: 'resources', label: '🔗 자료' },
              { id: 'history', label: '📊 이력' },
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
                            {/* 1. AI 튜터와 대화 (Deep Solve) - 권장 */}
                            <button
                              onClick={startWrongAnswerHelp}
                              className="w-full btn text-white"
                              style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                            >
                              🤖 AI 튜터와 대화하기
                            </button>
                            {/* 2. 삼각측량 진단 */}
                            <button
                              onClick={startTriangulation}
                              className="w-full btn btn-secondary"
                            >
                              🔍 삼각측량 진단
                            </button>
                            {/* 3. 외부 Gemini로 복사 (보조) */}
                            <button
                              onClick={() => copyToClipboard(generateGeminiTutorPrompt(), '프롬프트가 복사되었습니다! Gemini에 붙여넣기 하세요.')}
                              className="w-full text-xs text-text-tertiary hover:text-text-secondary py-2"
                            >
                              📋 외부 Gemini 앱으로 복사
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

              {/* ===== 튜터 탭 (Deep Solve 패턴) ===== */}
              {activeTab === 'tutor' && (
                <div className="flex flex-col h-[500px]">
                  {/* 헤더 */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🤖</span>
                      <div>
                        <h3 className="text-ui font-medium text-text-primary">AI 튜터</h3>
                        <p className="text-xs text-text-tertiary">Deep Solve 패턴 · 소크라테스식 튜터링</p>
                      </div>
                    </div>
                    {tutorMessages.length > 0 && (
                      <button
                        onClick={() => {
                          // 세션 저장 후 초기화
                          if (tutorMessages.length > 0 && studentId) {
                            const duration = tutorSessionStartTime
                              ? Math.round((Date.now() - tutorSessionStartTime) / 1000)
                              : 0;
                            recordEvent('tutor_session', null, 'tutor', {
                              messages: tutorMessages,
                              diagnosed_prerequisites: suggestedPrereqs,
                              mode: tutorMode,
                              turn_count: Math.floor(tutorMessages.length / 2),
                              duration_sec: duration,
                            });
                          }
                          setTutorMessages([]);
                          setTutorMode('chat');
                          setSuggestedPrereqs([]);
                          setTutorSessionStartTime(null);
                        }}
                        className="text-caption text-text-tertiary hover:text-text-secondary"
                      >
                        🔄 새 대화
                      </button>
                    )}
                  </div>

                  {/* 선수개념 추천 배지 */}
                  {suggestedPrereqs.length > 0 && (
                    <div className="mb-3 p-3 bg-warning-light rounded-lg">
                      <p className="text-caption text-warning mb-2">💡 튜터가 추천하는 선수개념:</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestedPrereqs.map((prereq, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-white rounded text-xs text-warning cursor-pointer hover:bg-warning hover:text-white transition-colors"
                            onClick={async () => {
                              // 선수개념 검색 후 이동 시도
                              try {
                                const res = await fetch(`/api/concepts?search=${encodeURIComponent(prereq)}`);
                                const data = await res.json();
                                if (data.concepts && data.concepts.length > 0) {
                                  const foundConcept = data.concepts[0];
                                  if (onNavigateToPrereq) {
                                    onNavigateToPrereq(foundConcept.concept_id, foundConcept.title_ko || foundConcept.title_en);
                                  } else {
                                    toast(`"${prereq}" → ${foundConcept.concept_id} 발견! 스킬맵에서 찾아보세요.`);
                                  }
                                } else {
                                  toast(`"${prereq}" 개념을 스킬맵에서 찾아보세요!`);
                                }
                              } catch {
                                toast(`"${prereq}" 개념을 스킬맵에서 찾아보세요!`);
                              }
                            }}
                          >
                            {prereq}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 대화 메시지 영역 */}
                  <div className="flex-1 overflow-y-auto mb-3 space-y-3 pr-1">
                    {tutorMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-text-tertiary">
                        <span className="text-4xl mb-3">🧑‍🏫</span>
                        <p className="text-body mb-1">안녕! 이 개념에 대해 궁금한 게 있어?</p>
                        <p className="text-caption">무엇이든 물어보세요. 친절하게 설명해드릴게요!</p>
                        <div className="mt-4 flex flex-wrap gap-2 justify-center">
                          {[
                            '이 개념이 뭐예요?',
                            '예시로 설명해주세요',
                            '어디에 쓰여요?',
                          ].map((suggestion, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleTutorSend(suggestion)}
                              className="px-3 py-1.5 bg-bg-sidebar rounded-full text-caption text-text-secondary hover:bg-bg-hover transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {tutorMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
                                msg.role === 'user'
                                  ? 'bg-info text-white rounded-br-md'
                                  : 'bg-bg-sidebar text-text-primary rounded-bl-md'
                              }`}
                            >
                              <p className="text-body whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {tutorLoading && (
                          <div className="flex justify-start">
                            <div className="bg-bg-sidebar px-4 py-2.5 rounded-2xl rounded-bl-md">
                              <span className="text-text-tertiary">생각 중...</span>
                            </div>
                          </div>
                        )}
                        <div ref={tutorMessagesEndRef} />
                      </>
                    )}
                  </div>

                  {/* 입력 영역 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tutorInput}
                      onChange={(e) => setTutorInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && tutorInput.trim()) {
                          e.preventDefault();
                          handleTutorSend(tutorInput);
                        }
                      }}
                      placeholder="질문을 입력하세요..."
                      disabled={tutorLoading}
                      className="flex-1 px-4 py-2.5 bg-bg-sidebar border border-border-subtle rounded-full text-body focus:border-info focus:outline-none disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleTutorSend(tutorInput)}
                      disabled={!tutorInput.trim() || tutorLoading}
                      className="px-4 py-2.5 bg-info text-white rounded-full text-ui disabled:opacity-50 hover:bg-blue-600 transition-colors"
                    >
                      {tutorLoading ? '...' : '전송'}
                    </button>
                  </div>

                  {/* 대화 턴 카운터 */}
                  {tutorMessages.length > 0 && (
                    <div className="mt-2 text-center text-xs text-text-tertiary">
                      대화 {Math.floor(tutorMessages.length / 2)}/10턴
                      {Math.floor(tutorMessages.length / 2) >= 8 && ' (곧 종료됩니다)'}
                    </div>
                  )}
                </div>
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

                  {/* MIT에서 이렇게 설명해요 (Timestamp Segments) */}
                  {timestampSegments.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-subheading text-text-primary mb-4">▶️ MIT에서 이렇게 설명해요</h3>
                      <div className="space-y-2">
                        {timestampSegments.map((seg, idx) => (
                          <a
                            key={idx}
                            href={`https://www.youtube.com/watch?v=${seg.video_id}&t=${Math.floor(seg.start_time)}s`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-lg hover:from-red-100 hover:to-orange-100 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-xl text-red-500 flex-shrink-0">▶️</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-body text-text-primary">{seg.topic}</div>
                                <div className="flex items-center gap-2 text-caption text-text-tertiary mt-1">
                                  <span>{seg.course_title?.split(',')[0]}</span>
                                  <span>·</span>
                                  <span>{Math.floor(seg.start_time / 60)}:{String(Math.floor(seg.start_time % 60)).padStart(2, '0')}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                                    seg.difficulty === 'basic' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {seg.difficulty === 'basic' ? '기초' : '중급'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 대학 강의 (University Courses) */}
                  {universityCourses.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-subheading text-text-primary mb-4">🎓 대학 강의</h3>
                      <p className="text-caption text-text-tertiary mb-3">
                        이 개념을 깊이 있게 배우고 싶다면 대학 강의를 참고하세요
                      </p>
                      <div className="space-y-2">
                        {universityCourses.map((course, idx) => (
                          <a
                            key={course.course_id || idx}
                            href={course.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 bg-bg-sidebar rounded-lg hover:bg-bg-hover transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">
                                {course.platform === 'YouTube' ? '▶️' :
                                 course.platform === 'MIT_OCW' ? '🎓' :
                                 course.platform === 'Coursera' ? '📚' : '🔗'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-body text-text-primary truncate">{course.title}</div>
                                <div className="flex items-center gap-2 text-caption text-text-tertiary">
                                  <span>{course.university}</span>
                                  <span>·</span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                                    course.level === 'intro' ? 'bg-green-100 text-green-700' :
                                    course.level === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {course.level === 'intro' ? '입문' :
                                     course.level === 'intermediate' ? '중급' : '고급'}
                                  </span>
                                </div>
                              </div>
                              <span className="text-text-tertiary flex-shrink-0">→</span>
                            </div>
                          </a>
                        ))}
                      </div>
                      <a
                        href="/resources"
                        className="block mt-3 text-center text-caption text-info hover:underline"
                      >
                        전체 대학 강의 보기 →
                      </a>
                    </div>
                  )}

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

              {/* ===== 학습 이력 탭 ===== */}
              {activeTab === 'history' && (
                <div>
                  <h3 className="text-subheading text-text-primary mb-4">📊 이 개념 학습 이력</h3>

                  {historyLoading ? (
                    <div className="py-8 text-center text-text-tertiary">
                      학습 이력을 불러오는 중...
                    </div>
                  ) : conceptHistory ? (
                    <>
                      {/* 요약 통계 */}
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="p-4 bg-bg-sidebar rounded-lg text-center">
                          <div className="text-stat text-info">{conceptHistory.totalAttempts}</div>
                          <div className="text-caption text-text-tertiary">총 도전 횟수</div>
                        </div>
                        <div className="p-4 bg-bg-sidebar rounded-lg text-center">
                          <div className={`text-stat ${
                            conceptHistory.accuracy >= 70 ? 'text-success' :
                            conceptHistory.accuracy >= 50 ? 'text-warning' : 'text-danger'
                          }`}>
                            {conceptHistory.accuracy !== null ? `${conceptHistory.accuracy}%` : '-'}
                          </div>
                          <div className="text-caption text-text-tertiary">정답률</div>
                        </div>
                        <div className="p-4 bg-bg-sidebar rounded-lg text-center">
                          <div className="text-ui font-medium text-text-primary">
                            {conceptHistory.lastStudied
                              ? new Date(conceptHistory.lastStudied).toLocaleDateString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : '-'
                            }
                          </div>
                          <div className="text-caption text-text-tertiary">마지막 학습</div>
                        </div>
                        <div className="p-4 bg-bg-sidebar rounded-lg text-center">
                          <div className={`text-stat ${conceptHistory.isMastered ? 'text-success' : 'text-text-tertiary'}`}>
                            {conceptHistory.isMastered ? '✓' : '-'}
                          </div>
                          <div className="text-caption text-text-tertiary">마스터 여부</div>
                        </div>
                      </div>

                      {/* 최근 활동 */}
                      {conceptHistory.events?.length > 0 && (
                        <div>
                          <h4 className="text-ui text-text-primary mb-3">최근 활동</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {conceptHistory.events.slice(0, 10).map((event, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-bg-sidebar rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">
                                    {event.event_type === 'test_complete' && (event.score >= 70 ? '✅' : '❌')}
                                    {event.event_type === 'content_view' && '👁️'}
                                    {event.event_type === 'mastery_update' && '🎯'}
                                    {event.event_type === 'tutor_session' && '🤖'}
                                    {!['test_complete', 'content_view', 'mastery_update', 'tutor_session'].includes(event.event_type) && '📝'}
                                  </span>
                                  <div>
                                    <div className="text-caption text-text-primary">
                                      {event.event_type === 'test_complete' && (event.score >= 70 ? '정답' : '오답')}
                                      {event.event_type === 'content_view' && '콘텐츠 열람'}
                                      {event.event_type === 'mastery_update' && '마스터 달성'}
                                      {event.event_type === 'test_attempt' && '테스트 시작'}
                                      {event.event_type === 'tutor_session' && `튜터 대화 ${event.detail?.turn_count || 0}턴`}
                                    </div>
                                    {event.score !== null && event.event_type === 'test_complete' && (
                                      <div className="text-xs text-text-tertiary">
                                        {event.detail?.source || 'quiz'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-text-tertiary">
                                  {new Date(event.timestamp).toLocaleDateString('ko-KR', {
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center text-text-tertiary">
                      <span className="text-3xl block mb-2">📊</span>
                      <p>아직 이 개념을 학습한 기록이 없습니다</p>
                      <p className="text-xs mt-1">도전 탭에서 문제를 풀어보세요!</p>
                    </div>
                  )}
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
