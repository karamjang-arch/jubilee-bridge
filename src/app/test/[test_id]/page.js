'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// 과목별 시간 제한 (분)
const TIME_LIMITS = {
  'sat-math': 35,
  'sat-reading': 65,
  'psat-math': 35,
  'psat-reading': 60,
  'csat': 80,
  'mock': 80,
  'ged': 40,
  'edu': 60,
  default: 60,
};

// 로컬스토리지 키
const getStorageKey = (testId) => `test_progress_${testId}`;

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.test_id;

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 풀이 상태
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [currentQuestion, setCurrentQuestion] = useState(0);

  // 타이머
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);

  // 모달
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);

  // 지문 뷰 (모바일)
  const [mobileView, setMobileView] = useState('question'); // 'passage' | 'question'

  // JSON 로드
  useEffect(() => {
    async function loadTest() {
      try {
        const res = await fetch(`/tests/json/${testId}.json`);
        if (!res.ok) throw new Error('시험을 찾을 수 없습니다');
        const data = await res.json();
        setTest(data);

        // 시간 설정
        const testType = data.testType || 'default';
        const subject = data.subject?.toLowerCase() || '';
        let timeKey = testType;
        if (testType === 'sat' || testType === 'psat') {
          timeKey = subject.includes('math') ? `${testType}-math` : `${testType}-reading`;
        }
        const minutes = TIME_LIMITS[timeKey] || TIME_LIMITS.default;
        setTimeRemaining(minutes * 60);

        // 저장된 진행 상황 복원
        const saved = localStorage.getItem(getStorageKey(testId));
        if (saved) {
          const { answers: savedAnswers, flagged: savedFlagged, timeRemaining: savedTime, currentQuestion: savedQ } = JSON.parse(saved);
          setAnswers(savedAnswers || {});
          setFlagged(new Set(savedFlagged || []));
          if (savedTime) setTimeRemaining(savedTime);
          if (savedQ !== undefined) setCurrentQuestion(savedQ);
        }

        setIsRunning(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadTest();
  }, [testId]);

  // 타이머
  useEffect(() => {
    if (!isRunning || timeRemaining === null) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          setShowTimeUpModal(true);
          return 0;
        }
        // 5분 남았을 때 경고
        if (prev === 300) setShowTimeWarning(true);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, timeRemaining]);

  // 중간 저장 (10초마다)
  useEffect(() => {
    if (!test) return;

    const saveInterval = setInterval(() => {
      localStorage.setItem(getStorageKey(testId), JSON.stringify({
        answers,
        flagged: Array.from(flagged),
        timeRemaining,
        currentQuestion,
      }));
    }, 10000);

    return () => clearInterval(saveInterval);
  }, [test, answers, flagged, timeRemaining, currentQuestion, testId]);

  // 답 선택
  const selectAnswer = useCallback((questionNum, choice) => {
    setAnswers(prev => ({ ...prev, [questionNum]: choice }));
  }, []);

  // 플래그 토글
  const toggleFlag = useCallback((questionNum) => {
    setFlagged(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionNum)) {
        newSet.delete(questionNum);
      } else {
        newSet.add(questionNum);
      }
      return newSet;
    });
  }, []);

  // 제출
  const handleSubmit = useCallback(() => {
    localStorage.setItem(getStorageKey(testId), JSON.stringify({
      answers,
      flagged: Array.from(flagged),
      submitted: true,
      submittedAt: new Date().toISOString(),
    }));
    router.push(`/test/${testId}/result`);
  }, [answers, flagged, testId, router]);

  // 시간 포맷
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-text-secondary">시험 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-error text-lg mb-4">{error}</p>
          <Link href="/practice-tests" className="text-primary hover:underline">
            ← 테스트 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const questions = test.questions || [];
  const currentQ = questions[currentQuestion];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const hasPassage = currentQ?.passage && currentQ.passage.length > 50;

  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-border-subtle sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/practice-tests" className="text-text-tertiary hover:text-text-secondary">
              ✕
            </Link>
            <div>
              <h1 className="text-ui font-semibold text-text-primary line-clamp-1">{test.name}</h1>
              <p className="text-caption text-text-secondary">
                {answeredCount}/{totalQuestions} 완료
              </p>
            </div>
          </div>

          {/* 타이머 */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg ${
            timeRemaining < 300 ? 'bg-error-light text-error' : 'bg-bg-sidebar text-text-primary'
          }`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(timeRemaining)}
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="btn-primary px-6"
          >
            제출하기
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 flex">
        {/* 지문 (왼쪽) - 데스크톱 */}
        {hasPassage && (
          <div className="hidden lg:block w-1/2 border-r border-border-subtle bg-white overflow-y-auto p-6">
            <div className="prose prose-sm max-w-none">
              <h3 className="text-caption font-semibold text-text-secondary mb-4">지문</h3>
              <div className="whitespace-pre-wrap text-text-primary leading-relaxed">
                {currentQ.passage}
              </div>
            </div>
          </div>
        )}

        {/* 문제 영역 */}
        <div className={`flex-1 overflow-y-auto ${hasPassage ? 'lg:w-1/2' : ''}`}>
          {/* 모바일 탭 (지문 있을 때) */}
          {hasPassage && (
            <div className="lg:hidden sticky top-0 bg-white border-b border-border-subtle flex">
              <button
                onClick={() => setMobileView('passage')}
                className={`flex-1 py-3 text-center text-ui font-medium ${
                  mobileView === 'passage' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'
                }`}
              >
                지문
              </button>
              <button
                onClick={() => setMobileView('question')}
                className={`flex-1 py-3 text-center text-ui font-medium ${
                  mobileView === 'question' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary'
                }`}
              >
                문제
              </button>
            </div>
          )}

          {/* 모바일 지문 뷰 */}
          {hasPassage && mobileView === 'passage' && (
            <div className="lg:hidden p-4 bg-white">
              <div className="whitespace-pre-wrap text-text-primary leading-relaxed">
                {currentQ.passage}
              </div>
            </div>
          )}

          {/* 문제 */}
          {(!hasPassage || mobileView === 'question' || window?.innerWidth >= 1024) && (
            <div className="p-4 lg:p-6">
              <div className="max-w-2xl mx-auto">
                {/* 문제 번호 + 플래그 */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-caption font-semibold text-text-secondary">
                    문제 {currentQ?.number || currentQuestion + 1}
                  </span>
                  <button
                    onClick={() => toggleFlag(currentQ?.number || currentQuestion + 1)}
                    className={`p-2 rounded-lg transition-colors ${
                      flagged.has(currentQ?.number || currentQuestion + 1)
                        ? 'bg-warning-light text-warning'
                        : 'bg-bg-sidebar text-text-tertiary hover:text-warning'
                    }`}
                    title="나중에 다시 볼 문제"
                  >
                    🚩
                  </button>
                </div>

                {/* 문제 텍스트 */}
                <div className="card p-6 mb-6">
                  <p className="text-body text-text-primary whitespace-pre-wrap leading-relaxed">
                    {currentQ?.question}
                  </p>
                </div>

                {/* 선택지 */}
                <div className="space-y-3">
                  {(currentQ?.choices || []).map((choice, idx) => {
                    const choiceNum = idx + 1;
                    const isSelected = answers[currentQ?.number] === choiceNum;

                    return (
                      <button
                        key={idx}
                        onClick={() => selectAnswer(currentQ?.number, choiceNum)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border-subtle hover:border-primary/50 hover:bg-bg-sidebar'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isSelected ? 'border-primary bg-primary' : 'border-border-default'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-body text-text-primary">{choice}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 이전/다음 버튼 */}
                <div className="flex justify-between mt-8">
                  <button
                    onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestion === 0}
                    className="btn-secondary px-6 disabled:opacity-50"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={() => setCurrentQuestion(prev => Math.min(totalQuestions - 1, prev + 1))}
                    disabled={currentQuestion === totalQuestions - 1}
                    className="btn-secondary px-6 disabled:opacity-50"
                  >
                    다음 →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 하단 네비게이션 */}
      <footer className="bg-white border-t border-border-subtle py-3 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {questions.map((q, idx) => {
              const qNum = q.number || idx + 1;
              const isAnswered = answers[qNum] !== undefined;
              const isFlagged = flagged.has(qNum);
              const isCurrent = idx === currentQuestion;

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestion(idx)}
                  className={`w-8 h-8 rounded-lg text-caption font-medium transition-all relative ${
                    isCurrent
                      ? 'bg-primary text-white'
                      : isAnswered
                        ? 'bg-success/20 text-success'
                        : 'bg-bg-sidebar text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {qNum}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 text-xs">🚩</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </footer>

      {/* 제출 확인 모달 */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-heading text-text-primary mb-4">시험을 제출하시겠습니까?</h2>
            <div className="space-y-2 mb-6">
              <p className="text-body text-text-secondary">
                완료: {answeredCount} / {totalQuestions} 문제
              </p>
              {flagged.size > 0 && (
                <p className="text-body text-warning">
                  🚩 표시된 문제: {flagged.size}개
                </p>
              )}
              {answeredCount < totalQuestions && (
                <p className="text-body text-error">
                  ⚠️ {totalQuestions - answeredCount}개 문제가 미완료입니다
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="btn-secondary flex-1"
              >
                계속 풀기
              </button>
              <button
                onClick={handleSubmit}
                className="btn-primary flex-1"
              >
                제출하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 시간 종료 모달 */}
      {showTimeUpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center">
            <div className="text-5xl mb-4">⏰</div>
            <h2 className="text-heading text-text-primary mb-2">시간이 종료되었습니다</h2>
            <p className="text-body text-text-secondary mb-6">
              {answeredCount}개 문제를 완료했습니다.
            </p>
            <button
              onClick={handleSubmit}
              className="btn-primary w-full"
            >
              결과 확인하기
            </button>
          </div>
        </div>
      )}

      {/* 5분 경고 토스트 */}
      {showTimeWarning && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-warning text-white px-6 py-3 rounded-xl shadow-lg z-40 animate-bounce">
          ⏰ 5분 남았습니다!
          <button onClick={() => setShowTimeWarning(false)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
    </div>
  );
}
