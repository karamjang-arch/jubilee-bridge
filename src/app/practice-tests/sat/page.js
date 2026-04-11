'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';

export default function SATTestsPage() {
  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await fetch('/api/sat-tests');
        const data = await res.json();
        setTests(data.tests || []);
      } catch (error) {
        console.error('Failed to load tests:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTests();
  }, []);

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/practice-tests" className="text-caption text-text-tertiary hover:text-text-secondary mb-4 inline-block">
          ← 실전 테스트 허브
        </Link>

        <div className="mb-6">
          <h1 className="text-display text-text-primary">SAT 모의고사</h1>
          <p className="text-body text-text-secondary mt-2">
            College Board 공식 Practice Test
          </p>
        </div>

        {/* SAT 구조 안내 */}
        <div className="card p-4 mb-6 bg-info-light border-0">
          <h3 className="text-subheading text-info mb-2">Digital SAT 구조</h3>
          <div className="grid grid-cols-2 gap-4 text-caption text-text-secondary">
            <div>
              <strong className="text-text-primary">Reading & Writing</strong>
              <p>Module 1: 27문제 (32분)</p>
              <p>Module 2: 27문제 (32분)</p>
            </div>
            <div>
              <strong className="text-text-primary">Math</strong>
              <p>Module 1: 22문제 (35분)</p>
              <p>Module 2: 22문제 (35분)</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="card p-8 text-center text-text-tertiary">
            모의고사 목록 로딩 중...
          </div>
        ) : tests.length === 0 ? (
          <div className="card p-8 text-center text-text-tertiary">
            아직 변환된 모의고사가 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map(test => (
              <div key={test.id} className="card overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-subj-english to-subj-math" />
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

                  {/* 섹션별 시작 버튼 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-bg-sidebar rounded-lg">
                      <div className="text-ui font-medium text-subj-english mb-2">Reading & Writing</div>
                      <div className="flex gap-2">
                        <Link
                          href={`/practice-tests/sat/${test.id}?section=rw&module=1`}
                          className="flex-1 py-2 px-3 bg-subj-english text-white rounded text-caption text-center hover:opacity-90"
                        >
                          M1 ({test.sections.reading_writing.module1})
                        </Link>
                        <Link
                          href={`/practice-tests/sat/${test.id}?section=rw&module=2`}
                          className="flex-1 py-2 px-3 bg-subj-english text-white rounded text-caption text-center hover:opacity-90"
                        >
                          M2 ({test.sections.reading_writing.module2})
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
                          M1 ({test.sections.math.module1})
                        </Link>
                        <Link
                          href={`/practice-tests/sat/${test.id}?section=math&module=2`}
                          className="flex-1 py-2 px-3 bg-subj-math text-white rounded text-caption text-center hover:opacity-90"
                        >
                          M2 ({test.sections.math.module2})
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
