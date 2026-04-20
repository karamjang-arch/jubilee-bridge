'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SUBJECTS } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';
import MathText from '@/components/MathText';

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
  const { profile, studentId, isAdmin } = useProfile();
  const [step, setStep] = useState(1);
  const [subjectLevels, setSubjectLevels] = useState({});
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placementResult, setPlacementResult] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // 관리자는 온보딩 스킵 → 바로 대시보드
  useEffect(() => {
    if (isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, router]);

  // 이미 온보딩 완료한 학생도 대시보드로
  useEffect(() => {
    if (!studentId) return;
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
    setLoadingQuiz(true);

    try {
      // 각 과목에서 경계 학년(선택한 레벨)의 개념 수집 및 마스터 처리
      const edgeConcepts = [];

      for (const [subjectId, level] of Object.entries(subjectLevels)) {
        const res = await fetch(`/api/concepts?subject=${subjectId}`);
        const data = await res.json();
        const concepts = data.concepts || [];

        // 선택한 학년 이하의 개념을 placement_mastered로 마킹 (배치로 일부만)
        const masteredConcepts = concepts.filter(c => {
          const maxGrade = Math.max(...(c.grade_us || [0]));
          return maxGrade <= level;
        });

        const batch = masteredConcepts.slice(0, 50);
        for (const concept of batch) {
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

        // 경계 학년 개념 수집 (선택한 레벨의 개념들)
        const edgeForSubject = concepts.filter(c => {
          const grades = c.grade_us || [];
          return grades.includes(level) || grades.includes(level - 1);
        });
        edgeConcepts.push(...edgeForSubject.slice(0, 5).map(c => ({
          ...c,
          subject: subjectId,
        })));
      }

      // 실전 문제(cb-questions) 로드 — 4지선다 객관식만
      const questions = [];
      const subjectsWithQuestions = new Set();

      for (const concept of edgeConcepts) {
        // 과목당 최대 2문제
        if (subjectsWithQuestions.has(concept.subject)) {
          const countForSubject = questions.filter(q => q.subject === concept.subject).length;
          if (countForSubject >= 2) continue;
        }

        try {
          const qRes = await fetch(`/api/concept-questions?id=${concept.id}&random=1`);
          const qData = await qRes.json();

          if (qData.questions?.length > 0) {
            const q = qData.questions[0];
            // easy 또는 medium 난이도만 (hard 제외), 4지선다 형식
            const difficultyOk = !q.difficulty || !q.difficulty.includes('hard');
            const hasValidChoices = q.choices?.length === 4 && q.answer;

            if (difficultyOk && hasValidChoices) {
              questions.push({
                concept_id: concept.id,
                subject: concept.subject,
                cluster: concept.cluster,
                question: q.question,
                choices: q.choices,
                answer: q.answer,
                explanation: q.explanation,
              });
              subjectsWithQuestions.add(concept.subject);
            }
          }
        } catch (e) {
          console.error(`Failed to load questions for ${concept.id}`);
        }

        // 10문제 수집 완료 시 중단
        if (questions.length >= 10) break;
      }

      if (questions.length >= 5) {
        setQuizQuestions(questions.slice(0, 10));
        setStep(2);
      } else {
        // 실전 문제가 부족하면 온보딩 스킵
        localStorage.setItem('jb_onboarding_completed', studentId);
        router.push('/skillmap');
      }
    } catch (error) {
      console.error('Failed to save placement:', error);
    } finally {
      setIsSubmitting(false);
      setLoadingQuiz(false);
    }
  };

  // Step 2: 퀴즈 응답 (실제 선택지)
  const handleQuizAnswer = (questionIdx, choice) => {
    setQuizAnswers(prev => ({ ...prev, [questionIdx]: choice }));
  };

  // 정답 체크 (cb-questions 형식: answer="B", choices=["A)..","B)..","C)..","D).."])
  const isCorrectAnswer = (question, selectedChoice) => {
    if (!question.answer || !selectedChoice) return false;
    // 선택된 선택지가 정답 문자로 시작하는지 확인
    // 예: answer="B", selectedChoice="B) Some answer" → true
    const answerLetter = question.answer.toUpperCase().charAt(0);
    return selectedChoice.toUpperCase().startsWith(answerLetter + ')');
  };

  // Step 2 완료 → 결과 계산
  const handleStep2Complete = async () => {
    setIsSubmitting(true);

    try {
      // 정답/오답 개념 분류
      let correctCount = 0;
      const wrongConcepts = [];

      quizQuestions.forEach((q, idx) => {
        const userAnswer = quizAnswers[idx];
        if (userAnswer && isCorrectAnswer(q, userAnswer)) {
          correctCount++;
        } else if (q.concept_id) {
          wrongConcepts.push(q.concept_id);
        }
      });

      // 틀린 개념을 review_needed로 마킹
      for (const conceptId of wrongConcepts) {
        await fetch('/api/sheets?tab=concept_progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student: studentId,
            concept_id: conceptId,
            status: 'review_needed',
            diagnosed_weakness: 'onboarding_quiz_wrong',
          }),
        });
      }

      const totalCount = quizQuestions.length;
      const score = totalCount > 0 ? correctCount / totalCount : 0;

      // 7/10 이상이면 확정
      if (score < 0.7) {
        setPlacementResult({
          score: correctCount,
          total: totalCount,
          adjusted: true,
          wrongConcepts,
          message: `${correctCount}/${totalCount} 정답. ${wrongConcepts.length}개 개념이 복습 목록에 추가되었습니다.`,
        });
      } else {
        setPlacementResult({
          score: correctCount,
          total: totalCount,
          adjusted: false,
          wrongConcepts,
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
              {isSubmitting ? (loadingQuiz ? '퀴즈 준비 중...' : '저장 중...') : '다음 단계'}
            </button>
          </div>
        )}

        {/* Step 2: 검증 퀴즈 (실제 선택지) */}
        {step === 2 && (
          <div className="card p-6">
            <h1 className="text-heading text-text-primary mb-2">
              검증 퀴즈
            </h1>
            <p className="text-body text-text-secondary mb-6">
              자기평가한 개념 중 일부를 확인합니다.
              7/10 이상 정답 시 확정됩니다.
            </p>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              {quizQuestions.map((q, idx) => {
                const subject = SUBJECTS.find(s => s.id === q.subject);
                return (
                  <div key={idx} className="p-4 bg-bg-sidebar rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-caption text-white"
                        style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-caption text-text-tertiary">
                        {subject?.name} · {q.cluster}
                      </span>
                    </div>

                    <div className="text-body text-text-primary mb-3">
                      <MathText text={q.question} />
                    </div>

                    {/* 선택지 */}
                    <div className="space-y-2">
                      {q.choices.map((choice, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => handleQuizAnswer(idx, choice)}
                          className={`
                            w-full p-3 text-left rounded-md transition-all flex items-center gap-3
                            ${quizAnswers[idx] === choice
                              ? 'bg-subj-math-light border-2 border-subj-math'
                              : 'bg-bg-card border-2 border-transparent hover:border-border-subtle'
                            }
                          `}
                        >
                          <span className={`
                            w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                            ${quizAnswers[idx] === choice
                              ? 'border-subj-math bg-subj-math'
                              : 'border-border-strong'
                            }
                          `}>
                            {quizAnswers[idx] === choice && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className="text-body text-text-primary"><MathText text={choice} /></span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 진행 상황 */}
            <div className="mt-4 mb-4">
              <div className="flex justify-between text-caption text-text-tertiary mb-1">
                <span>진행률</span>
                <span>{Object.keys(quizAnswers).length} / {quizQuestions.length}</span>
              </div>
              <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-subj-math transition-all"
                  style={{ width: `${(Object.keys(quizAnswers).length / quizQuestions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-3">
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
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              placementResult?.adjusted ? 'bg-warning-light' : 'bg-success-light'
            }`}>
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

            {/* 점수 표시 */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${
              placementResult?.score >= 7 ? 'bg-success-light text-success' : 'bg-warning-light text-warning'
            }`}>
              <span className="text-heading font-bold">
                {placementResult?.score}/{placementResult?.total}
              </span>
              <span className="text-body">정답</span>
            </div>

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
