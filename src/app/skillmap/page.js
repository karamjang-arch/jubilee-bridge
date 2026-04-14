'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navigation from '@/components/Navigation';
import CurriculumToggle from '@/components/CurriculumToggle';
import MotivationCard from '@/components/MotivationCard';
import { useCurriculum } from '@/hooks/useCurriculum';
import 'reactflow/dist/style.css';

// React Flow 컴포넌트 (SSR 비활성화)
const ReactFlowCanvas = dynamic(
  () => import('@/components/skillmap/SkillMapCanvas'),
  { ssr: false }
);

export default function SkillMapPage() {
  const { curriculum, subjects, curriculumLabel, isKR, isLoaded } = useCurriculum();
  const [mode, setMode] = useState('loading'); // loading, simple, flow
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 교육과정 로드 완료 후에만 데이터 가져오기
    if (!isLoaded) return;

    setMode('loading');
    setData(null); // 이전 데이터 초기화

    // 교육과정에 따라 데이터 로드
    fetch(`/api/concepts?summary=true&curriculum=${curriculum}`)
      .then(res => res.json())
      .then(json => {
        // 응답의 curriculum이 요청과 일치하는지 확인
        if (json.curriculum === curriculum) {
          setData(json);
          setMode('flow');
        } else {
          console.warn('Curriculum mismatch:', json.curriculum, 'vs', curriculum);
          setError('교육과정 데이터 불일치');
          setMode('simple');
        }
      })
      .catch(err => {
        setError(err.message);
        setMode('simple');
      });
  }, [curriculum, isLoaded]);

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
            <div className="flex items-center gap-4">
              <h1 className="text-heading text-text-primary">스킬맵</h1>
              <CurriculumToggle />
            </div>
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
                {curriculumLabel} — 총 {data.totalCount?.toLocaleString()}개 개념
              </p>

              {/* Physics 동기부여 카드 */}
              {!isKR && (
                <div className="mb-6">
                  <MotivationCard subject="physics" />
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {subjects.map(subject => {
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
                        {isKR ? subject.name : subject.nameEn || subject.name}
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
      <div className="px-4 py-2 bg-bg-card border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMode('simple')}
            className="text-caption text-text-secondary hover:text-text-primary"
          >
            간단 모드로 보기
          </button>
          <span className="text-caption text-text-tertiary">
            {curriculumLabel} — 총 {data?.totalCount?.toLocaleString()}개 개념
          </span>
        </div>
        <CurriculumToggle />
      </div>
      <ReactFlowCanvas initialData={data} curriculum={curriculum} subjects={subjects} />
    </div>
  );
}
