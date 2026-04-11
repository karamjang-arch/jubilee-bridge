'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { SUBJECTS } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';

const QUIZ_DURATION = 15 * 60; // 15분 in seconds
const QUESTION_COUNT = 10;

export default function QuizPage() {
  const router = useRouter();
  const { studentId } = useProfile();
  const [phase, setPhase] = useState('setup'); // setup, quiz, results
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(QUIZ_DURATION);
  const [isLoading, setIsLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [savedResult, setSavedResult] = useState(false);
  const timerRef = useRef(null);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'quiz') return;

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

  // Format time
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Load questions for subject
  const startQuiz = async () => {
    if (!selectedSubject) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/quiz-questions?subject=${selectedSubject}&count=${QUESTION_COUNT}`);
      const data = await res.json();

      if (data.questions?.length > 0) {
        setQuestions(data.questions);
        setTimeLeft(QUIZ_DURATION);
        setAnswers({});
        setCurrentIdx(0);
        setSavedResult(false);
        setPhase('quiz');
      } else {
        alert('문제를 불러올 수 없습니다. 다른 과목을 선택해주세요.');
      }
    } catch (error) {
      console.error('Failed to load quiz:', error);
      alert('문제 로드 실패');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle answer
  const handleAnswer = (choice) => {
    setAnswers(prev => ({ ...prev, [currentIdx]: choice }));
  };

  // Check if answer is correct
  const isCorrect = (qIdx, choice) => {
    const q = questions[qIdx];
    if (!q?.answer || !choice) return false;
    const answerLetter = q.answer.toUpperCase().charAt(0);
    return choice.toUpperCase().startsWith(answerLetter + ')');
  };

  // Navigate questions
  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setShowExplanation(false);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      setShowExplanation(false);
    }
  };

  // Finish quiz
  const finishQuiz = () => {
    clearInterval(timerRef.current);
    setPhase('results');
  };

  // Calculate score
  const calculateScore = useCallback(() => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (isCorrect(idx, answers[idx])) correct++;
    });
    return correct;
  }, [questions, answers]);

  // Save quiz result
  const saveQuizResult = useCallback(async () => {
    if (!studentId || savedResult) return;

    const score = calculateScore();
    try {
      await fetch('/api/sheets?tab=quiz_results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student: studentId,
          subject: selectedSubject,
          score,
          total: questions.length,
          percentage: Math.round((score / questions.length) * 100),
          time_used: QUIZ_DURATION - timeLeft,
          completed_at: new Date().toISOString(),
        }),
      });
      setSavedResult(true);
    } catch (error) {
      console.error('Failed to save quiz result:', error);
    }
  }, [studentId, savedResult, calculateScore, selectedSubject, questions.length, timeLeft]);

  // Auto-save when entering results phase
  useEffect(() => {
    if (phase === 'results' && !savedResult) {
      saveQuizResult();
    }
  }, [phase, savedResult, saveQuizResult]);

  // Render Setup Phase
  if (phase === 'setup') {
    return (
      <DashboardLayout showSidebar={false}>
        <div className="p-6 max-w-2xl mx-auto">
          <Link href="/practice-tests" className="text-caption text-text-tertiary hover:text-text-secondary mb-4 inline-block">
            ← 실전 테스트 허브
          </Link>

          <div className="card p-6">
            <h1 className="text-display text-text-primary mb-2">미니 모의고사</h1>
            <p className="text-body text-text-secondary mb-6">
              {QUESTION_COUNT}문제 · {QUIZ_DURATION / 60}분 제한
            </p>

            <div className="mb-6">
              <h2 className="text-subheading text-text-primary mb-3">과목 선택</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SUBJECTS.map(subject => (
                  <button
                    key={subject.id}
                    onClick={() => setSelectedSubject(subject.id)}
                    className={`p-3 rounded-lg border-2 transition-all text-center ${
                      selectedSubject === subject.id
                        ? 'border-current text-white'
                        : 'border-border-subtle bg-bg-sidebar hover:border-border-strong'
                    }`}
                    style={selectedSubject === subject.id ? {
                      backgroundColor: `var(${subject.cssVar})`,
                      borderColor: `var(${subject.cssVar})`
                    } : {}}
                  >
                    <div className="text-ui font-medium" style={selectedSubject !== subject.id ? {
                      color: `var(${subject.cssVar})`
                    } : {}}>
                      {subject.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-info-light rounded-lg mb-6">
              <div className="flex gap-3">
                <span className="text-xl">⏱️</span>
                <div className="text-caption text-text-secondary">
                  <strong>규칙:</strong> {QUIZ_DURATION / 60}분 안에 {QUESTION_COUNT}문제를 풉니다.
                  시간이 끝나면 자동 제출됩니다.
                </div>
              </div>
            </div>

            <button
              onClick={startQuiz}
              disabled={!selectedSubject || isLoading}
              className={`w-full py-3 rounded-lg text-ui font-semibold transition-all ${
                selectedSubject && !isLoading
                  ? 'bg-subj-math text-white hover:bg-subj-math-dark'
                  : 'bg-bg-hover text-text-disabled cursor-not-allowed'
              }`}
            >
              {isLoading ? '문제 로드 중...' : '시작하기'}
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Render Quiz Phase
  if (phase === 'quiz') {
    const currentQ = questions[currentIdx];
    const subject = SUBJECTS.find(s => s.id === selectedSubject);
    const answeredCount = Object.keys(answers).length;
    const userAnswer = answers[currentIdx];
    const isAnswered = userAnswer !== undefined;

    return (
      <DashboardLayout showSidebar={false}>
        <div className="min-h-screen flex flex-col">
          {/* Timer Bar */}
          <div className="sticky top-0 bg-bg-card border-b border-border-subtle z-10">
            <div className="p-4 max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-ui font-medium" style={{ color: `var(${subject?.cssVar})` }}>
                  {subject?.name} 모의고사
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

            {/* Progress bar */}
            <div className="h-1 bg-bg-hover">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(answeredCount / questions.length) * 100}%`,
                  backgroundColor: `var(${subject?.cssVar})`
                }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-caption text-text-tertiary">
                문제 {currentIdx + 1} / {questions.length}
              </span>
              {currentQ.concept_id && (
                <span className="px-2 py-1 bg-bg-sidebar rounded text-xs text-text-tertiary">
                  {currentQ.cluster}
                </span>
              )}
            </div>

            <div className="card p-6 mb-6">
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
                      userAnswer === choice
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
                className="px-4 py-2 rounded-lg text-ui bg-bg-sidebar text-text-secondary hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← 이전
              </button>

              <div className="flex gap-1">
                {questions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setCurrentIdx(idx); setShowExplanation(false); }}
                    className={`w-8 h-8 rounded-full text-caption transition-all ${
                      idx === currentIdx
                        ? 'text-white'
                        : answers[idx] !== undefined
                          ? 'bg-subj-math-light text-subj-math'
                          : 'bg-bg-sidebar text-text-tertiary hover:bg-bg-hover'
                    }`}
                    style={idx === currentIdx ? { backgroundColor: `var(${subject?.cssVar})` } : {}}
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
                  onClick={finishQuiz}
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

  // Render Results Phase
  if (phase === 'results') {
    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);
    const subject = SUBJECTS.find(s => s.id === selectedSubject);

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
              {percentage >= 70 ? '훌륭해요!' : percentage >= 50 ? '조금 더 노력해요!' : '복습이 필요해요'}
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
                      correct ? 'bg-success' : 'bg-red-500'
                    }`}>
                      {correct ? '✓' : '✗'}
                    </span>
                    <div className="flex-1">
                      <div className="text-caption text-text-tertiary mb-1">
                        문제 {idx + 1} · {q.cluster}
                      </div>
                      <div className="text-body text-text-primary">
                        {q.question}
                      </div>
                    </div>
                  </div>

                  <div className="ml-11 space-y-2">
                    {q.choices?.map((choice, cIdx) => {
                      const isUserChoice = userAnswer === choice;
                      const isCorrectChoice = choice.toUpperCase().startsWith(q.answer.toUpperCase().charAt(0) + ')');

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
                          {isUserChoice && !isCorrectChoice && ' (선택)'}
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
                setPhase('setup');
                setQuestions([]);
                setAnswers({});
                setSavedResult(false);
              }}
              className="flex-1 py-3 rounded-lg text-ui font-semibold bg-bg-sidebar text-text-secondary hover:bg-bg-hover"
            >
              다시 시작
            </button>
            <Link
              href="/practice-tests"
              className="flex-1 py-3 rounded-lg text-ui font-semibold bg-subj-math text-white hover:bg-subj-math-dark text-center"
            >
              돌아가기
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return null;
}
