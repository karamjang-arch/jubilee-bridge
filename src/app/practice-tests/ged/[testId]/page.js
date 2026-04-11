'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useProfile } from '@/hooks/useProfile';

// 과목별 시험 시간 (분)
const SUBJECT_TIME_LIMITS = {
  '국어': 40,
  '영어': 40,
  '수학': 50,
  '사회': 40,
  '과학': 40,
  '한국사': 40,
  '도덕': 40,
};

export default function GEDTestPage() {
  const { testId } = useParams();
  const router = useRouter();
  const { studentId } = useProfile();

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(true);

  useEffect(() => {
    fetch(`/api/ged-tests?id=${testId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error('Test not found');
          return;
        }
        setTest(data);
        const timeLimit = SUBJECT_TIME_LIMITS[data.subject] || 40;
        setTimeLeft(timeLimit * 60);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load test:', err);
        setLoading(false);
      });
  }, [testId]);

  // Timer
  useEffect(() => {
    if (!timerActive || timeLeft <= 0 || submitted) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timerActive, timeLeft, submitted]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleAnswer = (questionNum, answer) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionNum]: answer }));
  };

  const handleSubmit = () => {
    if (submitted || !test) return;

    let correct = 0;
    test.questions.forEach(q => {
      const userAnswer = answers[q.number];
      if (userAnswer && userAnswer === q.answer) {
        correct++;
      }
    });

    const scoreValue = Math.round((correct / test.questions.length) * 100);
    setScore({ correct, total: test.questions.length, percentage: scoreValue });
    setSubmitted(true);
    setTimerActive(false);
  };

  const startTest = () => {
    setTimerActive(true);
  };

  // Record to concept_history when test completes
  useEffect(() => {
    if (!submitted || !score || !test) return;

    const timeLimit = (SUBJECT_TIME_LIMITS[test.subject] || 40) * 60;
    const durationSec = timeLimit - (timeLeft || 0);

    // Map Korean subject to code
    const subjectMap = {
      '국어': 'korean',
      '영어': 'english',
      '수학': 'math',
      '사회': 'social',
      '과학': 'science',
      '한국사': 'history',
      '도덕': 'ethics'
    };

    fetch('/api/concept-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId || 'anonymous',
        event_type: 'test_complete',
        curriculum: 'kr',
        subject: subjectMap[test.subject] || test.subject,
        concept_id: `GED-${test.level?.toUpperCase() || 'MID'}-${test.subject}`,
        score: score.percentage,
        duration_sec: durationSec,
        detail: {
          testId,
          testName: test.name,
          level: test.level,
          year: test.year,
          round: test.round,
          subject: test.subject,
          correct: score.correct,
          total: score.total,
          passed: score.percentage >= 60
        }
      })
    }).catch(err => console.error('Failed to record test history:', err));
  }, [submitted, score, test, testId, timeLeft, studentId]);

  if (loading) {
    return (
      <DashboardLayout showSidebar={false}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-border-subtle border-t-text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!test) {
    return (
      <DashboardLayout showSidebar={false}>
        <div className="p-6 text-center">
          <h1 className="text-heading text-text-primary mb-4">시험을 찾을 수 없습니다</h1>
          <Link href="/practice-tests/ged" className="text-info hover:underline">
            목록으로 돌아가기
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout showSidebar={false}>
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href="/practice-tests/ged" className="text-caption text-text-tertiary hover:text-text-secondary mb-2 inline-block">
            ← 검정고시 목록
          </Link>
          <h1 className="text-heading text-text-primary">{test.name}</h1>
          <p className="text-body text-text-secondary mt-1">
            {test.totalQuestions}문제 · {SUBJECT_TIME_LIMITS[test.subject] || 40}분
          </p>
        </div>

        {/* 상태 바 */}
        <div className="sticky top-0 z-10 bg-bg-card border border-border-subtle rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* 타이머 */}
            <div className="flex items-center gap-4">
              {timerActive && !submitted && (
                <div className={`text-xl font-mono ${timeLeft < 300 ? 'text-red-500' : 'text-text-primary'}`}>
                  {formatTime(timeLeft)}
                </div>
              )}
              {!timerActive && !submitted && (
                <button
                  onClick={startTest}
                  className="px-4 py-2 bg-info text-white rounded-lg hover:opacity-90"
                >
                  시작하기
                </button>
              )}
            </div>

            {/* 진행 상황 */}
            <div className="text-caption text-text-secondary">
              {Object.keys(answers).length} / {test.totalQuestions} 답변
            </div>

            {/* 제출 버튼 */}
            {!submitted && timerActive && (
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-text-primary text-bg-card rounded-lg hover:opacity-90"
              >
                제출하기
              </button>
            )}
          </div>
        </div>

        {/* 점수 카드 */}
        {submitted && score && (
          <div className={`p-6 rounded-lg mb-6 ${score.percentage >= 60 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2" style={{ color: score.percentage >= 60 ? '#10b981' : '#ef4444' }}>
                {score.percentage}점
              </div>
              <div className="text-body text-text-secondary">
                {score.correct} / {score.total} 정답 · {score.percentage >= 60 ? '합격' : '불합격'}
              </div>
            </div>
          </div>
        )}

        {/* 문제 목록 */}
        <div className="space-y-6">
          {test.questions.map((q, idx) => {
            const userAnswer = answers[q.number];
            const isCorrect = submitted && userAnswer === q.answer;
            const isWrong = submitted && userAnswer && userAnswer !== q.answer;

            return (
              <div
                key={idx}
                className={`card p-5 ${isCorrect ? 'border-green-300 bg-green-50/30' : isWrong ? 'border-red-300 bg-red-50/30' : ''}`}
              >
                {/* 문제 번호와 텍스트 */}
                <div className="flex gap-3 mb-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-bg-sidebar flex items-center justify-center text-subheading font-medium text-text-primary">
                    {q.number}
                  </span>
                  <div className="flex-1">
                    <p className="text-body text-text-primary whitespace-pre-wrap">{q.question}</p>
                  </div>
                </div>

                {/* 보기 */}
                {q.choices && q.choices.length > 0 && (
                  <div className="space-y-2 ml-11">
                    {q.choices.map((choice, choiceIdx) => {
                      const choiceNum = String(choiceIdx + 1);
                      const isSelected = userAnswer === choiceNum;
                      const isAnswer = q.answer === choiceNum;

                      let choiceClass = 'border-border-subtle hover:border-text-tertiary';
                      if (submitted) {
                        if (isAnswer) choiceClass = 'border-green-400 bg-green-50';
                        else if (isSelected && !isAnswer) choiceClass = 'border-red-400 bg-red-50';
                      } else if (isSelected) {
                        choiceClass = 'border-info bg-info-light';
                      }

                      return (
                        <button
                          key={choiceIdx}
                          onClick={() => handleAnswer(q.number, choiceNum)}
                          disabled={submitted || !timerActive}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${choiceClass} ${!timerActive && !submitted ? 'opacity-60' : ''}`}
                        >
                          <span className="text-caption text-text-primary">{choice}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 정답 표시 */}
                {submitted && (
                  <div className="mt-4 ml-11 text-caption">
                    <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                      {isCorrect ? '✓ 정답' : `✗ 정답: ${q.answer}번`}
                    </span>
                    {q.skill && (
                      <span className="ml-3 text-text-tertiary">· {q.skill}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 하단 버튼 */}
        <div className="mt-8 flex justify-center gap-4">
          {submitted && (
            <>
              <button
                onClick={() => {
                  setAnswers({});
                  setSubmitted(false);
                  setScore(null);
                  setTimeLeft((SUBJECT_TIME_LIMITS[test.subject] || 40) * 60);
                }}
                className="px-6 py-3 border border-border-subtle rounded-lg text-text-secondary hover:bg-bg-sidebar"
              >
                다시 풀기
              </button>
              <Link
                href="/practice-tests/ged"
                className="px-6 py-3 bg-text-primary text-bg-card rounded-lg hover:opacity-90"
              >
                목록으로
              </Link>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
