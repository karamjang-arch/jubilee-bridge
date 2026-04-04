'use client';

import { useState, useEffect } from 'react';
import { SUBJECTS } from '@/lib/constants';

export default function SkillMapCanvasSimple() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Fetching concepts...');
        const res = await fetch('/api/concepts?summary=true');
        console.log('Response status:', res.status);
        const json = await res.json();
        console.log('Data loaded:', json.totalCount, 'concepts');
        setData(json);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-tertiary">데이터 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-danger text-lg mb-4">데이터 로드 실패</div>
        <div className="text-text-secondary text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="mb-6">
        <h2 className="text-heading text-text-primary mb-2">
          스킬맵 - 테스트 모드
        </h2>
        <p className="text-body text-text-secondary">
          총 {data?.totalCount?.toLocaleString()}개 개념
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {SUBJECTS.map(subject => {
          const subjectData = data?.subjects?.find(s => s.id === subject.id);
          return (
            <div
              key={subject.id}
              className="p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-lg"
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

      <div className="mt-6 p-4 bg-bg-sidebar rounded-lg">
        <h3 className="text-ui text-text-primary mb-2">디버그 정보</h3>
        <pre className="text-caption text-text-secondary font-mono">
          {JSON.stringify(data?.subjects, null, 2)}
        </pre>
      </div>
    </div>
  );
}
