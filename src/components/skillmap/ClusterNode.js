'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';

function ClusterNode({ data }) {
  const { cluster, subject, mastered = 0 } = data || {};
  if (!cluster || !subject) return null;
  const progress = cluster.count > 0 ? (mastered / cluster.count) * 100 : 0;

  return (
    <div
      className="relative cursor-pointer transition-transform hover:scale-105"
      style={{ width: 100, height: 100 }}
    >
      {/* 배경 원 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: `var(${subject.cssVar}-light)` }}
      />

      {/* 진행률 링 */}
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="6"
        />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={`var(${subject.cssVar})`}
          strokeWidth="6"
          strokeDasharray={`${progress * 2.76} 276`}
          strokeLinecap="round"
        />
      </svg>

      {/* 중앙 콘텐츠 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
        <div
          className="text-caption font-semibold text-center leading-tight"
          style={{ color: `var(${subject.cssVar}-dark)` }}
        >
          {cluster.name}
        </div>
        <div className="text-[10px] text-text-tertiary mt-1">
          {mastered}/{cluster.count}
        </div>
      </div>

      {/* 연결 핸들 */}
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0" />
    </div>
  );
}

export default memo(ClusterNode);
