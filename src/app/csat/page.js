'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';

const CSAT_SUBJECTS = [
  { id: 'korean', name: '국어', emoji: '📖', color: 'var(--subj-english)', duration: 80, questions: 45 },
  { id: 'math', name: '수학', emoji: '🔢', color: 'var(--subj-math)', duration: 100, questions: 30 },
  { id: 'english', name: '영어', emoji: '🌐', color: 'var(--subj-physics)', duration: 70, questions: 45 },
  { id: 'korean_history', name: '한국사', emoji: '🏛️', color: 'var(--subj-chemistry)', duration: 30, questions: 20 },
  { id: 'social', name: '사회탐구', emoji: '🌍', color: 'var(--subj-biology)', duration: 30, questions: 20 },
  { id: 'science', name: '과학탐구', emoji: '🔬', color: 'var(--subj-chemistry)', duration: 30, questions: 20 },
];

const CHANGES_2028 = [
  {
    title: '국어 영역',
    changes: [
      '선택과목(화법과 작문, 언어와 매체) 통합',
      '공통 시험으로 전환',
      '독서, 문학 중심 출제',
    ],
    icon: '📖',
  },
  {
    title: '수학 영역',
    changes: [
      '공통(수학Ⅰ+수학Ⅱ) + 선택(확통/미적/기하) 구조 유지',
      '선택과목 영향력 조정',
      '킬러 문항 배제 기조',
    ],
    icon: '🔢',
  },
  {
    title: '영어 영역',
    changes: [
      '절대평가 유지 (9등급)',
      'EBS 연계율 50% 내외',
      '듣기 17문항 + 읽기 28문항',
    ],
    icon: '🌐',
  },
  {
    title: '탐구 영역',
    changes: [
      '사회/과학 최대 2과목 선택',
      '통합사회·통합과학 예시문항 신설',
      '직업탐구 영역 유지',
    ],
    icon: '🔬',
  },
];

const RESOURCES = [
  {
    name: 'EBSi',
    description: '수능 연계 강의 및 교재',
    url: 'https://www.ebsi.co.kr/',
    tags: ['무료', '연계'],
  },
  {
    name: '평가원 기출',
    description: '6월/9월 모의평가 + 수능 기출',
    url: 'https://www.suneung.re.kr/',
    tags: ['공식', '무료'],
  },
  {
    name: '교육청 모의고사',
    description: '3월/6월/9월/11월 전국연합',
    url: 'https://horaeng.com/',
    tags: ['무료', '기출'],
  },
];

