'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navigation from '@/components/Navigation';
import { SUBJECTS } from '@/lib/constants';
import 'reactflow/dist/style.css';

// React Flow 컴포넌트 (SSR 비활성화)
const ReactFlowCanvas = dynamic(
  () => import('@/components/skillmap/SkillMapCanvas'),
  { ssr: false }
);

export default function SkillMapPage() {
  const [mode, setMode] = useState('loading'); // loading, simple, flow
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 데이터 로드
    fetch('/api/concepts?summary=true')
      .then(res => res.json())
      .then(json => {
        setData(json);
        // 데이터 로드 성공 후 React Flow 모드로 전환
        setMode('flow');
      })
      .catch(err => {
        setError(err.message);
        setMode('simple'); // 에러 시 간단 모드
      });
  }, []);

  // 로딩 상태
  if (mode === 'loading') {
    return (
      <div className="h-screen flex flex-col bg-bg-page">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-tertiary">CB 데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

  // 간단 모드 (에러 시 또는 폴백)
  if (mode === 'simple' || error) {
    return (
      <div className="h-screen flex flex-col bg-bg-page">
        <Navigation />
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-heading text-text-primary">스킬맵</h1>
            {data && (
              <button
                onClick={() => setMode('flow')}
                className="px-3 py-1 bg-subj-math text-white rounded text-caption"
              >
                인터랙티브 모드
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-light text-danger rounded-lg">
              {error}
            </div>
          )}

          {data && (
            <>
              <p className="text-body text-text-secondary mb-6">
                총 {data.totalCount?.toLocaleString()}개 개념
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {SUBJECTS.map(subject => {
                  const subjectData = data.subjects?.find(s => s.id === subject.id);
                  return (
                    <div
                      key={subject.id}
                      className="p-4 rounded-lg border-2 cursor-pointer hover:shadow-lg transition-all"
                      style={{
                        borderColor: `var(${subject.cssVar})`,
                        backgroundColor: `var(${subject.cssVar}-light)`,
                      }}
                    >
                      <div
                        className="text-subheading font-semibold mb-1"
                        style={{ color: `var(${subject.cssVar}-dark)` }}
                      >
                        {subject.name}
                      </div>
                      <div className="text-caption text-text-tertiary">
                        {subjectData?.count || 0}개 개념
                      </div>
                      <div className="text-caption text-text-tertiary">
                        {subjectData?.clusters || 0}개 클러스터
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // React Flow 모드
  return (
    <div className="h-screen flex flex-col bg-bg-page">
      <Navigation />
      <div className="px-4 py-2 bg-bg-card border-b border-border-subtle flex items-center gap-4">
        <button
          onClick={() => setMode('simple')}
          className="text-caption text-text-secondary hover:text-text-primary"
        >
          간단 모드로 보기
        </button>
        <span className="text-caption text-text-tertiary">
          총 {data?.totalCount?.toLocaleString()}개 개념
        </span>
      </div>
      <ReactFlowCanvas initialData={data} />
    </div>
  );
}
