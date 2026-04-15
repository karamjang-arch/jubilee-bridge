'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MathRenderer from '@/components/MathRenderer';

const getStorageKey = (testId) => `test_progress_${testId}`;

export default function TestReviewPage() {
  const params = useParams();
  const testId = params.test_id;

  const [test, setTest] = useState(null);
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showTutor, setShowTutor] = useState(false);
  const [tutorResponse, setTutorResponse] = useState('');
  const [tutorLoading, setTutorLoading] = useState(false);

  useEffect(() => {
    async function loadReview() {
      try {
        const res = await fetch(`/tests/json/${testId}.json`);
        if (!res.ok) throw new Error('시험을 찾을 수 없습니다');
        const testData = await res.json();
        setTest(testData);

        const saved = localStorage.getItem(getStorageKey(testId));
        if (!saved) throw new Error('제출된 답안이 없습니다');
        const progressData = JSON.parse(saved);
        const answers = progressData.answers || {};

        // 틀린 문제 필터링
        const wrong = (testData.questions || [])
          .map((q) => {
            const userAnswer = answers[q.number];
            const correctAnswer = q.answer ? parseInt(q.answer) : null;

            if (correctAnswer !== null && userAnswer !== correctAnswer) {
              return {
                ...q,
                userAnswer,
                correctAnswer,
              };
            }
            return null;
          })
          .filter(Boolean);

        setWrongQuestions(wrong);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadReview();
  }, [testId]);

  // Gemini 튜터 호출 (C-6)
  const askTutor = async () => {
    if (!wrongQuestions[currentIndex]) return;

    setTutorLoading(true);
    setShowTutor(true);
    setTutorResponse('');

    const q = wrongQuestions[currentIndex];

    try {
      const res = await fetch('/api/tutor/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.question,
          choices: q.choices,
          userAnswer: q.userAnswer,
          correctAnswer: q.correctAnswer,
          skill: q.skill,
          passage: q.passage,
        }),
      });

      if (!res.ok) throw new Error('튜터 응답 실패');

      const data = await res.json();
      setTutorResponse(data.explanation || '해설을 불러올 수 없습니다.');

    } catch (err) {
      setTutorResponse('튜터 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setTutorLoading(false);
    }
  };

  // 다음/이전 문제
  const goNext = () => {
    if (currentIndex < wrongQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setShowTutor(false);
      setTutorResponse('');
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
      setShowTutor(false);
      setTutorResponse('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
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

  if (wrongQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-heading text-text-primary mb-2">완벽합니다!</h2>
          <p className="text-body text-text-secondary mb-6">틀린 문제가 없습니다.</p>
          <Link href={`/test/${testId}/result`} className="btn-primary">
            결과로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const currentQ = wrongQuestions[currentIndex];

  return (
    <div className="min-h-screen bg-bg-page">
      {/* 헤더 */}
      <header className="bg-white border-b border-border-subtle sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href={`/test/${testId}/result`} className="text-caption text-text-tertiary hover:text-text-secondary">
                ← 결과로 돌아가기
              </Link>
              <h1 className="text-heading text-text-primary">오답 복습</h1>
            </div>
            <div className="text-ui font-medium text-text-secondary">
              {currentIndex + 1} / {wrongQuestions.length}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 문제 카드 */}
        <div className="card p-6 mb-6">
          {/* 문제 번호 + 스킬 */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-caption font-semibold text-text-secondary">
              문제 {currentQ.number}
            </span>
            {currentQ.skill && (
              <span className="px-3 py-1 bg-primary/10 text-primary text-caption rounded-full">
                {currentQ.skill}
              </span>
            )}
          </div>

          {/* 지문 (있으면) */}
          {currentQ.passage && (
            <div className="mb-6 p-4 bg-bg-sidebar rounded-lg">
              <h4 className="text-caption font-semibold text-text-secondary mb-2">지문</h4>
              <p className="text-body text-text-primary whitespace-pre-wrap leading-relaxed">
                {currentQ.passage}
              </p>
            </div>
          )}

          {/* 문제 */}
          <MathRenderer
            text={currentQ.question}
            as="div"
            className="text-body text-text-primary leading-relaxed mb-6"
          />

          {/* 선택지 */}
          <div className="space-y-3">
            {(currentQ.choices || []).map((choice, idx) => {
              const choiceNum = idx + 1;
              const isUserAnswer = currentQ.userAnswer === choiceNum;
              const isCorrect = currentQ.correctAnswer === choiceNum;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border-2 ${
                    showAnswer
                      ? isCorrect
                        ? 'border-success bg-success/10'
                        : isUserAnswer
                          ? 'border-error bg-error/10'
                          : 'border-border-subtle'
                      : isUserAnswer
                        ? 'border-error bg-error/5'
                        : 'border-border-subtle'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      showAnswer && isCorrect
                        ? 'bg-success text-white'
                        : isUserAnswer
                          ? 'bg-error text-white'
                          : 'bg-bg-sidebar'
                    }`}>
                      {showAnswer && isCorrect ? '✓' : isUserAnswer ? '✗' : ''}
                    </div>
                    <MathRenderer text={choice} className="text-body text-text-primary" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 정답 보기 버튼 */}
        {!showAnswer && (
          <button
            onClick={() => setShowAnswer(true)}
            className="w-full btn-secondary py-3 mb-4"
          >
            정답 보기
          </button>
        )}

        {/* 정답 표시 후 해설 */}
        {showAnswer && (
          <div className="space-y-4 mb-6">
            {/* 기본 해설 (JSON에 있으면) */}
            {currentQ.explanation && (
              <div className="card p-4 bg-info-light">
                <h4 className="text-caption font-semibold text-info mb-2">해설</h4>
                <MathRenderer text={currentQ.explanation} as="div" className="text-body text-text-primary" />
              </div>
            )}

            {/* Gemini 튜터 버튼 (C-6) */}
            {!showTutor && (
              <button
                onClick={askTutor}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2"
              >
                <span>🤖</span>
                AI 튜터에게 설명 요청
              </button>
            )}

            {/* 튜터 응답 */}
            {showTutor && (
              <div className="card p-4 border-2 border-primary/20">
                <h4 className="text-caption font-semibold text-primary mb-2 flex items-center gap-2">
                  🤖 AI 튜터 설명
                </h4>
                {tutorLoading ? (
                  <div className="flex items-center gap-2 text-text-secondary">
                    <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                    설명을 생성하고 있습니다...
                  </div>
                ) : (
                  <MathRenderer text={tutorResponse} as="div" className="text-body text-text-primary" />
                )}
              </div>
            )}

            {/* 스킬맵 연동 (C-7) */}
            {currentQ.skill && (
              <Link
                href={`/skillmap?highlight=${encodeURIComponent(currentQ.skill)}`}
                className="block card p-4 hover:bg-bg-sidebar transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-caption font-semibold text-text-primary">관련 개념 학습</h4>
                    <p className="text-body text-primary">{currentQ.skill}</p>
                  </div>
                  <span className="text-text-tertiary">→</span>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* 이전/다음 네비게이션 */}
        <div className="flex gap-4">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="btn-secondary flex-1 py-3 disabled:opacity-50"
          >
            ◀ 이전 오답
          </button>
          <button
            onClick={goNext}
            disabled={currentIndex === wrongQuestions.length - 1}
            className="btn-secondary flex-1 py-3 disabled:opacity-50"
          >
            다음 오답 ▶
          </button>
        </div>

        {/* 진행 표시 */}
        <div className="mt-6 flex justify-center gap-2">
          {wrongQuestions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                setShowAnswer(false);
                setShowTutor(false);
                setTutorResponse('');
              }}
              className={`w-3 h-3 rounded-full transition-all ${
                idx === currentIndex ? 'bg-primary' : 'bg-border-subtle hover:bg-primary/50'
              }`}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
