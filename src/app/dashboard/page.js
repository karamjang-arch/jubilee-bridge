'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import DevotionCard from '@/components/DevotionCard';
import MemorizationCard from '@/components/MemorizationCard';
import CurriculumToggle from '@/components/CurriculumToggle';
import StudentManagement from '@/components/StudentManagement';
import { DailyMissions, XpToast, BadgeCelebration } from '@/components/gamification';
import HomeworkScanner from '@/components/HomeworkScanner';
import { TOTAL_CONCEPTS } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useGamification } from '@/hooks/useGamification';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const { profile, studentId, isAdmin } = useProfile();
  const { curriculum, curriculumLabel, isKR } = useCurriculum();
  const [streak, setStreak] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [totalConcepts, setTotalConcepts] = useState(TOTAL_CONCEPTS);
  const [isLoading, setIsLoading] = useState(true);
  const [wordSettings, setWordSettings] = useState(null);
  const [showHomeworkScanner, setShowHomeworkScanner] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [showDevotion, setShowDevotion] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [recommendedConcept, setRecommendedConcept] = useState(null);
  const [conceptSearch, setConceptSearch] = useState('');
  const [conceptResults, setConceptResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Gamification hook
  const {
    totalXp,
    level,
    nextLevel,
    streak: gamificationStreak,
    missions,
    completedMissions,
    allMissionsComplete,
    xpGain,
    currentNewBadge,
  } = useGamification(studentId);

  // 온보딩 체크
  useEffect(() => {
    if (!studentId || isAdmin) return;
    const onboardingCompleted = localStorage.getItem('jb_onboarding_completed');
    if (onboardingCompleted !== studentId) {
      router.replace('/onboarding');
    }
  }, [studentId, isAdmin, router]);

  // 데이터 로드
  useEffect(() => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // concept_progress에서 mastered 개수
        const progressRes = await fetch(`/api/sheets?tab=concept_progress&student=${studentId}`);
        const progressData = await progressRes.json();
        const mastered = progressData.data?.filter(p => {
          const isMastered = p.status === 'mastered' || p.status === 'placement_mastered';
          if (!isMastered) return false;
          const isKoreanConcept = p.concept_id?.startsWith('KR-');
          return isKR ? isKoreanConcept : !isKoreanConcept;
        }) || [];
        setMasteredCount(mastered.length);

        // 스트릭 계산
        const timerRes = await fetch(`/api/sheets?tab=study_timer&student=${studentId}`);
        const timerData = await timerRes.json();
        const studyDays = timerData.data?.map(t => t.date) || [];
        const uniqueDays = [...new Set(studyDays)].sort().reverse();
        let streakCount = 0;
        for (let i = 0; i < uniqueDays.length; i++) {
          const expectedDate = new Date();
          expectedDate.setDate(expectedDate.getDate() - i);
          const expected = expectedDate.toISOString().split('T')[0];
          if (uniqueDays[i] === expected) {
            streakCount++;
          } else {
            break;
          }
        }
        setStreak(streakCount);

        // 단어 설정
        const savedWordSettings = localStorage.getItem(`jb_word_settings_${studentId}`);
        if (savedWordSettings) {
          setWordSettings(JSON.parse(savedWordSettings));
        }

        // 토큰 로드
        const storageKey = `jb_game_tokens_${studentId}`;
        const localTokens = parseInt(localStorage.getItem(storageKey) || '0');
        setTokens(localTokens > 0 ? localTokens : 3);

        // 추천 개념 (available 상태 중 하나)
        const conceptsRes = await fetch(`/api/concepts?curriculum=${curriculum}&limit=100`);
        const conceptsData = await conceptsRes.json();
        if (conceptsData.concepts?.length > 0) {
          const masteredIds = new Set(mastered.map(p => p.concept_id));
          const available = conceptsData.concepts.find(c => !masteredIds.has(c.id));
          if (available) {
            setRecommendedConcept(available);
          }
        }

      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [studentId, isKR, curriculum]);

  // 교육과정별 총 개념 수
  useEffect(() => {
    const fetchTotalConcepts = async () => {
      try {
        const res = await fetch(`/api/concepts?summary=true&curriculum=${curriculum}`);
        const data = await res.json();
        if (data.totalCount) {
          setTotalConcepts(data.totalCount);
        }
      } catch (error) {
        setTotalConcepts(TOTAL_CONCEPTS);
      }
    };
    fetchTotalConcepts();
  }, [curriculum]);

  const wordDayNum = wordSettings ? Math.ceil(
    (new Date() - new Date(wordSettings.startDate)) / (1000 * 60 * 60 * 24)
  ) + 1 : 1;

  const currentStreak = gamificationStreak || streak;
  const currentLevel = typeof level === 'object' ? level.level : level;
  const xpProgress = nextLevel?.xpNeeded ? ((totalXp % 500) / nextLevel.xpNeeded * 100) : (nextLevel?.progress || 50);

  // 개념 검색
  useEffect(() => {
    if (!conceptSearch.trim()) { setConceptResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/concepts?search=${encodeURIComponent(conceptSearch)}&curriculum=${curriculum}&limit=5`);
        const data = await res.json();
        setConceptResults(data.concepts || []);
      } catch { setConceptResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [conceptSearch, curriculum]);

  // 바로가기 아이템
  const quickLinks = [
    { icon: '📝', label: '모의고사', href: '/practice-tests', color: 'text-subj-math' },
    { icon: '🗺️', label: '스킬맵', href: '/skillmap', color: 'text-subj-science' },
    { icon: '📸', label: '숙제 분석', onClick: () => setShowHomeworkScanner(true), color: 'text-info' },
    { icon: '🏆', label: '랭킹', href: '/leaderboard', color: 'text-warning' },
    { icon: '🎮', label: '아케이드', href: '/arcade', color: 'text-danger' },
    { icon: '📊', label: '내 기록', href: '/records', color: 'text-subj-history' },
    { icon: '🤖', label: 'AI 튜터', href: '/skillmap', color: 'text-subj-english' },
  ];

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        {/* XP Toast & Badge Celebration */}
        {xpGain && <XpToast xpGain={xpGain} />}
        {currentNewBadge && <BadgeCelebration badge={currentNewBadge} onClose={() => {}} />}

        {/* 헤더: 교육과정 토글 */}
        <div className="flex items-center justify-between">
          <h1 className="text-heading text-text-primary">대시보드</h1>
          <div className="flex items-center gap-2">
            <span className="text-caption text-text-tertiary hidden sm:inline">{curriculumLabel}</span>
            <CurriculumToggle />
          </div>
        </div>

        {/* ========== 섹션 1: 오늘의 할 일 ========== */}
        <section className="bg-gradient-to-br from-info/10 to-info/5 border border-info/20 rounded-2xl p-5 space-y-4">
          <h2 className="text-subheading text-text-primary flex items-center gap-2">
            <span className="text-xl">🎯</span> 오늘의 할 일
          </h2>

          {/* 오늘의 단어 */}
          <Link
            href="/words"
            className="flex items-center justify-between p-4 bg-bg-card rounded-xl hover:bg-bg-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📖</span>
              <div>
                <div className="text-body text-text-primary font-medium">오늘의 단어</div>
                <div className="text-caption text-text-tertiary">
                  {wordSettings
                    ? `Day ${wordDayNum} — ${wordSettings.dailyCount}단어`
                    : '단어 학습 시작하기'}
                </div>
              </div>
            </div>
            <span className="text-subj-english">→</span>
          </Link>

          {/* 오늘의 미션 */}
          <button
            onClick={() => setShowMissions(!showMissions)}
            className="w-full flex items-center justify-between p-4 bg-bg-card rounded-xl hover:bg-bg-hover transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="text-body text-text-primary font-medium">오늘의 미션</div>
                <div className="text-caption text-text-tertiary">
                  {completedMissions}/3 완료 · +{(3 - completedMissions) * 50 + (allMissionsComplete ? 75 : 0)} XP 남음
                </div>
              </div>
            </div>
            <span className={`text-text-tertiary transition-transform ${showMissions ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showMissions && (
            <div className="ml-4 space-y-2">
              <DailyMissions
                missions={missions}
                completedCount={completedMissions}
                allComplete={allMissionsComplete}
                compact={true}
              />
            </div>
          )}

          {/* 추천 학습 */}
          <Link
            href={recommendedConcept ? `/skillmap?concept=${recommendedConcept.id}` : '/skillmap'}
            className="flex items-center justify-between p-4 bg-bg-card rounded-xl hover:bg-bg-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧠</span>
              <div>
                <div className="text-body text-text-primary font-medium">추천 학습</div>
                <div className="text-caption text-text-tertiary">
                  {recommendedConcept
                    ? recommendedConcept.title_ko || recommendedConcept.title_en
                    : '스킬맵에서 다음 개념 선택'}
                </div>
              </div>
            </div>
            <span className="text-subj-math">→</span>
          </Link>
        </section>

        {/* ========== 섹션 2: 내 현황 ========== */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 스트릭 */}
          <div className="bg-bg-card border border-border-subtle rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">🔥</div>
            <div className="text-xl font-bold text-success">{currentStreak}</div>
            <div className="text-caption text-text-tertiary">연속일</div>
          </div>

          {/* 레벨 */}
          <div className="bg-bg-card border border-border-subtle rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">⭐</div>
            <div className="text-xl font-bold text-warning">Lv.{currentLevel}</div>
            <div className="w-full h-1.5 bg-bg-sidebar rounded-full mt-1">
              <div
                className="h-full bg-warning rounded-full transition-all"
                style={{ width: `${Math.min(xpProgress, 100)}%` }}
              />
            </div>
          </div>

          {/* 마스터 */}
          <div className="bg-bg-card border border-border-subtle rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-xl font-bold text-info">{masteredCount}</div>
            <div className="text-caption text-text-tertiary">/{totalConcepts} 마스터</div>
          </div>

          {/* 토큰 */}
          <div className="bg-bg-card border border-border-subtle rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">🎮</div>
            <div className="text-xl font-bold text-danger">{tokens}</div>
            <div className="text-caption text-text-tertiary">토큰</div>
          </div>
        </section>

        {/* ========== 섹션 3: 바로가기 ========== */}
        <section>
          <h2 className="text-caption text-text-tertiary mb-3">바로가기</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {quickLinks.map((item, idx) =>
              item.onClick ? (
                <button
                  key={idx}
                  onClick={item.onClick}
                  className="bg-bg-card border border-border-subtle rounded-xl p-4 text-center hover:bg-bg-hover transition-colors"
                >
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-caption text-text-secondary">{item.label}</div>
                </button>
              ) : (
                <Link
                  key={idx}
                  href={item.href}
                  className="bg-bg-card border border-border-subtle rounded-xl p-4 text-center hover:bg-bg-hover transition-colors"
                >
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-caption text-text-secondary">{item.label}</div>
                </Link>
              )
            )}
          </div>
        </section>

        {/* ========== 개념 검색 ========== */}
        <section>
          <h2 className="text-caption text-text-tertiary mb-3">개념 검색 → 스킬맵</h2>
          <div className="relative">
            <input
              type="text"
              value={conceptSearch}
              onChange={(e) => setConceptSearch(e.target.value)}
              placeholder="개념 이름 검색 (예: quadratic, 함수...)"
              className="w-full px-4 py-3 pr-10 bg-bg-card border border-border-subtle rounded-xl text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-subj-math"
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary text-caption">…</div>
            )}
            {conceptSearch && !searchLoading && (
              <button
                onClick={() => { setConceptSearch(''); setConceptResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >✕</button>
            )}
          </div>
          {conceptResults.length > 0 && (
            <div className="mt-2 bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
              {conceptResults.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/skillmap?concept=${c.id}`}
                  onClick={() => { setConceptSearch(''); setConceptResults([]); }}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors ${i > 0 ? 'border-t border-border-subtle' : ''}`}
                >
                  <div>
                    <div className="text-body text-text-primary font-medium">{c.title_ko || c.title_en}</div>
                    {c.title_ko && c.title_en && (
                      <div className="text-caption text-text-tertiary">{c.title_en}</div>
                    )}
                  </div>
                  <span className="text-text-tertiary text-caption">→</span>
                </Link>
              ))}
            </div>
          )}
          {conceptSearch && !searchLoading && conceptResults.length === 0 && (
            <div className="mt-2 px-4 py-3 text-caption text-text-tertiary bg-bg-card border border-border-subtle rounded-xl">
              검색 결과 없음
            </div>
          )}
        </section>

        {/* ========== 매일성경 (접힌 상태) ========== */}
        <section>
          <button
            onClick={() => setShowDevotion(!showDevotion)}
            className="w-full flex items-center justify-between p-4 bg-bg-card border border-border-subtle rounded-xl hover:bg-bg-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📖</span>
              <span className="text-body text-text-primary">매일성경</span>
            </div>
            <span className={`text-text-tertiary transition-transform ${showDevotion ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showDevotion && (
            <div className="mt-3 space-y-4">
              <DevotionCard />
              <MemorizationCard />
            </div>
          )}
        </section>

        {/* 관리자 전용 */}
        {isAdmin && (
          <section className="mt-6">
            <StudentManagement />
          </section>
        )}
      </div>

      {/* 숙제 분석 모달 */}
      {showHomeworkScanner && (
        <HomeworkScanner
          onClose={() => setShowHomeworkScanner(false)}
          onNavigateToSkillmap={() => router.push('/skillmap')}
          onNavigateToTutor={(data) => {
            router.push(`/skillmap?concept=${data.conceptId}&tutor=1`);
          }}
        />
      )}
    </DashboardLayout>
  );
}
