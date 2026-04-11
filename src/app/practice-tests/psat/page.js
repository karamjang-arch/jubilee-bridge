'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';

export default function PSATTestsPage() {
  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await fetch('/api/sat-tests');
        const data = await res.json();
        // Filter only PSAT tests
        const psatTests = (data.tests || []).filter(t => t.id.startsWith('psat'));
        setTests(psatTests);
      } catch (error) {
        console.error('Failed to load tests:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTests();
  }, []);

  const filteredTests = selectedType === 'all'
    ? tests
    : tests.filter(t => t.id.includes(selectedType));

  const testTypes = [
    { id: 'all', label: '전체' },
    { id: 'nmsqt', label: 'PSAT/NMSQT' },
    { id: '10', label: 'PSAT 10' },
    { id: '8-9', label: 'PSAT 8/9' },
  ];

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/practice-tests" className="text-caption text-text-tertiary hover:text-text-secondary mb-4 inline-block">
          ← 실전 테스트 허브
        </Link>

        <div className="mb-6">
          <h1 className="text-display text-text-primary">PSAT 모의고사</h1>
          <p className="text-body text-text-secondary mt-2">
            College Board 공식 Practice Test
          </p>
        </div>

        {/* PSAT 유형 안내 */}
        <div className="card p-4 mb-6 bg-info-light border-0">
          <h3 className="text-subheading text-info mb-2">PSAT 종류</h3>
          <div className="grid grid-cols-3 gap-4 text-caption text-text-secondary">
            <div>
              <strong className="text-text-primary">PSAT/NMSQT</strong>
              <p>11학년 대상 (장학금 경쟁)</p>
            </div>
            <div>
              <strong className="text-text-primary">PSAT 10</strong>
              <p>10학년 대상</p>
            </div>
            <div>
              <strong className="text-text-primary">PSAT 8/9</strong>
              <p>8-9학년 대상</p>
            </div>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex gap-2 mb-6">
          {testTypes.map(type => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`px-4 py-2 rounded-lg text-caption transition-colors ${
                selectedType === type.id
                  ? 'bg-subj-english text-white'
                  : 'bg-bg-sidebar text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="card p-8 text-center text-text-tertiary">
            모의고사 목록 로딩 중...
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="card p-8 text-center text-text-tertiary">
            해당 유형의 모의고사가 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTests.map(test => (
              <div key={test.id} className="card overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-purple-500 to-subj-english" />
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-heading text-text-primary">{test.name}</h2>
                      <p className="text-caption text-text-tertiary">{test.source}</p>
                    </div>
                    <span className="px-3 py-1 bg-bg-sidebar rounded-full text-caption text-text-secondary">
                      {test.totalQuestions}문제
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-bg-sidebar rounded-lg">
                      <div className="text-ui font-medium text-subj-english mb-2">Reading & Writing</div>
                      <div className="flex gap-2">
                        <Link
                          href={`/practice-tests/sat/${test.id}?section=rw&module=1`}
                          className="flex-1 py-2 px-3 bg-subj-english text-white rounded text-caption text-center hover:opacity-90"
                        >
                          M1 ({test.sections?.reading_writing?.module1 || 0})
                        </Link>
                        <Link
                          href={`/practice-tests/sat/${test.id}?section=rw&module=2`}
                          className="flex-1 py-2 px-3 bg-subj-english text-white rounded text-caption text-center hover:opacity-90"
                        >
                          M2 ({test.sections?.reading_writing?.module2 || 0})
                        </Link>
                      </div>
                    </div>

                    <div className="p-3 bg-bg-sidebar rounded-lg">
                      <div className="text-ui font-medium text-subj-math mb-2">Math</div>
                      <div className="flex gap-2">
                        <Link
                          href={`/practice-tests/sat/${test.id}?section=math&module=1`}
                          className="flex-1 py-2 px-3 bg-subj-math text-white rounded text-caption text-center hover:opacity-90"
                        >
                          M1 ({test.sections?.math?.module1 || 0})
                        </Link>
                        <Link
                          href={`/practice-tests/sat/${test.id}?section=math&module=2`}
                          className="flex-1 py-2 px-3 bg-subj-math text-white rounded text-caption text-center hover:opacity-90"
                        >
                          M2 ({test.sections?.math?.module2 || 0})
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
