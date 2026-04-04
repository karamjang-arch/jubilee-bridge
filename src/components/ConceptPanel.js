'use client';

import { useState } from 'react';
import { LEARNING_PATHWAYS, BLOOM_LEVELS } from '@/lib/constants';

export default function ConceptPanel({ concept, subject, onClose, onMastered, status = 'available' }) {
  const [activePathway, setActivePathway] = useState('real_life');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isMastering, setIsMastering] = useState(false);

  const handleMastered = async () => {
    if (status === 'mastered' || status === 'locked') return;
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

  // Gemini 프롬프트 생성
  const generateGradingPrompt = () => {
    return `다음 수학 문제에 대한 학생의 풀이를 채점해주세요.

**개념:** ${concept.title_en} (${concept.title_ko})
**클러스터:** ${concept.cluster}
**SAT 영역:** ${concept.sat_domain}

**채점 기준:**
1. 정답 여부
2. 풀이 과정의 논리성
3. 계산 정확성

**흔한 오류:**
${concept.common_errors?.map((e, i) => `${i + 1}. ${e}`).join('\n') || '- 정보 없음'}

학생 풀이를 입력해주세요:`;
  };

  const generateSATPrompt = () => {
    return `SAT ${concept.sat_domain} 영역 연습문제를 만들어주세요.

**개념:** ${concept.title_en}
**SAT Skill:** ${concept.sat_skill}
**난이도:** 중~상

**주의할 함정들:**
${concept.common_errors?.map((e, i) => `${i + 1}. ${e}`).join('\n') || '- 계산 실수 유도\n- 음수 부호 혼동\n- 중간값을 정답으로 오해'}

문제 형식:
- 4지선다
- 풀이 시간 목표: 60초
- 정답과 해설 포함`;
  };

  const generateExplainPrompt = () => {
    const pathway = concept.learning_pathways?.[activePathway] || '';
    return `"${concept.title_en}" 개념을 설명해주세요.

**한국어 명칭:** ${concept.title_ko}
**학년:** ${concept.grade_us?.join(', ')} 학년
**SAT 영역:** ${concept.sat_domain}

**학습 힌트 (${LEARNING_PATHWAYS.find(p => p.id === activePathway)?.name}):**
${pathway || '정보 없음'}

다음을 포함해서 설명해주세요:
1. 핵심 개념 정의
2. 왜 중요한지
3. 실제 문제에서 어떻게 적용하는지
4. 흔히 하는 실수와 해결책`;
  };

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
                  {concept.cluster} · {concept.grade_us?.join('-')}학년
                </span>
              </div>
              <h2 className="text-heading text-text-primary">
                {concept.title_en}
              </h2>
              <p className="text-body text-text-secondary mt-1">
                {concept.title_ko}
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

          {/* SAT 정보 */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 bg-info-light text-info text-caption rounded-pill">
              SAT: {concept.sat_domain}
            </span>
            <span className="px-3 py-1 bg-bg-sidebar text-text-secondary text-caption rounded-pill">
              {concept.sat_skill}
            </span>
          </div>

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
            <div className="p-4 bg-bg-sidebar rounded-lg text-body text-text-secondary">
              {concept.learning_pathways?.[activePathway] || '이 경로의 콘텐츠가 아직 없습니다.'}
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
                    ${idx < 3 ? 'text-white' : 'bg-bg-hover text-text-disabled'}
                  `}
                  style={idx < 3 ? {
                    backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)',
                    opacity: 1 - idx * 0.2
                  } : {}}
                  title={level.nameKo}
                >
                  {idx < 3 ? '★' : '☆'}
                </div>
              ))}
            </div>
            <p className="text-caption text-text-tertiary mt-2">
              Apply (적용) 레벨 — 문제 풀이에 직접 적용 가능
            </p>
          </div>

          {/* Diagnostic Questions */}
          <div className="mb-6">
            <h3 className="text-subheading text-text-primary mb-3">진단 문제</h3>
            <div className="space-y-2">
              {concept.diagnostic_questions?.map((q, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-bg-sidebar rounded-lg flex items-start gap-3"
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-caption text-white flex-shrink-0"
                    style={{ backgroundColor: subject ? `var(${subject.cssVar})` : 'var(--subj-math)' }}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-body text-text-primary font-mono">{q}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Common Errors */}
          <div className="mb-6">
            <h3 className="text-subheading text-text-primary mb-3">흔한 오류</h3>
            <ul className="space-y-2">
              {concept.common_errors?.map((error, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-body text-text-secondary"
                >
                  <span className="text-danger">⚠️</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>

          {/* Gemini 복사 버튼 */}
          <div className="border-t border-border-subtle pt-6">
            <h3 className="text-subheading text-text-primary mb-3">Gemini 프롬프트</h3>
            <div className="space-y-2">
              <button
                onClick={() => copyToClipboard(generateGradingPrompt(), '풀이 채점 프롬프트 복사됨!')}
                className="w-full btn btn-secondary justify-between"
              >
                <span>📝 풀이 채점</span>
                <span className="text-text-tertiary">복사</span>
              </button>
              <button
                onClick={() => copyToClipboard(generateSATPrompt(), 'SAT 연습 프롬프트 복사됨!')}
                className="w-full btn btn-secondary justify-between"
              >
                <span>🎯 SAT 연습문제</span>
                <span className="text-text-tertiary">복사</span>
              </button>
              <button
                onClick={() => copyToClipboard(generateExplainPrompt(), '개념 설명 프롬프트 복사됨!')}
                className="w-full btn btn-secondary justify-between"
              >
                <span>💡 이 개념 설명해줘</span>
                <span className="text-text-tertiary">복사</span>
              </button>
            </div>
          </div>

          {/* 이해했어요 버튼 */}
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
            ) : (
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
                    이해했어요! (마스터 완료)
                  </>
                )}
              </button>
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
