'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import DevotionCard from '@/components/DevotionCard';
import MemorizationCard from '@/components/MemorizationCard';
import WeeklyReport from '@/components/WeeklyReport';
import CanvasAssignmentsCard from '@/components/CanvasAssignmentsCard';
import GeminiTutorCard from '@/components/GeminiTutorCard';
import StudentManagement from '@/components/StudentManagement';
import CurriculumToggle from '@/components/CurriculumToggle';
import ConceptHistoryCard from '@/components/ConceptHistoryCard';
import { XpBar, BadgeCard, DailyMissions, XpToast, BadgeCelebration } from '@/components/gamification';
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
  const [todayStudy, setTodayStudy] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [totalConcepts, setTotalConcepts] = useState(TOTAL_CONCEPTS);
  const [isLoading, setIsLoading] = useState(true);
  const [wordSettings, setWordSettings] = useState(null);
  const [showHomeworkScanner, setShowHomeworkScanner] = useState(false);

  // 온보딩 체크 - 학생이면서 온보딩 미완료 시 리다이렉트
  useEffect(() => {
    if (!studentId || isAdmin) return;

    const onboardingCompleted = localStorage.getItem('jb_onboarding_completed');
    if (onboardingCompleted !== studentId) {
      console.log('[Dashboard] 온보딩 미완료, 리다이렉트:', studentId);
      router.replace('/onboarding');
    }
  }, [studentId, isAdmin, router]);

  // Gamification hook
  const {
    totalXp,
    level,
    nextLevel,
    streak: gamificationStreak,
    badges,
    missions,
    completedMissions,
    allMissionsComplete,
    xpGain,
    currentNewBadge,
    nickname,
  } = useGamification(studentId);

  // 실제 데이터 로드
  useEffect(() => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // concept_progress에서 mastered 개수 가져오기 (교육과정별 필터링)
        const progressRes = await fetch(`/api/sheets?tab=concept_progress&student=${studentId}`);
        const progressData = await progressRes.json();
        const mastered = progressData.data?.filter(p => {
          const isMastered = p.status === 'mastered' || p.status === 'placement_mastered';
          if (!isMastered) return false;
          // 교육과정별 필터: KR- 접두사로 한국/미국 구분
          const isKoreanConcept = p.concept_id?.startsWith('KR-');
          return isKR ? isKoreanConcept : !isKoreanConcept;
        }) || [];
        setMasteredCount(mastered.length);

        // study_timer에서 스트릭 계산
        const timerRes = await fetch(`/api/sheets?tab=study_timer&student=${studentId}`);
        const timerData = await timerRes.json();
        const studyDays = timerData.data?.map(t => t.date) || [];
        const uniqueDays = [...new Set(studyDays)].sort().reverse();

        // 연속 학습일 계산
        let streakCount = 0;
        const today = new Date().toISOString().split('T')[0];
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

        // 오늘 마스터한 개수
        const todayMastered = mastered.filter(p =>
          p.mastered_at?.startsWith(today)
        ).length;
        setTodayStudy(todayMastered);

        // 단어 설정 로드
        const savedWordSettings = localStorage.getItem(`jb_word_settings_${studentId}`);
        if (savedWordSettings) {
          setWordSettings(JSON.parse(savedWordSettings));
        }

      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [studentId, isKR]);

  // 교육과정별 총 개념 수 로드
  useEffect(() => {
    const fetchTotalConcepts = async () => {
      try {
        const res = await fetch(`/api/concepts?summary=true&curriculum=${curriculum}`);
        const data = await res.json();
        if (data.totalCount) {
          setTotalConcepts(data.totalCount);
        }
      } catch (error) {
        console.error('Failed to fetch total concepts:', error);
        setTotalConcepts(TOTAL_CONCEPTS);
      }
    };
    fetchTotalConcepts();
  }, [curriculum]);

  const wordDayNum = wordSettings ? Math.ceil(
    (new Date() - new Date(wordSettings.startDate)) / (1000 * 60 * 60 * 24)
  ) + 1 : 1;

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-5xl mx-auto">
        {/* XP Toast & Badge Celebration */}
        {xpGain && <XpToast xpGain={xpGain} />}
        {currentNewBadge && <BadgeCelebration badge={currentNewBadge} onClose={() => {}} />}

        {/* 교육과정 토글 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-heading text-text-primary">대시보드</h1>
          <div className="flex items-center gap-3">
            <span className="text-caption text-text-tertiary">{curriculumLabel}</span>
            <CurriculumToggle />
          </div>
        </div>

        {/* XP 진행 바 */}
        <div className="mb-6">
          <XpBar
            totalXp={totalXp}
            level={level}
            nextLevel={nextLevel}
            streak={gamificationStreak || streak}
          />
        </div>

        {/* 상단 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 스트릭 */}
          <div className="streak-card">
            <div className="w-10 h-10 rounded-full bg-success-light flex items-center justify-center">
              <span className="text-xl">🔥</span>
            </div>
            <div>
              <div className="streak-number">{gamificationStreak || streak}</div>
              <div className="streak-label">연속 학습일</div>
            </div>
          </div>

          {/* 오늘 학습 */}
          <div className="streak-card">
            <div className="w-10 h-10 rounded-full bg-info-light flex items-center justify-center">
              <span className="text-xl">📝</span>
            </div>
            <div>
              <div className="text-stat text-info">{todayStudy}</div>
              <div className="streak-label">오늘 도전</div>
            </div>
          </div>

          {/* 전체 진행 */}
          <div className="streak-card">
            <div className="w-10 h-10 rounded-full bg-warning-light flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <div className="text-stat text-warning">
                {((masteredCount / totalConcepts) * 100).toFixed(1)}%
              </div>
              <div className="streak-label">{masteredCount.toLocaleString()} / {totalConcepts.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* 퀵 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 📖 오늘의 단어 */}
          <Link href="/words" className="card p-4 hover:shadow-card-hover transition-shadow block">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📖</span>
                <div>
                  <h3 className="text-subheading text-text-primary">오늘의 단어</h3>
                  <p className="text-caption text-text-tertiary">
                    {wordSettings
                      ? `Day ${wordDayNum} — ${wordSettings.dailyCount}단어`
                      : '단어 학습 시작하기'}
                  </p>
                </div>
              </div>
              <span className="text-body text-subj-english font-medium">→</span>
            </div>
          </Link>

          {/* 🎯 미니 모의고사 */}
          <Link href="/practice-tests/quiz" className="card p-4 hover:shadow-card-hover transition-shadow block">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <h3 className="text-subheading text-text-primary">미니 모의고사</h3>
                  <p className="text-caption text-text-tertiary">10문제 · 15분</p>
                </div>
              </div>
              <span className="text-body text-subj-math font-medium">→</span>
            </div>
          </Link>

          {/* ✍️ 에세이 제출 */}
          <Link href="/essay/submit" className="card p-4 hover:shadow-card-hover transition-shadow block">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✍️</span>
                <div>
                  <h3 className="text-subheading text-text-primary">에세이 제출</h3>
                  <p className="text-caption text-text-tertiary">AI 채점 · 5축 분석</p>
                </div>
              </div>
              <span className="text-body text-subj-english font-medium">→</span>
            </div>
          </Link>

          {/* 리더보드 */}
          <Link href="/leaderboard" className="card p-4 hover:shadow-card-hover transition-shadow block">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <h3 className="text-subheading text-text-primary">리더보드</h3>
                  <p className="text-caption text-text-tertiary">XP 랭킹 확인</p>
                </div>
              </div>
              <span className="text-body text-warning font-medium">→</span>
            </div>
          </Link>

          {/* 📸 숙제 분석 */}
          <button
            onClick={() => setShowHomeworkScanner(true)}
            className="card p-4 hover:shadow-card-hover transition-shadow block w-full text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📸</span>
                <div>
                  <h3 className="text-subheading text-text-primary">숙제 분석</h3>
                  <p className="text-caption text-text-tertiary">사진으로 채점 · AI 피드백</p>
                </div>
              </div>
              <span className="text-body text-info font-medium">→</span>
            </div>
          </button>
        </div>

        {/* 일일 미션 & 뱃지 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 일일 미션 */}
          <DailyMissions
            missions={missions}
            completedCount={completedMissions}
            allComplete={allMissionsComplete}
          />

          {/* 내 뱃지 */}
          <BadgeCard badges={badges} />
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽 컬럼 */}
          <div className="space-y-6">
            {/* Gemini 튜터 */}
            <GeminiTutorCard />

            {/* 오늘의 묵상 */}
            <DevotionCard />

            {/* 이번 주 암송 */}
            <MemorizationCard />
          </div>

          {/* 오른쪽 컬럼 */}
          <div className="space-y-6">
            {/* 학교 과제 (Canvas) */}
            <CanvasAssignmentsCard />


            {/* 학습 기록 */}
            <ConceptHistoryCard />

            {/* 주간 리포트 */}
            <WeeklyReport />
          </div>
        </div>

        {/* 관리자 전용 섹션 */}
        {isAdmin && (
          <div className="mt-6">
            <StudentManagement />
          </div>
        )}
      </div>

      {/* 숙제 분석 모달 */}
      {showHomeworkScanner && (
        <HomeworkScanner
          onClose={() => setShowHomeworkScanner(false)}
          onNavigateToSkillmap={() => router.push('/skillmap')}
          onNavigateToTutor={(data) => {
            // 튜터 페이지로 이동하면서 문제 컨텍스트 전달
            router.push(`/skillmap?concept=${data.conceptId}&tutor=1`);
          }}
        />
      )}
    </DashboardLayout>
  );
}
