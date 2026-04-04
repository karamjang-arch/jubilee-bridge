'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';

function SubjectClusterNode({ data }) {
  const { subject, mastered = 0, total = 1 } = data || {};
  if (!subject) return null;
  const progress = total > 0 ? (mastered / total) * 100 : 0;

  return (
    <div
      className="relative cursor-pointer transition-transform hover:scale-105"
      style={{ width: 120, height: 120 }}
    >
      {/* 배경 원 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: `var(${subject.cssVar}-light)` }}
      />

      {/* 진행률 링 */}
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox="0 0 120 120"
      >
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={`var(${subject.cssVar})`}
          strokeWidth="8"
          strokeDasharray={`${progress * 3.39} 339`}
          strokeLinecap="round"
        />
      </svg>

      {/* 중앙 콘텐츠 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="text-subheading font-semibold"
          style={{ color: `var(${subject.cssVar}-dark)` }}
        >
          {subject.name}
        </div>
        <div className="text-caption text-text-tertiary mt-1">
          {mastered} / {total}
        </div>
        <div className="text-caption font-mono" style={{ color: `var(${subject.cssVar})` }}>
          {progress.toFixed(0)}%
        </div>
      </div>

      {/* 연결 핸들 */}
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0" />
    </div>
  );
}

export default memo(SubjectClusterNode);
