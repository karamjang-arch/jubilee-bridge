'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { SUBJECTS_US, SUBJECTS_KR } from '@/hooks/useCurriculum';
import MathText from '@/components/MathText';

const GRADE_LEVELS_US = [
  { value: 5, label: 'Grade 6-' },
  { value: 6, label: 'Grade 7' },
  { value: 7, label: 'Grade 8' },
  { value: 8, label: 'Grade 9' },
  { value: 9, label: 'Grade 10' },
  { value: 10, label: 'Grade 11+' },
];

const GRADE_LEVELS_KR = [
  { value: 6, label: '중1' },
  { value: 7, label: '중2' },
  { value: 8, label: '중3' },
  { value: 9, label: '고1' },
  { value: 10, label: '고2' },
  { value: 11, label: '고3' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, studentId, isAdmin } = useProfile();
  const [step, setStep] = useState(0);
  const [selectedCurriculum, setSelectedCurriculum] = useState(null); // 'us' | 'kr'
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

  const currentSubjects = selectedCurriculum === 'kr' ? SUBJECTS_KR : SUBJECTS_US;
  const currentGradeLevels = selectedCurriculum === 'kr' ? GRADE_LEVELS_KR : GRADE_LEVELS_US;
  const isUS = selectedCurriculum === 'us';
  const minSubjectsRequired = 4;

  // Step 0: 교육과정 선택
  const handleCurriculumSelect = (mode) => {
    setSelectedCurriculum(mode);
    localStorage.setItem('curriculum_mode', mode);
    setSubjectLevels({});
    setStep(1);
  };

  // Step 1: 과목별 학년 수준 선택
  const handleLevelChange = (subjectId, level) => {
    setSubjectLevels(prev => ({ ...prev, [subjectId]: level }));
  };

  // Step 1 완료 → Step 2로
  const handleStep1Complete = async () => {
    setIsSubmitting(true);
    setLoadingQuiz(true);

    try {
      const edgeConcepts = [];

      for (const [subjectId, level] of Object.entries(subjectLevels)) {
        const res = await fetch(`/api/concepts?subject=${subjectId}`);
        const data = await res.json();
        const concepts = data.concepts || [];

        // 선택한 학년 이하의 개념을 placement_mastered로 마킹
        const masteredConcepts = concepts.filter(c => {
          const gradeField = selectedCurriculum === 'kr' ? (c.grade_kr || c.grade_us) : (c.grade_us || []);
          const grades = Array.isArray(gradeField) ? gradeField : [];
          const maxGrade = grades.length > 0 ? Math.max(...grades) : 0;
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

        // 경계 학년 개념 수집
        const edgeForSubject = concepts.filter(c => {
          const gradeField = selectedCurriculum === 'kr' ? (c.grade_kr || c.grade_us) : (c.grade_us || []);
          const grades = Array.isArray(gradeField) ? gradeField : [];
          return grades.includes(level) || grades.includes(level - 1);
        });
        edgeConcepts.push(...edgeForSubject.slice(0, 5).map(c => ({
          ...c,
          subject: subjectId,
        })));
      }

      // 실전 문제 로드 — 4지선다 객관식만
      const questions = [];
      const subjectsWithQuestions = new Set();

      for (const concept of edgeConcepts) {
        if (subjectsWithQuestions.has(concept.subject)) {
          const countForSubject = questions.filter(q => q.subject === concept.subject).length;
          if (countForSubject >= 2) continue;
        }

        try {
          const qRes = await fetch(`/api/concept-questions?id=${concept.id}&random=1`);
          const qData = await qRes.json();

          if (qData.questions?.length > 0) {
            const q = qData.questions[0];
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

        if (questions.length >= 10) break;
      }

      if (questions.length >= 5) {
        setQuizQuestions(questions.slice(0, 10));
        setStep(2);
      } else {
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

  // Step 2: 퀴즈 응답
  const handleQuizAnswer = (questionIdx, choice) => {
    setQuizAnswers(prev => ({ ...prev, [questionIdx]: choice }));
  };

  const isCorrectAnswer = (question, selectedChoice) => {
    if (!question.answer || !selectedChoice) return false;
    const answerLetter = question.answer.toUpperCase().charAt(0);
    return selectedChoice.toUpperCase().startsWith(answerLetter + ')');
  };

  // Step 2 완료 → 결과 계산
  const handleStep2Complete = async () => {
    setIsSubmitting(true);

    try {
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

      if (score < 0.7) {
        setPlacementResult({
          score: correctCount,
          total: totalCount,
          adjusted: true,
          wrongConcepts,
          message: isUS
            ? `${correctCount}/${totalCount} correct. ${wrongConcepts.length} concepts added to review list.`
            : `${correctCount}/${totalCount} 정답. ${wrongConcepts.length}개 개념이 복습 목록에 추가되었습니다.`,
        });
      } else {
        setPlacementResult({
          score: correctCount,
          total: totalCount,
          adjusted: false,
          wrongConcepts,
          message: isUS
            ? `${correctCount}/${totalCount} correct! Your self-assessment is confirmed.`
            : `${correctCount}/${totalCount} 정답! 자기평가가 확정되었습니다.`,
        });
      }

      localStorage.setItem('jb_onboarding_completed', studentId);
      setStep(3);
    } catch (error) {
      console.error('Failed to complete quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipQuiz = () => {
    localStorage.setItem('jb_onboarding_completed', studentId);
    router.push('/skillmap');
  };

  const handleComplete = () => {
    router.push('/skillmap');
  };

  const selectedSubjectCount = Object.keys(subjectLevels).length;
  const step1Ready = selectedSubjectCount >= minSubjectsRequired;
  const step2Ready = Object.keys(quizAnswers).length >= quizQuestions.length;

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* 프로그레스 — 4단계 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2, 3].map(s => (
            <div
              key={s}
              className={`rounded-full transition-all ${
                s < step
                  ? 'w-3 h-3 bg-subj-math'
                  : s === step
                  ? 'w-4 h-4 bg-subj-math'
                  : 'w-3 h-3 bg-border-subtle'
              }`}
            />
          ))}
        </div>

        {/* ── Step 0: 교육과정 선택 ── */}
        {step === 0 && (
          <div className="card p-6">
            <h1 className="text-heading text-text-primary mb-2 text-center">
              교육과정 선택
            </h1>
            <p className="text-body text-text-secondary mb-8 text-center">
              학습할 교육과정을 선택하세요.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* US Curriculum */}
              <button
                onClick={() => handleCurriculumSelect('us')}
                className="group relative p-6 rounded-2xl border-2 border-border-subtle bg-bg-card hover:border-subj-math hover:bg-subj-math/5 transition-all text-center"
              >
                <div className="text-5xl mb-3">🇺🇸</div>
                <div className="text-subheading font-bold text-text-primary mb-1">
                  US Curriculum
                </div>
                <div className="text-caption text-text-tertiary mb-3">
                  SAT · AP · Common Core
                </div>
                <div className="text-caption text-text-secondary">
                  English-based<br />
                  Math · Science · History
                </div>
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 border-border-subtle group-hover:border-subj-math transition-colors" />
              </button>

              {/* Korean Curriculum */}
              <button
                onClick={() => handleCurriculumSelect('kr')}
                className="group relative p-6 rounded-2xl border-2 border-border-subtle bg-bg-card hover:border-subj-english hover:bg-subj-english/5 transition-all text-center"
              >
                <div className="text-5xl mb-3">🇰🇷</div>
                <div className="text-subheading font-bold text-text-primary mb-1">
                  한국 교육과정
                </div>
                <div className="text-caption text-text-tertiary mb-3">
                  수능 · 내신
                </div>
                <div className="text-caption text-text-secondary">
                  한국어 기반<br />
                  수학 · 과학 · 국어 · 사회
                </div>
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 border-border-subtle group-hover:border-subj-english transition-colors" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: 과목별 학년 수준 선택 ── */}
        {step === 1 && (
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setStep(0)}
                className="text-caption text-text-tertiary hover:text-text-secondary transition-colors"
              >
                ← {isUS ? 'US Curriculum' : '한국 교육과정'}
              </button>
            </div>
            <h1 className="text-heading text-text-primary mb-2">
              {isUS ? 'Subject Level Assessment' : '과목별 학습 수준'}
            </h1>
            <p className="text-body text-text-secondary mb-6">
              {isUS
                ? 'Select your current level for each subject. Concepts below your level will be marked as mastered.'
                : '각 과목에서 자신 있는 학년 수준을 선택하세요. 선택한 학년 이하의 개념은 마스터 처리됩니다.'}
            </p>

            <div className="space-y-3">
              {currentSubjects.map(subject => (
                <div key={subject.id} className="flex items-center gap-3">
                  <div
                    className="w-20 text-ui font-medium flex-shrink-0"
                    style={{ color: `var(${subject.cssVar})` }}
                  >
                    {isUS ? subject.name : subject.name}
                  </div>
                  <div className="flex-1 flex gap-1.5">
                    {currentGradeLevels.map(level => (
                      <button
                        key={level.value}
                        onClick={() => handleLevelChange(subject.id, level.value)}
                        className={`
                          flex-1 py-1.5 px-1 rounded-md text-caption transition-all
                          ${subjectLevels[subject.id] === level.value
                            ? 'text-white font-semibold'
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

            {/* 선택 현황 */}
            <div className="mt-4 flex items-center justify-between text-caption text-text-tertiary">
              <span>
                {isUS
                  ? `${selectedSubjectCount} / ${currentSubjects.length} subjects selected`
                  : `${selectedSubjectCount} / ${currentSubjects.length} 과목 선택됨`}
              </span>
              {step1Ready && (
                <span className="text-success">
                  {isUS ? '✓ Ready' : '✓ 준비됨'}
                </span>
              )}
            </div>

            <button
              onClick={handleStep1Complete}
              disabled={!step1Ready || isSubmitting}
              className={`
                w-full mt-4 py-3 rounded-lg text-ui font-semibold transition-all
                ${step1Ready
                  ? 'bg-subj-math text-white hover:opacity-90 shadow-sm'
                  : 'bg-bg-card text-text-tertiary border-2 border-border-subtle cursor-not-allowed'
                }
              `}
            >
              {isSubmitting
                ? (loadingQuiz
                    ? (isUS ? 'Preparing quiz...' : '퀴즈 준비 중...')
                    : (isUS ? 'Saving...' : '저장 중...'))
                : (isUS ? 'Next Step' : '다음 단계')}
            </button>
          </div>
        )}

        {/* ── Step 2: 검증 퀴즈 ── */}
        {step === 2 && (
          <div className="card p-6">
            <h1 className="text-heading text-text-primary mb-2">
              {isUS ? 'Placement Quiz' : '검증 퀴즈'}
            </h1>
            <p className="text-body text-text-secondary mb-6">
              {isUS
                ? 'Verify your self-assessment. Score 7/10 or higher to confirm.'
                : '자기평가한 개념 중 일부를 확인합니다. 7/10 이상 정답 시 확정됩니다.'}
            </p>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              {quizQuestions.map((q, idx) => {
                const subject = currentSubjects.find(s => s.id === q.subject);
                return (
                  <div key={idx} className="p-4 bg-bg-sidebar rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-caption text-white flex-shrink-0"
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
                          <span className="text-body text-text-primary">
                            <MathText text={choice} />
                          </span>
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
                <span>{isUS ? 'Progress' : '진행률'}</span>
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
                className="flex-1 py-3 rounded-lg text-ui font-semibold bg-bg-hover text-text-secondary hover:bg-bg-selected border border-border-subtle"
              >
                {isUS ? 'Skip for Now' : '나중에 하기'}
              </button>
              <button
                onClick={handleStep2Complete}
                disabled={!step2Ready || isSubmitting}
                className={`
                  flex-1 py-3 rounded-lg text-ui font-semibold transition-all
                  ${step2Ready
                    ? 'bg-subj-math text-white hover:opacity-90 shadow-sm'
                    : 'bg-bg-card text-text-tertiary border-2 border-border-subtle cursor-not-allowed'
                  }
                `}
              >
                {isSubmitting
                  ? (isUS ? 'Checking...' : '확인 중...')
                  : (isUS ? 'See Results' : '결과 확인')}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: 결과 ── */}
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
              {isUS ? 'Assessment Complete!' : '평가 완료!'}
            </h1>
            <p className="text-body text-text-secondary mb-4">
              {placementResult?.message}
            </p>

            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${
              placementResult?.score >= 7 ? 'bg-success-light text-success' : 'bg-warning-light text-warning'
            }`}>
              <span className="text-heading font-bold">
                {placementResult?.score}/{placementResult?.total}
              </span>
              <span className="text-body">{isUS ? 'correct' : '정답'}</span>
            </div>

            <div className="p-4 bg-bg-sidebar rounded-lg mb-6">
              <div className="text-stat text-success">
                {Object.keys(subjectLevels).length * 50}+
              </div>
              <div className="text-caption text-text-tertiary">
                {isUS ? 'Concepts Mastered (self-assessment)' : '개념 마스터 (자기평가)'}
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-3 rounded-lg text-ui font-semibold bg-subj-math text-white hover:opacity-90 shadow-sm"
            >
              {isUS ? 'Go to Skill Map' : '스킬맵으로 이동'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
