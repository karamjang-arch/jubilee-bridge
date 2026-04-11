'use client';

import { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import CurriculumToggle from '@/components/CurriculumToggle';
import { useProfile } from '@/hooks/useProfile';
import { useCurriculum, CURRICULUM_US, CURRICULUM_KR } from '@/hooks/useCurriculum';

// US 테스트 목록
const TESTS_US = [
  {
    id: 'quiz-us',
    name: '미니 모의고사',
    href: '/practice-tests/quiz',
    emoji: '🎯',
    gradient: 'from-subj-math to-subj-english',
    bgColor: 'bg-subj-math-light',
    description: '10문제 · 15분 · 즉시 채점',
    gradeRange: [5, 12],
    difficulty: 1,
  },
  {
    id: 'sat',
    name: 'SAT 모의고사',
    href: '/practice-tests/sat',
    emoji: '📝',
    gradient: 'from-blue-600 to-blue-400',
    bgColor: 'bg-blue-100',
    description: '7세트 · CollegeBoard 공식',
    gradeRange: [10, 12],
    difficulty: 3,
  },
  {
    id: 'psat-nmsqt',
    name: 'PSAT/NMSQT',
    href: '/practice-tests/psat?type=nmsqt',
    emoji: '📋',
    gradient: 'from-purple-600 to-purple-400',
    bgColor: 'bg-purple-100',
    description: '2세트 · 고1~고2 대상',
    gradeRange: [10, 11],
    difficulty: 2,
  },
  {
    id: 'psat-89',
    name: 'PSAT 8/9',
    href: '/practice-tests/psat?type=8-9',
    emoji: '📋',
    gradient: 'from-indigo-500 to-indigo-400',
    bgColor: 'bg-indigo-100',
    description: '2세트 · 중2~중3 대상',
    gradeRange: [7, 9],
    difficulty: 2,
  },
];

// 한국 테스트 목록
const TESTS_KR = [
  {
    id: 'quiz-kr',
    name: '미니 모의고사',
    href: '/practice-tests/quiz?curriculum=kr',
    emoji: '🎯',
    gradient: 'from-subj-math to-subj-korean',
    bgColor: 'bg-subj-math-light',
    description: '10문제 · 15분 · 즉시 채점',
    gradeRange: [5, 12],
    difficulty: 1,
  },
  {
    id: 'csat-past',
    name: '수능 기출',
    href: '/practice-tests/korean?type=csat',
    emoji: '📚',
    gradient: 'from-red-600 to-red-400',
    bgColor: 'bg-red-100',
    description: '역대 수능 기출문제',
    gradeRange: [11, 12],
    difficulty: 3,
  },
  {
    id: 'mock-kice',
    name: '평가원 모의평가',
    href: '/practice-tests/korean?type=kice',
    emoji: '📊',
    gradient: 'from-orange-500 to-orange-400',
    bgColor: 'bg-orange-100',
    description: '6월/9월 모의평가',
    gradeRange: [11, 12],
    difficulty: 3,
  },
  {
    id: 'mock-edu',
    name: '교육청 모의고사',
    href: '/practice-tests/korean?type=edu',
    emoji: '🏫',
    gradient: 'from-amber-500 to-amber-400',
    bgColor: 'bg-amber-100',
    description: '3월/6월/9월/11월',
    gradeRange: [10, 12],
    difficulty: 2,
  },
  {
    id: 'ged',
    name: '검정고시',
    href: '/practice-tests/ged',
    emoji: '📖',
    gradient: 'from-teal-500 to-teal-400',
    bgColor: 'bg-teal-100',
    description: '고졸/중졸/초졸 기출',
    gradeRange: [5, 12],
    difficulty: 2,
  },
];

// 외부 리소스 (US)
const RESOURCES_US = [
  {
    category: 'SAT',
    emoji: '📝',
    color: '#1e88e5',
    tests: [
      { name: 'Khan Academy SAT', description: '공식 무료 연습', url: 'https://www.khanacademy.org/sat', tags: ['공식', '무료'] },
      { name: 'CollegeBoard Bluebook', description: '공식 디지털 SAT', url: 'https://satsuite.collegeboard.org/digital/digital-practice-preparation', tags: ['공식'] },
    ],
  },
  {
    category: 'AP',
    emoji: '🎓',
    color: '#7b1fa2',
    tests: [
      { name: 'AP Classroom', description: 'CollegeBoard 공식', url: 'https://apclassroom.collegeboard.org/', tags: ['공식'] },
      { name: 'Albert.io', description: '과목별 연습', url: 'https://www.albert.io/', tags: ['유료'] },
    ],
  },
];

// 외부 리소스 (한국)
const RESOURCES_KR = [
  {
    category: '수능/모의고사',
    emoji: '📚',
    color: '#c62828',
    tests: [
      { name: 'EBSi', description: '수능 연계 강의', url: 'https://www.ebsi.co.kr/', tags: ['무료', '연계'] },
      { name: '평가원 기출', description: '공식 기출문제', url: 'https://www.suneung.re.kr/', tags: ['공식', '무료'] },
    ],
  },
  {
    category: '학습 자료',
    emoji: '📖',
    color: '#ef6c00',
    tests: [
      { name: '호랭이', description: '교육청 모의고사', url: 'https://horaeng.com/', tags: ['무료'] },
      { name: '오르비', description: '입시 커뮤니티', url: 'https://orbi.kr/', tags: ['커뮤니티'] },
    ],
  },
];

// 학년 표시 변환
function gradeToLabel(gradeRange) {
  const [min, max] = gradeRange;
  const labels = { 5: '초5', 6: '초6', 7: '중1', 8: '중2', 9: '중3', 10: '고1', 11: '고2', 12: '고3' };
  if (min === max) return labels[min] || `${min}학년`;
  return `${labels[min]}~${labels[max]}`;
}

// 난이도 별 표시
function difficultyStars(level) {
  return '★'.repeat(level) + '☆'.repeat(3 - level);
}

export default function PracticeTestsPage() {
  const { profile } = useProfile();
  const { curriculum, isKR, curriculumLabel } = useCurriculum();
  const [selectedCategory, setSelectedCategory] = useState('all');

  // 교육과정별 테스트/리소스 선택
  const tests = isKR ? TESTS_KR : TESTS_US;
  const resources = isKR ? RESOURCES_KR : RESOURCES_US;

  // 학생 학년 (기본값: 10학년)
  const studentGrade = profile?.grade || 10;

  // 추천 여부 판단
  const getRecommendation = (test) => {
    const [min, max] = test.gradeRange;
    if (studentGrade >= min && studentGrade <= max) return 'recommended';
    if (studentGrade >= min - 1 && studentGrade <= max + 1) return 'challenge';
    return null;
  };

  // 테스트 정렬: 추천 > 도전 > 나머지
  const sortedTests = [...tests].sort((a, b) => {
    const recA = getRecommendation(a);
    const recB = getRecommendation(b);
    const order = { recommended: 0, challenge: 1, null: 2 };
    return (order[recA] ?? 2) - (order[recB] ?? 2);
  });

  const filteredResources = selectedCategory === 'all'
    ? resources
    : resources.filter(r => r.category === selectedCategory);

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href="/dashboard" className="text-caption text-text-tertiary hover:text-text-secondary mb-2 inline-block">
            ← 대시보드로 돌아가기
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-display text-text-primary">실전 테스트 허브</h1>
              <p className="text-body text-text-secondary mt-1">
                {isKR ? '수능 · 모의고사 · 검정고시' : 'SAT · PSAT · AP'}
              </p>
            </div>
            <CurriculumToggle />
          </div>
        </div>

        {/* 테스트 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {sortedTests.map((test) => {
            const recommendation = getRecommendation(test);
            return (
              <Link key={test.id} href={test.href} className="block">
                <div className="card overflow-hidden hover:shadow-card-hover transition-shadow h-full relative">
                  <div className={`h-2 bg-gradient-to-r ${test.gradient}`} />

                  {/* 추천/도전 배지 */}
                  {recommendation && (
                    <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      recommendation === 'recommended'
                        ? 'bg-success text-white'
                        : 'bg-amber-500 text-white'
                    }`}>
                      {recommendation === 'recommended' ? '추천' : '도전'}
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`w-12 h-12 rounded-full ${test.bgColor} flex items-center justify-center`}>
                        <span className="text-2xl">{test.emoji}</span>
                      </div>
                      <div>
                        <h2 className="text-subheading text-text-primary">{test.name}</h2>
                        <p className="text-caption text-text-secondary">{test.description}</p>
                      </div>
                    </div>

                    {/* 대상 학년 + 난이도 */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border-subtle">
                      <span className="text-text-secondary font-medium">{gradeToLabel(test.gradeRange)}</span>
                      <span className="text-amber-600 font-medium">{difficultyStars(test.difficulty)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 외부 리소스 섹션 */}
        <div className="mb-6">
          <h2 className="text-heading text-text-primary mb-4">외부 학습 자료</h2>

          {/* 카테고리 필터 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg text-caption font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-text-primary text-white'
                  : 'bg-bg-sidebar text-text-primary hover:bg-bg-hover'
              }`}
            >
              전체
            </button>
            {resources.map(resource => (
              <button
                key={resource.category}
                onClick={() => setSelectedCategory(resource.category)}
                className={`px-4 py-2 rounded-lg text-caption font-medium transition-colors ${
                  selectedCategory === resource.category
                    ? 'text-white'
                    : 'bg-bg-sidebar text-text-primary hover:bg-bg-hover'
                }`}
                style={selectedCategory === resource.category ? { backgroundColor: resource.color } : {}}
              >
                {resource.emoji} {resource.category}
              </button>
            ))}
          </div>

          {/* 리소스 목록 */}
          <div className="space-y-4">
            {filteredResources.map(resource => (
              <div key={resource.category} className="card overflow-hidden">
                <div className="h-1" style={{ backgroundColor: resource.color }} />
                <div className="p-4 border-b border-border-subtle flex items-center gap-3">
                  <span className="text-xl">{resource.emoji}</span>
                  <h3 className="text-subheading text-text-primary">{resource.category}</h3>
                </div>
                <div className="divide-y divide-border-subtle">
                  {resource.tests.map((test, idx) => (
                    <a
                      key={idx}
                      href={test.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 hover:bg-bg-sidebar transition-colors"
                    >
                      <div>
                        <div className="text-ui font-medium text-text-primary mb-1">{test.name}</div>
                        <p className="text-caption text-text-secondary">{test.description}</p>
                        <div className="flex gap-1 mt-2">
                          {test.tags.map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-bg-hover text-text-secondary text-xs rounded-full font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-text-tertiary flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 팁 박스 */}
        <div className="p-4 bg-info-light rounded-lg">
          <div className="flex gap-3">
            <span className="text-xl">💡</span>
            <div>
              <h3 className="text-subheading text-info font-semibold mb-1">효과적인 연습 팁</h3>
              <ul className="text-caption text-text-secondary space-y-1">
                <li>• 시간을 재고 실전처럼 풀기</li>
                <li>• 틀린 문제는 반드시 오답 노트 정리</li>
                <li>• 스킬맵에서 약점 개념 다시 학습</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
