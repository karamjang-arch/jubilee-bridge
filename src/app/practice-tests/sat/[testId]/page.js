'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useProfile } from '@/hooks/useProfile';

// Section time limits (in seconds)
const TIME_LIMITS = {
  rw: 32 * 60, // 32 minutes for R&W module
  math: 35 * 60, // 35 minutes for Math module
};

export default function SATTestPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { studentId } = useProfile();

  const testId = params.testId;
  const section = searchParams.get('section') || 'rw';
  const module = searchParams.get('module') || '1';

  const [phase, setPhase] = useState('loading'); // loading, ready, test, results
  const [testData, setTestData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(TIME_LIMITS[section]);
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const timerRef = useRef(null);

  // Load test data
  useEffect(() => {
    const fetchTest = async () => {
      try {
        const res = await fetch(`/api/sat-tests?id=${testId}&section=${section}&module=${module}`);
        const data = await res.json();

        if (data.error) {
          console.error(data.error);
          setPhase('error');
          return;
        }

        setTestData(data);
        setQuestions(data.questions || []);
        setTimeLeft(TIME_LIMITS[section]);
        setPhase('ready');
      } catch (error) {
        console.error('Failed to load test:', error);
        setPhase('error');
      }
    };

    fetchTest();
  }, [testId, section, module]);

  // Timer
  useEffect(() => {
    if (phase !== 'test') return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setPhase('results');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [phase]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startTest = () => {
    setPhase('test');
    setAnswers({});
    setCurrentIdx(0);
    setMarkedForReview(new Set());
  };

  const handleAnswer = (choice) => {
    setAnswers(prev => ({ ...prev, [currentIdx]: choice }));
  };

  const toggleReview = () => {
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(currentIdx)) {
        next.delete(currentIdx);
      } else {
        next.add(currentIdx);
      }
      return next;
    });
  };

  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
    }
  };

  const finishTest = () => {
    clearInterval(timerRef.current);
    setPhase('results');
  };

  const isCorrect = useCallback((qIdx, choice) => {
    const q = questions[qIdx];
    if (!q?.answer || !choice) return false;
    const answerLetter = q.answer.toUpperCase().charAt(0);
    return choice.toUpperCase().startsWith(answerLetter + ')');
  }, [questions]);

  const calculateScore = useCallback(() => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (isCorrect(idx, answers[idx])) correct++;
    });
    return correct;
  }, [questions, answers, isCorrect]);

  // Record to concept_history when test completes
  useEffect(() => {
    if (phase !== 'results' || questions.length === 0) return;

    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);
    const durationSec = TIME_LIMITS[section] - timeLeft;

    // Record test completion
    fetch('/api/concept-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId || 'anonymous',
        event_type: 'test_complete',
        curriculum: 'us',
        subject: section === 'rw' ? 'english' : 'math',
        concept_id: `SAT-${section.toUpperCase()}-M${module}`,
        score: percentage,
        duration_sec: durationSec,
        detail: {
          testId,
          testName: testData?.testName,
          section,
          module: parseInt(module),
          correct: score,
          total: questions.length,
          timeUsedSec: durationSec
        }
      })
    }).catch(err => console.error('Failed to record test history:', err));
  }, [phase, questions.length, calculateScore, timeLeft, section, module, testId, testData, studentId]);

  // Loading state
  if (phase === 'loading') {
    return (
      <DashboardLayout showSidebar={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-text-tertiary">모의고사 로딩 중...</div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (phase === 'error') {
    return (
      <DashboardLayout showSidebar={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-4">모의고사를 불러올 수 없습니다.</div>
            <Link href="/practice-tests/sat" className="text-subj-math">← 목록으로</Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Ready state
  if (phase === 'ready') {
    const sectionName = section === 'rw' ? 'Reading & Writing' : 'Math';
    const timeMinutes = TIME_LIMITS[section] / 60;

    return (
      <DashboardLayout showSidebar={false}>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="card p-8 max-w-lg w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-subj-math-light flex items-center justify-center">
              <span className="text-4xl">{section === 'rw' ? '📖' : '🔢'}</span>
            </div>

            <h1 className="text-display text-text-primary mb-2">{testData?.testName}</h1>
            <p className="text-heading text-text-secondary mb-4">
              {sectionName} Module {module}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6 text-center">
              <div className="p-4 bg-bg-sidebar rounded-lg">
                <div className="text-stat text-text-primary">{questions.length}</div>
                <div className="text-caption text-text-tertiary">문제</div>
              </div>
              <div className="p-4 bg-bg-sidebar rounded-lg">
                <div className="text-stat text-text-primary">{timeMinutes}</div>
                <div className="text-caption text-text-tertiary">분</div>
              </div>
            </div>

            <div className="p-4 bg-warning-light rounded-lg mb-6 text-left">
              <div className="text-caption text-text-secondary">
                <strong>주의사항:</strong>
                <ul className="mt-2 space-y-1">
                  <li>• 시간이 종료되면 자동 제출됩니다</li>
                  <li>• 문제를 건너뛸 수 있습니다</li>
                  <li>• 나중에 복습할 문제에 표시할 수 있습니다</li>
                </ul>
              </div>
            </div>

            <button
              onClick={startTest}
              className="w-full py-3 rounded-lg text-ui font-semibold bg-subj-math text-white hover:bg-subj-math-dark"
            >
              시험 시작
            </button>

            <Link href="/practice-tests/sat" className="block mt-4 text-caption text-text-tertiary hover:text-text-secondary">
              ← 다른 시험 선택
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Test state
  if (phase === 'test') {
    const currentQ = questions[currentIdx];
    const answeredCount = Object.keys(answers).length;
    const sectionColor = section === 'rw' ? 'var(--subj-english)' : 'var(--subj-math)';

    return (
      <DashboardLayout showSidebar={false}>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-bg-card border-b border-border-subtle z-10">
            <div className="p-4 max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-ui font-medium" style={{ color: sectionColor }}>
                  {section === 'rw' ? 'Reading & Writing' : 'Math'} M{module}
                </span>
                <span className="text-caption text-text-tertiary">
                  {answeredCount}/{questions.length} 응답
                </span>
              </div>

              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-heading ${
                timeLeft < 60 ? 'bg-red-50 text-red-600' : 'bg-bg-sidebar text-text-primary'
              }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="h-1 bg-bg-hover">
              <div
                className="h-full transition-all"
                style={{ width: `${(answeredCount / questions.length) * 100}%`, backgroundColor: sectionColor }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-caption text-text-tertiary">
                문제 {currentIdx + 1} / {questions.length}
              </span>
              <div className="flex items-center gap-2">
                {currentQ.skill && (
                  <span className="px-2 py-1 bg-bg-sidebar rounded text-xs text-text-tertiary">
                    {currentQ.skill}
                  </span>
                )}
                <button
                  onClick={toggleReview}
                  className={`px-2 py-1 rounded text-xs ${
                    markedForReview.has(currentIdx)
                      ? 'bg-warning-light text-warning'
                      : 'bg-bg-sidebar text-text-tertiary'
                  }`}
                >
                  {markedForReview.has(currentIdx) ? '📌 표시됨' : '📌 복습 표시'}
                </button>
              </div>
            </div>

            <div className="card p-6 mb-6">
              {/* Passage if present */}
              {currentQ.passage && (
                <div className="mb-4 p-4 bg-bg-sidebar rounded-lg text-body text-text-secondary italic">
                  {currentQ.passage}
                </div>
              )}

              {/* Question text */}
              <div className="text-body text-text-primary mb-6 whitespace-pre-wrap">
                {currentQ.question}
              </div>

              {/* Choices */}
              <div className="space-y-3">
                {currentQ.choices?.map((choice, cIdx) => (
                  <button
                    key={cIdx}
                    onClick={() => handleAnswer(choice)}
                    className={`w-full p-4 text-left rounded-lg transition-all border-2 ${
                      answers[currentIdx] === choice
                        ? 'border-subj-math bg-subj-math-light'
                        : 'border-border-subtle bg-bg-sidebar hover:border-border-strong'
                    }`}
                  >
                    <span className="text-body text-text-primary">{choice}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={goPrev}
                disabled={currentIdx === 0}
                className="px-4 py-2 rounded-lg text-ui bg-bg-sidebar text-text-secondary hover:bg-bg-hover disabled:opacity-50"
              >
                ← 이전
              </button>

              <div className="flex gap-1 flex-wrap justify-center max-w-md">
                {questions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-8 h-8 rounded text-caption transition-all ${
                      idx === currentIdx
                        ? 'text-white'
                        : markedForReview.has(idx)
                          ? 'bg-warning-light text-warning'
                          : answers[idx] !== undefined
                            ? 'bg-subj-math-light text-subj-math'
                            : 'bg-bg-sidebar text-text-tertiary hover:bg-bg-hover'
                    }`}
                    style={idx === currentIdx ? { backgroundColor: sectionColor } : {}}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              {currentIdx < questions.length - 1 ? (
                <button
                  onClick={goNext}
                  className="px-4 py-2 rounded-lg text-ui bg-bg-sidebar text-text-secondary hover:bg-bg-hover"
                >
                  다음 →
                </button>
              ) : (
                <button
                  onClick={finishTest}
                  className="px-4 py-2 rounded-lg text-ui bg-subj-math text-white hover:bg-subj-math-dark"
                >
                  제출하기
                </button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Results state
  if (phase === 'results') {
    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);
    const sectionName = section === 'rw' ? 'Reading & Writing' : 'Math';

    return (
      <DashboardLayout showSidebar={false}>
        <div className="p-6 max-w-3xl mx-auto">
          {/* Score Card */}
          <div className="card p-6 text-center mb-6">
            <div className={`w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center ${
              percentage >= 70 ? 'bg-success-light' : percentage >= 50 ? 'bg-warning-light' : 'bg-red-50'
            }`}>
              <span className="text-4xl">
                {percentage >= 70 ? '🎉' : percentage >= 50 ? '💪' : '📚'}
              </span>
            </div>

            <h1 className="text-display text-text-primary mb-2">
              {score} / {questions.length}
            </h1>
            <p className={`text-heading font-bold ${
              percentage >= 70 ? 'text-success' : percentage >= 50 ? 'text-warning' : 'text-red-500'
            }`}>
              {percentage}%
            </p>
            <p className="text-body text-text-secondary mt-2">
              {testData?.testName} · {sectionName} Module {module}
            </p>
          </div>

          {/* Review Questions */}
          <h2 className="text-heading text-text-primary mb-4">문제 리뷰</h2>
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const userAnswer = answers[idx];
              const correct = isCorrect(idx, userAnswer);

              return (
                <div key={idx} className="card p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-caption flex-shrink-0 ${
                      correct ? 'bg-success' : userAnswer ? 'bg-red-500' : 'bg-gray-400'
                    }`}>
                      {correct ? '✓' : userAnswer ? '✗' : '−'}
                    </span>
                    <div className="flex-1">
                      <div className="text-caption text-text-tertiary mb-1">
                        문제 {idx + 1} · {q.skill || 'General'}
                      </div>
                      <div className="text-body text-text-primary line-clamp-2">
                        {q.question}
                      </div>
                    </div>
                  </div>

                  <div className="ml-11 space-y-2">
                    {q.choices?.map((choice, cIdx) => {
                      const isUserChoice = userAnswer === choice;
                      const isCorrectChoice = choice.toUpperCase().startsWith(q.answer?.toUpperCase().charAt(0) + ')');

                      return (
                        <div
                          key={cIdx}
                          className={`p-2 rounded-lg text-caption ${
                            isCorrectChoice
                              ? 'bg-success-light text-success'
                              : isUserChoice && !isCorrectChoice
                                ? 'bg-red-50 text-red-600 line-through'
                                : 'text-text-secondary'
                          }`}
                        >
                          {choice}
                          {isCorrectChoice && ' ✓'}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="ml-11 mt-3 p-3 bg-info-light rounded-lg">
                      <div className="text-caption text-text-secondary">
                        <strong>해설:</strong> {q.explanation}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => {
                setPhase('ready');
                setAnswers({});
                setTimeLeft(TIME_LIMITS[section]);
              }}
              className="flex-1 py-3 rounded-lg text-ui font-semibold bg-bg-sidebar text-text-secondary hover:bg-bg-hover"
            >
              다시 풀기
            </button>
            <Link
              href="/practice-tests/sat"
              className="flex-1 py-3 rounded-lg text-ui font-semibold bg-subj-math text-white hover:bg-subj-math-dark text-center"
            >
              다른 시험
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return null;
}
