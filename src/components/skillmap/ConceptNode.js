'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';

function ConceptNode({ data }) {
  const {
    concept,
    subject,
    status,
    tutorSessions = 0,    // 튜터 세션 수
    hasMisconception = false,  // 오개념 발견 여부
  } = data;

  // 상태별 스타일
  const getStatusStyles = () => {
    switch (status) {
      case 'mastered':
        return {
          bg: `var(${subject?.cssVar || '--subj-math'})`,
          border: hasMisconception ? 'var(--warning)' : `var(${subject?.cssVar || '--subj-math'})`,
          text: '#ffffff',
          icon: '✓',
        };
      case 'placement_mastered':
        // 자기평가 마스터 - 연한 초록 (opacity 60%)
        return {
          bg: 'var(--success)',
          border: hasMisconception ? 'var(--warning)' : 'var(--success)',
          text: '#ffffff',
          icon: '~',
          opacity: 0.6,
        };
      case 'available':
        return {
          bg: `var(${subject?.cssVar || '--subj-math'}-light)`,
          border: hasMisconception ? 'var(--warning)' : `var(${subject?.cssVar || '--subj-math'})`,
          text: `var(${subject?.cssVar || '--subj-math'}-dark)`,
          pulse: true,
        };
      case 'current':
        return {
          bg: `var(${subject?.cssVar || '--subj-math'})`,
          border: hasMisconception ? 'var(--warning)' : `var(${subject?.cssVar || '--subj-math'})`,
          text: '#ffffff',
          pulse: true,
          ring: true,
        };
      default: // locked
        return {
          bg: 'var(--progress-locked)',
          border: hasMisconception ? 'var(--warning)' : 'var(--progress-locked)',
          text: 'var(--text-disabled)',
          icon: '🔒',
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <div
      className={`
        relative cursor-pointer transition-all hover:scale-110
        ${styles.pulse ? 'animate-pulse-node' : ''}
        ${styles.ring ? 'ring-4 ring-offset-2' : ''}
      `}
      style={{
        width: 80,
        height: 80,
        '--tw-ring-color': styles.border,
      }}
    >
      {/* 메인 원 */}
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: styles.bg,
          border: `3px solid ${styles.border}`,
          opacity: styles.opacity || 1,
        }}
      >
        {styles.icon ? (
          <span className="text-lg">{styles.icon}</span>
        ) : (
          <div
            className="text-[10px] font-medium text-center px-1 leading-tight"
            style={{ color: styles.text }}
          >
            {(concept?.title || 'Concept')?.length > 20
              ? (concept?.title || 'Concept').slice(0, 18) + '...'
              : (concept?.title || 'Concept')}
          </div>
        )}
      </div>

      {/* 튜터 세션 아이콘 (우상단) */}
      {tutorSessions > 0 && (
        <div
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-info flex items-center justify-center text-[10px] text-white shadow-sm"
          title={`${tutorSessions}회 튜터 대화`}
        >
          🤖
        </div>
      )}

      {/* 오개념 경고 아이콘 (좌상단) */}
      {hasMisconception && (
        <div
          className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-warning flex items-center justify-center text-[10px] text-white shadow-sm"
          title="오개념 발견됨 - 복습 필요"
        >
          ⚠
        </div>
      )}

      {/* 툴팁 (호버 시) */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        <div className="px-2 py-1 bg-text-primary text-bg-page text-[10px] rounded whitespace-nowrap">
          {concept?.title || 'Concept'}
          {tutorSessions > 0 && ` · 튜터 ${tutorSessions}회`}
        </div>
      </div>

      {/* 연결 핸들 */}
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0" />
    </div>
  );
}

export default memo(ConceptNode);
