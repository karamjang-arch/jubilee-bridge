'use client';

import { useCurriculum, CURRICULUM_US, CURRICULUM_KR } from '@/hooks/useCurriculum';

/**
 * 교육과정 토글 스위치
 * 사용법: <CurriculumToggle />
 */
export default function CurriculumToggle({ className = '' }) {
  const { curriculum, setCurriculum, isLoaded } = useCurriculum();

  if (!isLoaded) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className="w-20 h-8 bg-bg-hover rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 bg-bg-hover rounded-lg p-1 ${className}`}>
      <button
        onClick={() => setCurriculum(CURRICULUM_US)}
        className={`
          px-3 py-1.5 rounded-md text-caption font-medium transition-all
          ${curriculum === CURRICULUM_US
            ? 'bg-white text-text-primary shadow-sm'
            : 'text-text-tertiary hover:text-text-secondary'
          }
        `}
        aria-pressed={curriculum === CURRICULUM_US}
      >
        US
      </button>
      <button
        onClick={() => setCurriculum(CURRICULUM_KR)}
        className={`
          px-3 py-1.5 rounded-md text-caption font-medium transition-all
          ${curriculum === CURRICULUM_KR
            ? 'bg-white text-text-primary shadow-sm'
            : 'text-text-tertiary hover:text-text-secondary'
          }
        `}
        aria-pressed={curriculum === CURRICULUM_KR}
      >
        한국
      </button>
    </div>
  );
}

/**
 * 교육과정 배지 (읽기 전용)
 */
export function CurriculumBadge({ curriculum, className = '' }) {
  const isKR = curriculum === CURRICULUM_KR || curriculum === 'kr';

  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
      ${isKR
        ? 'bg-red-100 text-red-700'
        : 'bg-blue-100 text-blue-700'
      }
      ${className}
    `}>
      {isKR ? '수능' : 'SAT'}
    </span>
  );
}
