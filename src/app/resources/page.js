'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export default function ResourcesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    category: 'all',
    level: 'all',
    platform: 'all',
    search: '',
  });

  // 강의 데이터 로드
  useEffect(() => {
    fetch('/data/university_courses.json')
      .then(res => res.json())
      .then(data => {
        setCourses(data || []);
      })
      .catch(err => console.error('Failed to load courses:', err))
      .finally(() => setLoading(false));
  }, []);

  // 필터 옵션 계산
  const filterOptions = useMemo(() => {
    const categories = [...new Set(courses.map(c => c.category))].filter(Boolean);
    const levels = [...new Set(courses.map(c => c.level))].filter(Boolean);
    const platforms = [...new Set(courses.map(c => c.platform))].filter(Boolean);
    return { categories, levels, platforms };
  }, [courses]);

  // 필터링된 강의
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      if (filter.category !== 'all' && course.category !== filter.category) return false;
      if (filter.level !== 'all' && course.level !== filter.level) return false;
      if (filter.platform !== 'all' && course.platform !== filter.platform) return false;
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        return (
          course.title?.toLowerCase().includes(searchLower) ||
          course.university?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [courses, filter]);

  // 카테고리별 그룹핑
  const groupedCourses = useMemo(() => {
    const groups = {};
    filteredCourses.forEach(course => {
      const cat = course.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(course);
    });
    return groups;
  }, [filteredCourses]);

  const categoryLabels = {
    physics: '물리학',
    mathematics: '수학',
    chemistry: '화학',
    cs: '컴퓨터과학',
    biology: '생물학',
    other: '기타',
  };

  const levelLabels = {
    intro: '입문',
    intermediate: '중급',
    advanced: '고급',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-subj-math border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-text-tertiary">강의 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main">
      {/* Header */}
      <header className="sticky top-0 bg-bg-card border-b border-border-subtle z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-text-tertiary hover:text-text-primary">
              ← 대시보드
            </Link>
          </div>
          <h1 className="text-title text-text-primary mt-2">🎓 대학 강의 모음</h1>
          <p className="text-body text-text-tertiary mt-1">
            MIT, Stanford, Yale 등 세계 최고 대학의 무료 강의를 찾아보세요
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 검색 */}
            <div className="col-span-2 md:col-span-4">
              <input
                type="text"
                placeholder="강의 또는 대학 검색..."
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                className="w-full px-4 py-2 border border-border-subtle rounded-lg bg-bg-main focus:outline-none focus:ring-2 focus:ring-subj-math"
              />
            </div>

            {/* 카테고리 필터 */}
            <select
              value={filter.category}
              onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border border-border-subtle rounded-lg bg-bg-main text-body"
            >
              <option value="all">모든 분야</option>
              {filterOptions.categories.map(cat => (
                <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
              ))}
            </select>

            {/* 난이도 필터 */}
            <select
              value={filter.level}
              onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value }))}
              className="px-3 py-2 border border-border-subtle rounded-lg bg-bg-main text-body"
            >
              <option value="all">모든 난이도</option>
              {filterOptions.levels.map(lvl => (
                <option key={lvl} value={lvl}>{levelLabels[lvl] || lvl}</option>
              ))}
            </select>

            {/* 플랫폼 필터 */}
            <select
              value={filter.platform}
              onChange={(e) => setFilter(prev => ({ ...prev, platform: e.target.value }))}
              className="px-3 py-2 border border-border-subtle rounded-lg bg-bg-main text-body"
            >
              <option value="all">모든 플랫폼</option>
              {filterOptions.platforms.map(plat => (
                <option key={plat} value={plat}>{plat}</option>
              ))}
            </select>

            {/* 필터 초기화 */}
            <button
              onClick={() => setFilter({ category: 'all', level: 'all', platform: 'all', search: '' })}
              className="px-3 py-2 text-caption text-text-tertiary hover:text-text-primary"
            >
              필터 초기화
            </button>
          </div>
        </div>

        {/* 결과 개수 */}
        <div className="text-caption text-text-tertiary mb-4">
          총 {filteredCourses.length}개 강의
        </div>

        {/* 강의 목록 */}
        {Object.entries(groupedCourses).map(([category, categoryCourses]) => (
          <div key={category} className="mb-8">
            <h2 className="text-heading text-text-primary mb-4 flex items-center gap-2">
              <span>
                {category === 'physics' ? '⚛️' :
                 category === 'mathematics' ? '📐' :
                 category === 'chemistry' ? '🧪' :
                 category === 'cs' ? '💻' :
                 category === 'biology' ? '🧬' : '📚'}
              </span>
              {categoryLabels[category] || category}
              <span className="text-caption text-text-tertiary font-normal">
                ({categoryCourses.length})
              </span>
            </h2>

            <div className="space-y-2">
              {categoryCourses.map((course, idx) => (
                <a
                  key={course.course_id || idx}
                  href={course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block card p-4 hover:bg-bg-hover transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Platform Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-bg-sidebar flex items-center justify-center text-xl">
                      {course.platform === 'YouTube' ? '▶️' :
                       course.platform === 'MIT_OCW' ? '🎓' :
                       course.platform === 'Yale_OCW' ? '🎓' :
                       course.platform === 'UCI_OCW' ? '🎓' :
                       course.platform === 'Coursera' ? '📚' :
                       course.platform === 'edX' ? '📚' : '🔗'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-body text-text-primary font-medium truncate">
                        {course.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-caption text-text-tertiary">
                        <span className="font-medium">{course.university}</span>
                        <span>·</span>
                        <span>{course.platform}</span>
                        <span>·</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          course.level === 'intro' ? 'bg-green-100 text-green-700' :
                          course.level === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {levelLabels[course.level] || course.level}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <span className="text-text-tertiary flex-shrink-0">→</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}

        {filteredCourses.length === 0 && (
          <div className="text-center py-12 text-text-tertiary">
            검색 결과가 없습니다
          </div>
        )}
      </main>
    </div>
  );
}
