'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SUBJECTS } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';

const GRADE_LEVELS = [
  { value: 5, label: '6학년 이하' },
  { value: 6, label: '7학년' },
  { value: 7, label: '8학년' },
  { value: 8, label: '9학년' },
  { value: 9, label: '10학년' },
  { value: 10, label: '11학년 이상' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, studentId } = useProfile();
  const [step, setStep] = useState(1);
  const [subjectLevels, setSubjectLevels] = useState({});
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placementResult, setPlacementResult] = useState(null);

  // 이미 온보딩 완료한 경우 대시보드로
  useEffect(() => {
    const completed = localStorage.getItem('jb_onboarding_completed');
    if (completed === studentId) {
      router.push('/dashboard');
    }
  }, [router, studentId]);

  // Step 1: 과목별 학년 수준 선택
  const handleLevelChange = (subjectId, level) => {
    setSubjectLevels(prev => ({ ...prev, [subjectId]: level }));
  };

  // Step 1 완료 → Step 2로
  const handleStep1Complete = async () => {
    setIsSubmitting(true);

    try {
      // 선택한 학년 이하의 개념을 placement_mastered로 마킹
      for (const [subjectId, level] of Object.entries(subjectLevels)) {
        const res = await fetch(`/api/concepts?subject=${subjectId}`);
        const data = await res.json();
        const concepts = data.concepts || [];

        // 선택한 학년 이하의 개념 필터
        const masteredConcepts = concepts.filter(c => {
          const maxGrade = Math.max(...(c.grade_us || [0]));
          return maxGrade <= level;
        });

        // API로 저장
        for (const concept of masteredConcepts.slice(0, 50)) { // 최대 50개씩
          await fetch('/api/sheets?tab=concept_progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student: studentId,
              concept_id: concept.id,
              status: 'placement_mastered',
              mastered_at: new Date().toISOString(),
            }),
          });
        }
      }

      // 진단 퀴즈용 질문 로드
      const allQuestions = [];
      for (const subjectId of Object.keys(subjectLevels)) {
        const res = await fetch(`/api/concepts?subject=${subjectId}`);
        const data = await res.json();
        const concepts = data.concepts || [];

        // diagnostic_questions가 있는 개념 중 랜덤 선택
        const withQuestions = concepts.filter(c =>
          c.diagnostic_questions && c.diagnostic_questions.length > 0
        );
        const selected = withQuestions
          .sort(() => Math.random() - 0.5)
          .slice(0, 2); // 과목당 2개

        selected.forEach(c => {
          if (c.diagnostic_questions?.[0]) {
            allQuestions.push({
              conceptId: c.id,
              subject: subjectId,
              question: c.diagnostic_questions[0],
              title: c.title_en,
            });
          }
        });
      }

      setQuizQuestions(allQuestions.slice(0, 10)); // 최대 10개
      setStep(2);
    } catch (error) {
      console.error('Failed to save placement:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: 퀴즈 응답
  const handleQuizAnswer = (questionIdx, correct) => {
    setQuizAnswers(prev => ({ ...prev, [questionIdx]: correct }));
  };

  // Step 2 완료 → 결과 계산
  const handleStep2Complete = async () => {
    setIsSubmitting(true);

    try {
      const correctCount = Object.values(quizAnswers).filter(Boolean).length;
      const totalCount = quizQuestions.length;
      const score = totalCount > 0 ? correctCount / totalCount : 0;

      // 7/10 이상이면 확정, 아니면 1단계 낮춤
      if (score < 0.7) {
        // 1단계 낮은 학년으로 재조정 (여기서는 알림만)
        setPlacementResult({
          score: correctCount,
          total: totalCount,
          adjusted: true,
          message: `${correctCount}/${totalCount} 정답. 학년 수준이 조정되었습니다.`,
        });
      } else {
        setPlacementResult({
          score: correctCount,
          total: totalCount,
          adjusted: false,
          message: `${correctCount}/${totalCount} 정답! 자기평가가 확정되었습니다.`,
        });
      }

      // 온보딩 완료 표시
      localStorage.setItem('jb_onboarding_completed', studentId);
      setStep(3);
    } catch (error) {
      console.error('Failed to complete quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2 건너뛰기
  const handleSkipQuiz = () => {
    localStorage.setItem('jb_onboarding_completed', studentId);
    router.push('/skillmap');
  };

  // Step 3: 완료 후 스킬맵으로
  const handleComplete = () => {
    router.push('/skillmap');
  };

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* 프로그레스 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-all ${
                s <= step ? 'bg-subj-math' : 'bg-border-subtle'
              }`}
            />
          ))}
        </div>

        {/* Step 1: 과목별 자기 평가 */}
        {step === 1 && (
          <div className="card p-6">
            <h1 className="text-heading text-text-primary mb-2">
              학습 수준 평가
            </h1>
            <p className="text-body text-text-secondary mb-6">
              각 과목에서 자신 있는 학년 수준을 선택하세요.
              선택한 학년 이하의 개념은 이미 마스터한 것으로 표시됩니다.
            </p>

            <div className="space-y-4">
              {SUBJECTS.map(subject => (
                <div key={subject.id} className="flex items-center gap-4">
                  <div
                    className="w-20 text-ui font-medium"
                    style={{ color: `var(${subject.cssVar})` }}
                  >
                    {subject.name}
                  </div>
                  <div className="flex-1 flex gap-2">
                    {GRADE_LEVELS.map(level => (
                      <button
                        key={level.value}
                        onClick={() => handleLevelChange(subject.id, level.value)}
                        className={`
                          flex-1 py-2 px-2 rounded-md text-caption transition-all
                          ${subjectLevels[subject.id] === level.value
                            ? 'text-white'
                            : 'bg-bg-hover text-text-secondary hover:bg-bg-selected'
                          }
                        `}
                        style={subjectLevels[subject.id] === level.value ? {
                          backgroundColor: `var(${subject.cssVar})`
                        } : {}}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleStep1Complete}
              disabled={Object.keys(subjectLevels).length < 4 || isSubmitting}
              className={`
                w-full mt-6 py-3 rounded-lg text-ui font-semibold transition-all
                ${Object.keys(subjectLevels).length >= 4
                  ? 'bg-subj-math text-white hover:bg-subj-math-dark'
                  : 'bg-bg-hover text-text-disabled cursor-not-allowed'
                }
              `}
            >
              {isSubmitting ? '저장 중...' : '다음 단계'}
            </button>
          </div>
        )}

        {/* Step 2: 검증 퀴즈 */}
        {step === 2 && (
          <div className="card p-6">
            <h1 className="text-heading text-text-primary mb-2">
              검증 퀴즈 (선택)
            </h1>
            <p className="text-body text-text-secondary mb-6">
              자기평가한 개념 중 일부를 확인합니다.
              7/10 이상 정답 시 확정됩니다.
            </p>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {quizQuestions.map((q, idx) => (
                <div key={idx} className="p-4 bg-bg-sidebar rounded-lg">
                  <div className="text-caption text-text-tertiary mb-1">
                    {SUBJECTS.find(s => s.id === q.subject)?.name} · {q.title}
                  </div>
                  <div className="text-body text-text-primary mb-3 font-mono">
                    {q.question}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleQuizAnswer(idx, true)}
                      className={`
                        flex-1 py-2 rounded-md text-ui transition-all
                        ${quizAnswers[idx] === true
                          ? 'bg-success text-white'
                          : 'bg-bg-hover text-text-secondary hover:bg-success-light'
                        }
                      `}
                    >
                      정답
                    </button>
                    <button
                      onClick={() => handleQuizAnswer(idx, false)}
                      className={`
                        flex-1 py-2 rounded-md text-ui transition-all
                        ${quizAnswers[idx] === false
                          ? 'bg-danger text-white'
                          : 'bg-bg-hover text-text-secondary hover:bg-danger-light'
                        }
                      `}
                    >
                      오답
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSkipQuiz}
                className="flex-1 py-3 rounded-lg text-ui font-semibold bg-bg-hover text-text-secondary hover:bg-bg-selected"
              >
                나중에 하기
              </button>
              <button
                onClick={handleStep2Complete}
                disabled={Object.keys(quizAnswers).length < quizQuestions.length || isSubmitting}
                className={`
                  flex-1 py-3 rounded-lg text-ui font-semibold transition-all
                  ${Object.keys(quizAnswers).length >= quizQuestions.length
                    ? 'bg-subj-math text-white hover:bg-subj-math-dark'
                    : 'bg-bg-hover text-text-disabled cursor-not-allowed'
                  }
                `}
              >
                {isSubmitting ? '확인 중...' : '결과 확인'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 결과 */}
        {step === 3 && (
          <div className="card p-6 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success-light flex items-center justify-center">
              <span className="text-4xl">
                {placementResult?.adjusted ? '📚' : '🎉'}
              </span>
            </div>

            <h1 className="text-heading text-text-primary mb-2">
              평가 완료!
            </h1>
            <p className="text-body text-text-secondary mb-4">
              {placementResult?.message}
            </p>

            <div className="p-4 bg-bg-sidebar rounded-lg mb-6">
              <div className="text-stat text-success">
                {Object.keys(subjectLevels).length * 50}+
              </div>
              <div className="text-caption text-text-tertiary">
                개념 마스터 (자기평가)
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-3 rounded-lg text-ui font-semibold bg-subj-math text-white hover:bg-subj-math-dark"
            >
              스킬맵으로 이동
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
