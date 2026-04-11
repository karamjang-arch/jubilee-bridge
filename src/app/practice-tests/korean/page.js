'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';

const SUBJECT_INFO = {
  '국어': { emoji: '📖', color: 'var(--subj-english)' },
  '수학': { emoji: '🔢', color: 'var(--subj-math)' },
  '영어': { emoji: '🌐', color: 'var(--subj-physics)' },
};

export default function KoreanTestsPage() {
  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await fetch('/api/korean-tests');
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

  const years = [...new Set(tests.map(t => t.year))].sort((a, b) => b - a);
  const subjects = [...new Set(tests.map(t => t.subject))];

  const filteredTests = tests.filter(t => {
    if (selectedYear !== 'all' && t.year !== parseInt(selectedYear)) return false;
    if (selectedSubject !== 'all' && t.subject !== selectedSubject) return false;
    return true;
  });

  // Group by year and month
  const groupedTests = filteredTests.reduce((acc, test) => {
    const key = `${test.year}-${test.month}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(test);
    return acc;
  }, {});

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/practice-tests" className="text-caption text-text-tertiary hover:text-text-secondary mb-4 inline-block">
          ← 실전 테스트 허브
        </Link>

        <div className="mb-6">
          <h1 className="text-display text-text-primary">교육청 모의고사</h1>
          <p className="text-body text-text-secondary mt-2">
            전국연합학력평가 기출문제
          </p>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="text-caption text-text-tertiary block mb-1">년도</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 rounded-lg bg-bg-sidebar text-text-primary border border-border-subtle"
            >
              <option value="all">전체</option>
              {years.map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-caption text-text-tertiary block mb-1">과목</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2 rounded-lg bg-bg-sidebar text-text-primary border border-border-subtle"
            >
              <option value="all">전체</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="card p-8 text-center text-text-tertiary">
            모의고사 목록 로딩 중...
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="card p-8 text-center text-text-tertiary">
            해당 조건의 모의고사가 없습니다.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTests)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([key, testsInGroup]) => {
                const [year, month] = key.split('-');
                return (
                  <div key={key} className="card overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500" />
                    <div className="p-4 border-b border-border-subtle bg-bg-sidebar">
                      <h2 className="text-heading text-text-primary">
                        {year}학년도 {month}월 모의고사
                      </h2>
                    </div>
                    <div className="divide-y divide-border-subtle">
                      {testsInGroup.map(test => {
                        const subjectInfo = SUBJECT_INFO[test.subject] || { emoji: '📄', color: 'gray' };
                        return (
                          <Link
                            key={test.id}
                            href={`/practice-tests/korean/${test.id}`}
                            className="block p-4 hover:bg-bg-hover transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{subjectInfo.emoji}</span>
                                <div>
                                  <div className="text-subheading text-text-primary">{test.subject}</div>
                                  <div className="text-caption text-text-tertiary">
                                    {test.totalQuestions}문항
                                  </div>
                                </div>
                              </div>
                              <div
                                className="px-3 py-1 rounded-full text-white text-caption"
                                style={{ backgroundColor: subjectInfo.color }}
                              >
                                시작
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* 통계 */}
        <div className="mt-6 p-4 bg-bg-sidebar rounded-lg">
          <div className="flex items-center justify-between text-caption text-text-tertiary">
            <span>총 {tests.length}개 시험</span>
            <span>{tests.reduce((sum, t) => sum + t.totalQuestions, 0)}문항</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