export default function CSATPage() {
  const [strategies, setStrategies] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedArea, setSelectedArea] = useState({}); // 과목별 선택된 영역

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const res = await fetch('/data/strategy-db-csat.json');
        if (res.ok) {
          const data = await res.json();
          setStrategies(data);
        }
      } catch (e) {
        console.error('Failed to load CSAT strategies:', e);
      }
    };
    fetchStrategies();
  }, []);

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <Link href="/dashboard" className="text-caption text-text-tertiary hover:text-text-secondary mb-2 inline-block">
            ← 대시보드로 돌아가기
          </Link>
          <h1 className="text-display text-text-primary">수능 대비</h1>
          <p className="text-body text-text-secondary mt-2">
            대학수학능력시험 학습 가이드
          </p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex gap-2 mb-6 border-b border-border-subtle pb-2">
          {[
            { id: 'overview', label: '개요' },
            { id: 'changes', label: '2028 개편' },
            { id: 'subjects', label: '영역별 전략' },
            { id: 'resources', label: '학습 자료' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-t-lg text-caption font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-subj-english text-white'
                  : 'text-text-primary hover:bg-bg-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 개요 탭 */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 시험 구조 */}
            <div className="card p-6">
              <h2 className="text-heading text-text-primary mb-4">수능 구조</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {CSAT_SUBJECTS.map(subject => (
                  <div
                    key={subject.id}
                    className="p-4 rounded-lg border border-border-subtle"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{subject.emoji}</span>
                      <span className="text-subheading text-text-primary">{subject.name}</span>
                    </div>
                    <div className="text-caption text-text-tertiary">
                      {subject.duration}분 · {subject.questions}문항
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 등급 체계 */}
            <div className="card p-6">
              <h2 className="text-heading text-text-primary mb-4">등급 체계</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-caption">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left py-2 text-text-tertiary">등급</th>
                      <th className="text-left py-2 text-text-tertiary">비율 (상대평가)</th>
                      <th className="text-left py-2 text-text-tertiary">영어 (절대평가)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="py-2">1등급</td><td>상위 4%</td><td>90점 이상</td></tr>
                    <tr><td className="py-2">2등급</td><td>상위 11%</td><td>80점 이상</td></tr>
                    <tr><td className="py-2">3등급</td><td>상위 23%</td><td>70점 이상</td></tr>
                    <tr><td className="py-2">4등급</td><td>상위 40%</td><td>60점 이상</td></tr>
                    <tr><td className="py-2">5등급</td><td>상위 60%</td><td>50점 이상</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 일반 원칙 */}
            {strategies?.generalPrinciples && (
              <div className="card p-6 bg-info-light border-0">
                <h3 className="text-subheading text-info mb-3">출제 원칙</h3>
                <ul className="text-caption text-text-secondary space-y-1">
                  {strategies.generalPrinciples.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 2028 개편 탭 */}
        {activeTab === 'changes' && (
          <div className="space-y-4">
            <div className="card p-4 bg-warning-light border-0 mb-6">
              <div className="flex gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h3 className="text-subheading text-warning mb-1">2028 수능 개편</h3>
                  <p className="text-caption text-text-secondary">
                    2025년 고1부터 적용되는 2028 수능의 주요 변경 사항입니다.
                  </p>
                </div>
              </div>
            </div>

            {CHANGES_2028.map((item, idx) => (
              <div key={idx} className="card overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-subj-english to-subj-math" />
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{item.icon}</span>
                    <h3 className="text-heading text-text-primary">{item.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {item.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-2 text-body text-text-secondary">
                        <span className="text-success mt-1">✓</span>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 영역별 전략 탭 */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            {strategies?.subjects && Object.entries(strategies.subjects).map(([key, subject]) => {
              // 문항 유형에서 고유 영역 추출 (이름에서 " - " 앞 부분)
              const areas = ['전체'];
              if (subject.questionTypes) {
                const uniqueAreas = [...new Set(subject.questionTypes.map(qt => {
                  const parts = qt.name.split(' - ');
                  return parts.length > 1 ? parts[0] : '기타';
                }))];
                areas.push(...uniqueAreas);
              }

              const currentArea = selectedArea[key] || '전체';

              // 선택된 영역에 따라 문항 유형 필터링
              const filteredTypes = subject.questionTypes?.filter(qt => {
                if (currentArea === '전체') return true;
                return qt.name.startsWith(currentArea + ' - ') || qt.name.startsWith(currentArea);
              }) || [];

              return (
                <div key={key} className="card overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: CSAT_SUBJECTS.find(s => s.id === key)?.color || 'var(--subj-english)' }} />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-heading text-text-primary">{subject.name}</h3>
                      <span className="text-caption text-text-tertiary">
                        {subject.duration}분 · {subject.questions}문항
                      </span>
                    </div>

                    {/* 영역 탭 (클릭 가능) */}
                    {areas.length > 1 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {areas.map((area, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedArea(prev => ({ ...prev, [key]: area }))}
                            className={`px-3 py-1.5 rounded-lg text-caption font-medium transition-colors ${
                              currentArea === area
                                ? 'bg-text-primary text-white'
                                : 'bg-bg-sidebar text-text-primary hover:bg-bg-hover'
                            }`}
                          >
                            {area}
                            {area !== '전체' && (
                              <span className="ml-1 text-xs text-text-secondary">
                                ({subject.questionTypes?.filter(qt =>
                                  qt.name.startsWith(area + ' - ') || qt.name.startsWith(area)
                                ).length || 0})
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 문항 유형 (필터링 적용) */}
                    {filteredTypes.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-subheading text-text-secondary">
                          문항 유형 ({filteredTypes.length}개)
                        </h4>
                        {filteredTypes.map((qt, i) => (
                          <div key={i} className="p-3 bg-bg-sidebar rounded-lg">
                            <div className="text-ui font-medium text-text-primary mb-1">{qt.name}</div>
                            <p className="text-caption text-text-tertiary">{qt.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {filteredTypes.length === 0 && (
                      <p className="text-caption text-text-tertiary py-4 text-center">
                        해당 영역의 문항 유형이 없습니다.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 학습 자료 탭 */}
        {activeTab === 'resources' && (
          <div className="space-y-4">
            {/* 내부 테스트 링크 */}
            <div className="card p-4 mb-6">
              <h3 className="text-heading text-text-primary mb-3">연습 문제</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/practice-tests/quiz?subject=korean" className="p-4 bg-bg-sidebar rounded-lg hover:bg-bg-hover transition-colors">
                  <div className="text-2xl mb-2">📖</div>
                  <div className="text-subheading text-text-primary">국어 미니 퀴즈</div>
                  <div className="text-caption text-text-tertiary">10문제 · 15분</div>
                </Link>
                <Link href="/practice-tests/quiz?subject=math" className="p-4 bg-bg-sidebar rounded-lg hover:bg-bg-hover transition-colors">
                  <div className="text-2xl mb-2">🔢</div>
                  <div className="text-subheading text-text-primary">수학 미니 퀴즈</div>
                  <div className="text-caption text-text-tertiary">10문제 · 15분</div>
                </Link>
              </div>
            </div>

            {/* 외부 리소스 */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-border-subtle">
                <h3 className="text-heading text-text-primary">외부 학습 자료</h3>
              </div>
              <div className="divide-y divide-border-subtle">
                {RESOURCES.map((resource, idx) => (
                  <a
                    key={idx}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 hover:bg-bg-sidebar transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-subheading text-text-primary mb-1">{resource.name}</div>
                        <p className="text-caption text-text-secondary mb-2">{resource.description}</p>
                        <div className="flex gap-1">
                          {resource.tags.map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-bg-hover rounded-full text-xs text-text-tertiary">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 팁 박스 */}
        <div className="mt-8 p-4 bg-success-light rounded-lg">
          <div className="flex gap-3">
            <span className="text-xl">💡</span>
            <div>
              <h3 className="text-subheading text-success mb-1">학습 팁</h3>
              <ul className="text-caption text-text-secondary space-y-1">
                <li>• 기출 분석이 가장 중요 - 최근 5년 기출 반복</li>
                <li>• EBS 연계 교재 병행 학습</li>
                <li>• 모의고사는 실전처럼 시간 재고 풀기</li>
                <li>• 오답노트 정리 필수</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
