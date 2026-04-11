'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';

const SUBJECT_COLORS = {
  '국어': 'var(--subj-english)',
  '영어': 'var(--subj-physics)',
  '수학': 'var(--subj-math)',
  '사회': 'var(--subj-history)',
  '과학': 'var(--subj-chemistry)',
  '한국사': 'var(--subj-history)',
  '도덕': 'var(--subj-literature)',
};

const LEVEL_LABELS = {
  high: { ko: '고졸', emoji: '🎓', color: '#3b82f6' },
  mid: { ko: '중졸', emoji: '📚', color: '#10b981' },
  unknown: { ko: '초졸', emoji: '✏️', color: '#f59e0b' },
};

export default function GEDTestsPage() {
  const [tests, setTests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');

  useEffect(() => {
    fetch('/api/ged-tests')
      .then(res => res.json())
      .then(data => {
        setTests(data.tests || []);
        setStats(data.stats || null);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load GED tests:', err);
        setLoading(false);
      });
  }, []);

  const filteredTests = tests.filter(t => {
    if (selectedLevel !== 'all' && t.level !== selectedLevel) return false;
    if (selectedYear !== 'all' && t.year !== parseInt(selectedYear)) return false;
    if (selectedSubject !== 'all' && t.subject !== selectedSubject) return false;
    return true;
  });

  const years = [...new Set(tests.map(t => t.year))].sort((a, b) => b - a);
  const subjects = [...new Set(tests.map(t => t.subject))].sort();

  // Group tests by year and round
  const groupedTests = filteredTests.reduce((acc, test) => {
    const key = `${test.year}-${test.round}`;
    if (!acc[key]) {
      acc[key] = {
        year: test.year,
        round: test.round,
        tests: [],
      };
    }
    acc[key].tests.push(test);
    return acc;
  }, {});

  const sortedGroups = Object.values(groupedTests).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.round - a.round;
  });

  if (loading) {
    return (
      <DashboardLayout showSidebar={false}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-border-subtle border-t-text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href="/practice-tests" className="text-caption text-text-tertiary hover:text-text-secondary mb-2 inline-block">
            ← 실전 테스트
          </Link>
          <h1 className="text-display text-text-primary">검정고시 기출문제</h1>
          <p className="text-body text-text-secondary mt-2">
            2020-2025년 고졸/중졸/초졸 검정고시 기출문제
          </p>
        </div>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-text-primary">{stats.total}</div>
              <div className="text-caption text-text-secondary">총 시험</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-text-primary">{stats.totalQuestions.toLocaleString()}</div>
              <div className="text-caption text-text-secondary">총 문제</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-text-primary">{Object.keys(stats.byYear).length}</div>
              <div className="text-caption text-text-secondary">연도</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-text-primary">{Object.keys(stats.bySubject).length}</div>
              <div className="text-caption text-text-secondary">과목</div>
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* 학력 필터 */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-4 py-2 rounded-lg bg-bg-sidebar border border-border-subtle text-text-primary"
          >
            <option value="all">전체 학력</option>
            <option value="high">고졸</option>
            <option value="mid">중졸</option>
            <option value="unknown">초졸</option>
          </select>

          {/* 연도 필터 */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-4 py-2 rounded-lg bg-bg-sidebar border border-border-subtle text-text-primary"
          >
            <option value="all">전체 연도</option>
            {years.map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>

          {/* 과목 필터 */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-4 py-2 rounded-lg bg-bg-sidebar border border-border-subtle text-text-primary"
          >
            <option value="all">전체 과목</option>
            {subjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>

        {/* 결과 수 */}
        <div className="text-caption text-text-secondary mb-4">
          {filteredTests.length}개 시험
        </div>

        {/* 시험 그룹 */}
        <div className="space-y-6">
          {sortedGroups.map(group => (
            <div key={`${group.year}-${group.round}`} className="card overflow-hidden">
              {/* 그룹 헤더 */}
              <div className="p-4 bg-bg-sidebar border-b border-border-subtle">
                <h2 className="text-heading text-text-primary">
                  {group.year}년도 제{group.round}회 검정고시
                </h2>
              </div>

              {/* 과목별 시험 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
                {group.tests.map(test => (
                  <Link
                    key={test.id}
                    href={`/practice-tests/ged/${test.id}`}
                    className="block"
                  >
                    <div className="p-3 rounded-lg border border-border-subtle hover:border-text-tertiary hover:shadow-sm transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{LEVEL_LABELS[test.level]?.emoji || '📄'}</span>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: LEVEL_LABELS[test.level]?.color || '#666' }}
                        >
                          {test.levelKo}
                        </span>
                      </div>
                      <div
                        className="text-subheading font-medium mb-1"
                        style={{ color: SUBJECT_COLORS[test.subject] || 'var(--text-primary)' }}
                      >
                        {test.subject}
                      </div>
                      <div className="text-caption text-text-tertiary">
                        {test.totalQuestions}문제
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filteredTests.length === 0 && (
          <div className="text-center py-12 text-text-secondary">
            조건에 맞는 시험이 없습니다
          </div>
        )}

        {/* 안내 박스 */}
        <div className="mt-8 p-4 bg-info-light rounded-lg">
          <div className="flex gap-3">
            <span className="text-xl">📋</span>
            <div>
              <h3 className="text-subheading text-info mb-1">검정고시 안내</h3>
              <ul className="text-caption text-text-secondary space-y-1">
                <li>• 연 2회 실시 (4월, 8월)</li>
                <li>• 고졸/중졸/초졸 학력 취득 가능</li>
                <li>• 과목별 60점 이상 합격</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
