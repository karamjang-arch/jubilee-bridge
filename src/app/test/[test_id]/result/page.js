'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// 로컬스토리지 키
const getStorageKey = (testId) => `test_progress_${testId}`;

export default function TestResultPage() {
  const params = useParams();
  const testId = params.test_id;

  const [test, setTest] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 채점 결과
  const [results, setResults] = useState(null);

  useEffect(() => {
    async function loadAndGrade() {
      try {
        // 테스트 JSON 로드
        const res = await fetch(`/tests/json/${testId}.json`);
        if (!res.ok) throw new Error('시험을 찾을 수 없습니다');
        const testData = await res.json();
        setTest(testData);

        // 저장된 답안 로드
        const saved = localStorage.getItem(getStorageKey(testId));
        if (!saved) throw new Error('제출된 답안이 없습니다');
        const progressData = JSON.parse(saved);
        setProgress(progressData);

        // 채점
        const questions = testData.questions || [];
        const answers = progressData.answers || {};

        let correct = 0;
        let incorrect = 0;
        let unanswered = 0;
        const questionResults = [];
        const skillStats = {};

        questions.forEach((q) => {
          const qNum = q.number;
          const userAnswer = answers[qNum];
          const correctAnswer = q.answer ? parseInt(q.answer) : null;
          const skill = q.skill || '기타';

          // 스킬별 통계 초기화
          if (!skillStats[skill]) {
            skillStats[skill] = { total: 0, correct: 0 };
          }
          skillStats[skill].total++;

          let status;
          if (userAnswer === undefined) {
            unanswered++;
            status = 'unanswered';
          } else if (correctAnswer === null) {
            // 정답이 없는 경우 (채점 불가)
            status = 'ungraded';
          } else if (userAnswer === correctAnswer) {
            correct++;
            skillStats[skill].correct++;
            status = 'correct';
          } else {
            incorrect++;
            status = 'incorrect';
          }

          questionResults.push({
            number: qNum,
            question: q.question,
            choices: q.choices,
            userAnswer,
            correctAnswer,
            status,
            skill,
            explanation: q.explanation,
          });
        });

        // 점수 계산
        const totalQuestions = questions.length;
        const answeredQuestions = correct + incorrect;
        const rawScore = correct;
        const percentage = answeredQuestions > 0
          ? Math.round((correct / answeredQuestions) * 100)
          : 0;

        setResults({
          correct,
          incorrect,
          unanswered,
          totalQuestions,
          rawScore,
          percentage,
          questionResults,
          skillStats,
        });

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAndGrade();
  }, [testId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-text-secondary">채점 중...</p>
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

  const { correct, incorrect, unanswered, totalQuestions, percentage, skillStats } = results;

  // 성적 등급
  const getGrade = (pct) => {
    if (pct >= 90) return { grade: 'A', color: 'text-success', bg: 'bg-success' };
    if (pct >= 80) return { grade: 'B', color: 'text-info', bg: 'bg-info' };
    if (pct >= 70) return { grade: 'C', color: 'text-warning', bg: 'bg-warning' };
    if (pct >= 60) return { grade: 'D', color: 'text-orange-500', bg: 'bg-orange-500' };
    return { grade: 'F', color: 'text-error', bg: 'bg-error' };
  };

  const gradeInfo = getGrade(percentage);

  return (
    <div className="min-h-screen bg-bg-page">
      {/* 헤더 */}
      <header className="bg-white border-b border-border-subtle">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/practice-tests" className="text-caption text-text-tertiary hover:text-text-secondary mb-2 inline-block">
            ← 테스트 목록
          </Link>
          <h1 className="text-heading text-text-primary">{test.name}</h1>
          <p className="text-body text-text-secondary">채점 결과</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 점수 카드 */}
        <div className="card p-8 text-center">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${gradeInfo.bg} text-white text-4xl font-bold mb-4`}>
            {gradeInfo.grade}
          </div>
          <h2 className="text-display text-text-primary mb-2">{percentage}%</h2>
          <p className="text-body text-text-secondary">
            {correct} / {totalQuestions} 정답
          </p>
        </div>

        {/* 통계 요약 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-success">{correct}</div>
            <div className="text-caption text-text-secondary">정답</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-error">{incorrect}</div>
            <div className="text-caption text-text-secondary">오답</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-text-tertiary">{unanswered}</div>
            <div className="text-caption text-text-secondary">미응답</div>
          </div>
        </div>

        {/* 영역별 분석 */}
        <div className="card p-6">
          <h3 className="text-subheading text-text-primary mb-4">영역별 분석</h3>
          <div className="space-y-4">
            {Object.entries(skillStats)
              .sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))
              .map(([skill, stats]) => {
                const pct = Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={skill}>
                    <div className="flex justify-between text-caption mb-1">
                      <span className="text-text-primary">{skill}</span>
                      <span className={pct >= 70 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-error'}>
                        {stats.correct}/{stats.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-bg-sidebar rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          pct >= 70 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-error'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* 문제별 결과 (간략) */}
        <div className="card p-6">
          <h3 className="text-subheading text-text-primary mb-4">문제별 결과</h3>
          <div className="flex flex-wrap gap-2">
            {results.questionResults.map((q) => (
              <div
                key={q.number}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-caption font-medium ${
                  q.status === 'correct'
                    ? 'bg-success/20 text-success'
                    : q.status === 'incorrect'
                      ? 'bg-error/20 text-error'
                      : q.status === 'unanswered'
                        ? 'bg-bg-sidebar text-text-tertiary'
                        : 'bg-warning/20 text-warning'
                }`}
                title={`${q.number}번: ${q.status === 'correct' ? '정답' : q.status === 'incorrect' ? '오답' : '미응답'}`}
              >
                {q.number}
              </div>
            ))}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href={`/test/${testId}/review`}
            className="btn-primary flex-1 text-center py-3"
          >
            🔍 오답 복습하기
          </Link>
          <Link
            href="/practice-tests"
            className="btn-secondary flex-1 text-center py-3"
          >
            다른 시험 보기
          </Link>
        </div>

        {/* 스킬맵 연동 안내 */}
        {incorrect > 0 && (
          <div className="card p-4 bg-info-light border-info/20">
            <div className="flex gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-body text-info font-medium mb-1">
                  틀린 문제의 개념을 복습하세요
                </p>
                <p className="text-caption text-text-secondary">
                  오답 복습에서 각 문제의 관련 개념으로 이동하여 학습할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
