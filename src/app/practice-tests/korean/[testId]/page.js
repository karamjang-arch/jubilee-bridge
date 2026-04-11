'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';

export default function KoreanTestPage() {
  const params = useParams();
  const router = useRouter();
  const [test, setTest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  // Time limits by subject (in seconds)
  const TIME_LIMITS = {
    '국어': 80 * 60,
    '수학': 100 * 60,
    '영어': 70 * 60,
  };

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const res = await fetch(`/api/korean-tests?id=${params.testId}`);
        if (!res.ok) throw new Error('Test not found');
        const data = await res.json();
        setTest(data);

        // Set time limit based on subject
        const limit = TIME_LIMITS[data.subject] || 60 * 60;
        setTimeLeft(limit);
      } catch (error) {
        console.error('Failed to load test:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTest();
  }, [params.testId]);

  // Timer
  useEffect(() => {
    if (timeLeft === null || showResults) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setShowResults(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft, showResults]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (answer) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: answer }));
  };

  const calculateScore = () => {
    if (!test?.questions) return { correct: 0, total: 0 };
    let correct = 0;
    test.questions.forEach((q, idx) => {
      const userAnswer = answers[idx];
      if (userAnswer && String(userAnswer) === String(q.answer)) {
        correct++;
      }
    });
    return { correct, total: test.questions.length };
  };

  if (isLoading) {
    return (
      <DashboardLayout showSidebar={false}>
        <div className="p-6 max-w-4xl mx-auto text-center text-text-tertiary">
          로딩 중...
        </div>
      </DashboardLayout>
    );
  }

  if (!test) {
    return (
      <DashboardLayout showSidebar={false}>
        <div className="p-6 max-w-4xl mx-auto text-center">
          <p className="text-text-tertiary mb-4">시험을 찾을 수 없습니다.</p>
          <Link href="/practice-tests/korean" className="text-subj-english">
            목록으로 돌아가기
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const questions = test.questions || [];
  const currentQ = questions[currentQuestion];

  // Results view
  if (showResults) {
    const { correct, total } = calculateScore();
    const percentage = Math.round((correct / total) * 100);

    return (
      <DashboardLayout showSidebar={false}>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="card p-8 text-center">
            <h1 className="text-display text-text-primary mb-4">결과</h1>
            <div className="text-6xl font-bold text-subj-math mb-2">
              {correct} / {total}
            </div>
            <div className="text-heading text-text-secondary mb-6">
              {percentage}% 정답
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowResults(false);
                  setCurrentQuestion(0);
                  setAnswers({});
                  setTimeLeft(TIME_LIMITS[test.subject] || 60 * 60);
                }}
                className="px-6 py-3 bg-subj-english text-white rounded-lg hover:opacity-90"
              >
                다시 풀기
              </button>
              <Link
                href="/practice-tests/korean"
                className="px-6 py-3 bg-bg-sidebar text-text-primary rounded-lg hover:bg-bg-hover"
              >
                목록으로
              </Link>
            </div>

            {/* Question review */}
            <div className="mt-8 text-left">
              <h3 className="text-heading text-text-primary mb-4">문항별 결과</h3>
              <div className="grid grid-cols-10 gap-2">
                {questions.map((q, idx) => {
                  const userAnswer = answers[idx];
                  const isCorrect = userAnswer && String(userAnswer) === String(q.answer);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentQuestion(idx);
                        setShowResults(false);
                      }}
                      className={`w-8 h-8 rounded text-sm font-medium ${
                        isCorrect
                          ? 'bg-success text-white'
                          : userAnswer
                          ? 'bg-error text-white'
                          : 'bg-bg-sidebar text-text-tertiary'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/practice-tests/korean" className="text-caption text-text-tertiary hover:text-text-secondary">
            ← 목록
          </Link>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            timeLeft < 300 ? 'bg-error text-white animate-pulse' : 'bg-bg-sidebar text-text-primary'
          }`}>
            {formatTime(timeLeft || 0)}
          </div>
        </div>

        <div className="mb-4">
          <h1 className="text-heading text-text-primary">{test.name}</h1>
          <p className="text-caption text-text-tertiary">
            문항 {currentQuestion + 1} / {questions.length}
          </p>
        </div>

        {/* Question */}
        <div className="card p-6 mb-6">
          {/* Passage */}
          {currentQ?.passage && (
            <div className="mb-6 p-4 bg-bg-sidebar rounded-lg">
              <div className="text-caption text-text-tertiary mb-2">[지문]</div>
              <div className="text-body text-text-secondary whitespace-pre-wrap leading-relaxed">
                {currentQ.passage}
              </div>
            </div>
          )}

          {/* Question text */}
          <div className="mb-6">
            <div className="text-subheading text-text-primary mb-2">
              {currentQuestion + 1}. {currentQ?.question}
            </div>
            {currentQ?.skill && (
              <span className="px-2 py-0.5 bg-bg-hover rounded text-xs text-text-tertiary">
                {currentQ.skill}
              </span>
            )}
          </div>

          {/* Choices */}
          {currentQ?.choices ? (
            <div className="space-y-3">
              {currentQ.choices.map((choice, idx) => {
                const choiceNum = idx + 1;
                const isSelected = answers[currentQuestion] === choiceNum;
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(choiceNum)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-subj-english bg-subj-english-light'
                        : 'border-border-subtle hover:border-text-tertiary hover:bg-bg-hover'
                    }`}
                  >
                    <span className="text-body text-text-primary">{choice}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Short answer for math */
            <div>
              <input
                type="text"
                value={answers[currentQuestion] || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="답을 입력하세요"
                className="w-full p-4 rounded-lg border border-border-subtle bg-bg-card text-text-primary focus:border-subj-math focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            className="px-4 py-2 bg-bg-sidebar text-text-primary rounded-lg disabled:opacity-50"
          >
            이전
          </button>

          {/* Question navigator */}
          <div className="flex gap-1 flex-wrap justify-center max-w-md">
            {questions.slice(0, 20).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-6 h-6 text-xs rounded ${
                  idx === currentQuestion
                    ? 'bg-subj-english text-white'
                    : answers[idx]
                    ? 'bg-success-light text-success'
                    : 'bg-bg-sidebar text-text-tertiary'
                }`}
              >
                {idx + 1}
              </button>
            ))}
            {questions.length > 20 && (
              <span className="text-text-tertiary text-xs">...</span>
            )}
          </div>

          {currentQuestion === questions.length - 1 ? (
            <button
              onClick={() => setShowResults(true)}
              className="px-4 py-2 bg-success text-white rounded-lg hover:opacity-90"
            >
              제출
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestion(prev => Math.min(questions.length - 1, prev + 1))}
              className="px-4 py-2 bg-subj-english text-white rounded-lg hover:opacity-90"
            >
              다음
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
