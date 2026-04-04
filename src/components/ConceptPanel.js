'use client';

import { useState, useEffect } from 'react';
import { LEARNING_PATHWAYS, BLOOM_LEVELS } from '@/lib/constants';

export default function ConceptPanel({ concept, subject, onClose, onMastered, status = 'available' }) {
  const [activePathway, setActivePathway] = useState('real_life');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isMastering, setIsMastering] = useState(false);
  const [activeTab, setActiveTab] = useState('learn'); // learn, quiz, resources

  // CB 콘텐츠 상태
  const [cbContent, setCbContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(true);

  // 퀴즈 상태
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  // CB 콘텐츠 로드
  useEffect(() => {
    const conceptId = concept.concept_id || concept.id;
    if (!conceptId) return;

    setLoadingContent(true);
    fetch(`/api/concept-content?id=${conceptId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setCbContent(data);
        }
      })
      .catch(err => console.error('Failed to load CB content:', err))
      .finally(() => setLoadingContent(false));
  }, [concept]);

  // 퀴즈 제출
  const handleQuizSubmit = () => {
    const questions = cbContent?.diagnostic_questions || [];
    let correct = 0;

    questions.forEach((q, idx) => {
      const userAnswer = quizAnswers[idx];
      // 정답 체크 (인라인 선택지의 경우 첫 번째가 주로 정답)
      if (q.choices && q.choices.length > 0) {
        // 정답이 명시된 경우
        if (q.answer && userAnswer === q.answer) {
          correct++;
        }
        // 정답이 없으면 첫 번째 선택지를 정답으로 가정
        else if (!q.answer && userAnswer === q.choices[0]) {
          correct++;
        }
      }
    });

    setCorrectCount(correct);
    setQuizSubmitted(true);
  };

  // 마스터 가능 여부 (퀴즈 2/3 이상 정답)
  const canMaster = () => {
    const questions = cbContent?.diagnostic_questions?.filter(q => q.choices?.length >= 2) || [];
    if (questions.length === 0) return true; // 문제가 없으면 바로 마스터 가능
    if (!quizSubmitted) return false;
    return correctCount >= Math.ceil(questions.length * 0.67);
  };

  const handleMastered = async () => {
    if (status === 'mastered' || status === 'locked') return;
    if (!canMaster()) {
      setToastMessage('퀴즈를 먼저 통과해주세요!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      return;
    }

    setIsMastering(true);
    try {
      await onMastered?.(concept.concept_id || concept.id, subject?.id, concept.prerequisites || []);
      setToastMessage('개념을 마스터했습니다!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (error) {
      console.error('Failed to mark as mastered:', error);
    } finally {
      setIsMastering(false);
    }
  };

  // 복사 함수
  const copyToClipboard = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage(message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Gemini 프롬프트
  const generateGradingPrompt = () => {
    return `다음 문제에 대한 학생의 풀이를 채점해주세요.

**개념:** ${concept.title_en} (${concept.title_ko || ''})
**클러스터:** ${concept.cluster}

**채점 기준:**
1. 정답 여부
2. 풀이 과정의 논리성
3. 계산 정확성

**흔한 오류:**
${(cbContent?.common_errors || concept.common_errors || []).map((e, i) => `${i + 1}. ${e}`).join('\n') || '- 정보 없음'}

학생 풀이를 입력해주세요:`;
  };

  // Learning pathways 데이터 (CB 콘텐츠 우선)
  const pathways = cbContent?.learning_pathways || concept.learning_pathways || {};

  // 진단 문제 (선택지 있는 것만)
  const quizQuestions = (cbContent?.diagnostic_questions || []).filter(
    q => q.choices && q.choices.length >= 2
  );

  // 블룸 레벨
  const bloomLevel = cbContent?.bloom_level || 3;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/20 z-10"
        onClick={onClose}
      />

      {/* 패널 */}
      <div className="absolute top-0 right-0 h-full w-full max-w-md bg-bg-card border-l border-border-subtle shadow-elevated z-20 overflow-y-auto">
        {/* 상단 컬러 바 */}
        <div
          className="h-1"
          style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
        />

        <div className="p-6">
          {/* 헤더 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                />
                <span className="text-caption text-text-tertiary">
                  {concept.cluster} · {concept.grade_us?.join('-') || ''}학년
                </span>
              </div>
              <h2 className="text-heading text-text-primary">
                {cbContent?.title_en || concept.title_en}
              </h2>
              <p className="text-body text-text-secondary mt-1">
                {cbContent?.title_ko || concept.title_ko}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-bg-hover rounded-md transition-colors"
            >
              <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 mb-4 p-1 bg-bg-sidebar rounded-lg">
            {[
              { id: 'learn', label: '📚 학습', count: Object.keys(pathways).length },
              { id: 'quiz', label: '✏️ 진단', count: quizQuestions.length },
              { id: 'resources', label: '🔗 자료', count: (cbContent?.free_resources || []).length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-caption rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-bg-card text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {tab.label} {tab.count > 0 && `(${tab.count})`}
              </button>
            ))}
          </div>

          {loadingContent ? (
            <div className="py-8 text-center text-text-tertiary">
              콘텐츠 로딩 중...
            </div>
          ) : (
            <>
              {/* 학습 탭 */}
              {activeTab === 'learn' && (
                <>
                  {/* Learning Pathways */}
                  <div className="mb-6">
                    <h3 className="text-subheading text-text-primary mb-3">Learning Pathways</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {LEARNING_PATHWAYS.map((pathway) => (
                        <button
                          key={pathway.id}
                          onClick={() => setActivePathway(pathway.id)}
                          className={`
                            px-3 py-1.5 rounded-md text-caption transition-colors
                            ${activePathway === pathway.id
                              ? 'text-white'
                              : 'bg-bg-sidebar text-text-secondary hover:bg-bg-hover'
                            }
                          `}
                          style={activePathway === pathway.id ? {
                            backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)'
                          } : {}}
                        >
                          {pathway.icon} {pathway.name}
                        </button>
                      ))}
                    </div>
                    <div className="p-4 bg-bg-sidebar rounded-lg text-body text-text-secondary leading-relaxed">
                      {pathways[activePathway] || '이 경로의 콘텐츠가 아직 없습니다.'}
                    </div>
                  </div>

                  {/* Bloom Level */}
                  <div className="mb-6">
                    <h3 className="text-subheading text-text-primary mb-3">Bloom Level</h3>
                    <div className="flex gap-1">
                      {BLOOM_LEVELS.map((level, idx) => (
                        <div
                          key={level.level}
                          className={`
                            flex-1 h-8 flex items-center justify-center text-caption rounded
                            ${idx < bloomLevel ? 'text-white' : 'bg-bg-hover text-text-disabled'}
                          `}
                          style={idx < bloomLevel ? {
                            backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)',
                            opacity: 1 - (bloomLevel - 1 - idx) * 0.15
                          } : {}}
                          title={level.nameKo}
                        >
                          {idx < bloomLevel ? '★' : '☆'}
                        </div>
                      ))}
                    </div>
                    <p className="text-caption text-text-tertiary mt-2">
                      {BLOOM_LEVELS[bloomLevel - 1]?.name} ({BLOOM_LEVELS[bloomLevel - 1]?.nameKo}) 레벨
                    </p>
                  </div>

                  {/* Common Errors */}
                  {(cbContent?.common_errors || []).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-subheading text-text-primary mb-3">흔한 오류</h3>
                      <ul className="space-y-2">
                        {cbContent.common_errors.map((error, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-body text-text-secondary"
                          >
                            <span className="text-danger flex-shrink-0">⚠️</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Test Patterns */}
                  {(cbContent?.test_patterns?.sat || cbContent?.test_patterns?.csat) && (
                    <div className="mb-6">
                      <h3 className="text-subheading text-text-primary mb-3">시험 출제 패턴</h3>
                      {cbContent.test_patterns.sat && (
                        <div className="mb-3">
                          <div className="text-caption text-info font-medium mb-1">SAT</div>
                          <p className="text-body text-text-secondary p-3 bg-info-light rounded-lg">
                            {cbContent.test_patterns.sat}
                          </p>
                        </div>
                      )}
                      {cbContent.test_patterns.csat && (
                        <div>
                          <div className="text-caption text-success font-medium mb-1">수능</div>
                          <p className="text-body text-text-secondary p-3 bg-success-light rounded-lg">
                            {cbContent.test_patterns.csat}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Gemini 프롬프트 */}
                  <div className="border-t border-border-subtle pt-6">
                    <h3 className="text-subheading text-text-primary mb-3">AI 학습 도우미</h3>
                    <button
                      onClick={() => copyToClipboard(generateGradingPrompt(), '채점 프롬프트 복사됨!')}
                      className="w-full btn btn-secondary justify-between"
                    >
                      <span>📝 Gemini에 풀이 채점 요청</span>
                      <span className="text-text-tertiary">복사</span>
                    </button>
                  </div>
                </>
              )}

              {/* 퀴즈 탭 */}
              {activeTab === 'quiz' && (
                <div>
                  <h3 className="text-subheading text-text-primary mb-4">진단 문제</h3>

                  {quizQuestions.length === 0 ? (
                    <div className="py-8 text-center text-text-tertiary">
                      <p className="mb-2">선택형 문제가 없습니다.</p>
                      <p className="text-caption">학습 탭에서 개념을 익힌 후 마스터 버튼을 눌러주세요.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {quizQuestions.map((q, idx) => {
                        const isCorrect = quizSubmitted && (
                          (q.answer && quizAnswers[idx] === q.answer) ||
                          (!q.answer && quizAnswers[idx] === q.choices[0])
                        );
                        const isWrong = quizSubmitted && quizAnswers[idx] && !isCorrect;

                        return (
                          <div key={idx} className="p-4 bg-bg-sidebar rounded-lg">
                            <div className="flex items-start gap-3 mb-3">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-caption flex-shrink-0 ${
                                  quizSubmitted
                                    ? isCorrect
                                      ? 'bg-success text-white'
                                      : isWrong
                                        ? 'bg-danger text-white'
                                        : 'bg-bg-hover text-text-tertiary'
                                    : 'text-white'
                                }`}
                                style={!quizSubmitted ? {
                                  backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)'
                                } : {}}
                              >
                                {quizSubmitted ? (isCorrect ? '✓' : isWrong ? '✗' : idx + 1) : idx + 1}
                              </span>
                              <span className="text-body text-text-primary flex-1">
                                {q.question}
                              </span>
                            </div>

                            <div className="space-y-2 ml-9">
                              {q.choices.map((choice, cIdx) => {
                                const isSelected = quizAnswers[idx] === choice;
                                const isAnswer = q.answer === choice || (!q.answer && cIdx === 0);

                                return (
                                  <label
                                    key={cIdx}
                                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                                      quizSubmitted
                                        ? isAnswer
                                          ? 'bg-success-light border border-success'
                                          : isSelected && !isAnswer
                                            ? 'bg-danger-light border border-danger'
                                            : 'bg-bg-card'
                                        : isSelected
                                          ? 'bg-bg-card border border-border-strong'
                                          : 'bg-bg-card hover:bg-bg-hover'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`q-${idx}`}
                                      value={choice}
                                      checked={isSelected}
                                      onChange={() => !quizSubmitted && setQuizAnswers({ ...quizAnswers, [idx]: choice })}
                                      disabled={quizSubmitted}
                                      className="sr-only"
                                    />
                                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      isSelected
                                        ? quizSubmitted
                                          ? isAnswer ? 'border-success bg-success' : 'border-danger bg-danger'
                                          : 'border-current bg-current'
                                        : 'border-border-strong'
                                    }`}
                                    style={isSelected && !quizSubmitted ? {
                                      borderColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)',
                                      backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)',
                                    } : {}}
                                    >
                                      {isSelected && (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                    <span className="text-body text-text-primary">{choice}</span>
                                  </label>
                                );
                              })}
                            </div>

                            {/* 해설 */}
                            {quizSubmitted && q.explanation && (
                              <div className="mt-3 ml-9 p-3 bg-info-light rounded-md text-caption text-info">
                                💡 {q.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* 제출/결과 */}
                      {!quizSubmitted ? (
                        <button
                          onClick={handleQuizSubmit}
                          disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                          className="w-full btn text-white disabled:opacity-50"
                          style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                        >
                          답안 제출 ({Object.keys(quizAnswers).length}/{quizQuestions.length})
                        </button>
                      ) : (
                        <div className={`p-4 rounded-lg text-center ${
                          canMaster() ? 'bg-success-light' : 'bg-danger-light'
                        }`}>
                          <div className={`text-heading font-bold ${canMaster() ? 'text-success' : 'text-danger'}`}>
                            {correctCount} / {quizQuestions.length} 정답
                          </div>
                          <p className={`text-body mt-1 ${canMaster() ? 'text-success' : 'text-danger'}`}>
                            {canMaster()
                              ? '🎉 통과! 이제 마스터할 수 있습니다.'
                              : '다시 학습 후 도전해보세요.'}
                          </p>
                          {!canMaster() && (
                            <button
                              onClick={() => {
                                setQuizAnswers({});
                                setQuizSubmitted(false);
                                setCorrectCount(0);
                              }}
                              className="mt-3 btn btn-secondary"
                            >
                              다시 풀기
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 자료 탭 */}
              {activeTab === 'resources' && (
                <div>
                  <h3 className="text-subheading text-text-primary mb-4">학습 자료</h3>

                  {/* Free Resources */}
                  {(cbContent?.free_resources || []).length > 0 ? (
                    <div className="space-y-2">
                      {cbContent.free_resources.map((resource, idx) => (
                        <a
                          key={idx}
                          href={resource.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 bg-bg-sidebar rounded-lg hover:bg-bg-hover transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">
                              {resource.source === 'Khan Academy' ? '📺' :
                               resource.source === 'YouTube' ? '▶️' :
                               resource.source === 'OpenStax' ? '📖' :
                               resource.source === 'PhET' ? '🔬' : '🔗'}
                            </span>
                            <div className="flex-1">
                              <div className="text-body text-text-primary">{resource.title}</div>
                              <div className="text-caption text-text-tertiary">{resource.source}</div>
                            </div>
                            <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-text-tertiary">
                      외부 학습 자료가 없습니다.
                    </div>
                  )}

                  {/* Meta Cognition */}
                  {cbContent?.meta_cognition && (
                    <div className="mt-6 pt-6 border-t border-border-subtle">
                      <h4 className="text-ui text-text-primary mb-3">🧠 메타인지 도움말</h4>

                      {cbContent.meta_cognition.stuck_diagnosis && (
                        <div className="mb-4">
                          <div className="text-caption text-text-tertiary mb-1">막힐 때 체크리스트</div>
                          <p className="text-body text-text-secondary p-3 bg-bg-sidebar rounded-lg">
                            {cbContent.meta_cognition.stuck_diagnosis}
                          </p>
                        </div>
                      )}

                      {cbContent.meta_cognition.self_check && (
                        <div>
                          <div className="text-caption text-text-tertiary mb-1">자기 점검</div>
                          <p className="text-body text-text-secondary p-3 bg-bg-sidebar rounded-lg">
                            {cbContent.meta_cognition.self_check}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 마스터 버튼 */}
          <div className="mt-6 pt-6 border-t border-border-subtle">
            {status === 'mastered' ? (
              <div className="w-full py-3 rounded-lg bg-success-light text-success text-center font-medium flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                이미 마스터한 개념입니다
              </div>
            ) : status === 'locked' ? (
              <div className="w-full py-3 rounded-lg bg-bg-hover text-text-disabled text-center font-medium flex items-center justify-center gap-2">
                <span>🔒</span>
                선수 개념을 먼저 마스터하세요
              </div>
            ) : canMaster() ? (
              <button
                onClick={handleMastered}
                disabled={isMastering}
                className="w-full btn text-white flex items-center justify-center gap-2"
                style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
              >
                {isMastering ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    저장 중...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    마스터 완료!
                  </>
                )}
              </button>
            ) : (
              <div className="w-full py-3 rounded-lg bg-warning-light text-warning text-center font-medium flex items-center justify-center gap-2">
                <span>✏️</span>
                진단 문제를 먼저 풀어주세요
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 토스트 */}
      {showToast && (
        <div className="toast z-50">
          {toastMessage}
        </div>
      )}
    </>
  );
}
