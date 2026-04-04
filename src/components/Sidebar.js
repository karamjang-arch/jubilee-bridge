'use client';

import { useState } from 'react';

const SUBJECTS = [
  { id: 'math', name: '수학', color: 'subj-math', count: 1114 },
  { id: 'english', name: '영어', color: 'subj-english', count: 820 },
  { id: 'physics', name: '물리', color: 'subj-physics', count: 498 },
  { id: 'chemistry', name: '화학', color: 'subj-chemistry', count: 400 },
  { id: 'biology', name: '생물', color: 'subj-biology', count: 399 },
  { id: 'history', name: '역사', color: 'subj-history', count: 500 },
  { id: 'economics', name: '경제', color: 'subj-economics', count: 300 },
  { id: 'cs', name: 'CS', color: 'subj-cs', count: 320 },
];

export default function Sidebar({ selectedSubject, onSubjectChange, collapsed = false }) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  if (isCollapsed) {
    return (
      <aside className="w-16 bg-bg-sidebar border-r border-border-subtle p-2 flex flex-col gap-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-md"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {SUBJECTS.map((subject) => (
          <button
            key={subject.id}
            onClick={() => onSubjectChange?.(subject.id)}
            className={`
              w-10 h-10 rounded-full flex items-center justify-center text-caption font-medium
              ${selectedSubject === subject.id ? `bg-${subject.color} text-white` : 'bg-bg-hover text-text-secondary hover:bg-bg-selected'}
            `}
            title={subject.name}
            style={selectedSubject === subject.id ? { backgroundColor: `var(--${subject.color})` } : {}}
          >
            {subject.name[0]}
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside className="w-sidebar bg-bg-sidebar border-r border-border-subtle p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-subheading text-text-primary">과목 필터</h3>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Subject Filters */}
      <div className="flex flex-col gap-1">
        <button
          onClick={() => onSubjectChange?.(null)}
          className={`
            flex items-center gap-3 px-3 py-2 rounded-md text-ui transition-colors
            ${!selectedSubject ? 'bg-bg-selected text-text-primary' : 'text-text-secondary hover:bg-bg-hover'}
          `}
        >
          <span className="w-2 h-2 rounded-full bg-text-tertiary" />
          전체 (4,351)
        </button>

        {SUBJECTS.map((subject) => (
          <button
            key={subject.id}
            onClick={() => onSubjectChange?.(subject.id)}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-md text-ui transition-colors
              ${selectedSubject === subject.id
                ? 'bg-bg-selected text-text-primary'
                : 'text-text-secondary hover:bg-bg-hover'
              }
            `}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: `var(--${subject.color})` }}
            />
            {subject.name} ({subject.count.toLocaleString()})
          </button>
        ))}
      </div>

      {/* Progress Summary */}
      <div className="mt-6 pt-6 border-t border-border-subtle">
        <h4 className="text-caption text-text-tertiary mb-3">진행 요약</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-ui">
            <span className="text-text-secondary">마스터</span>
            <span className="text-text-primary font-medium">0 / 4,351</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill bg-progress-streak" style={{ width: '0%' }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
