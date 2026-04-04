'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import DevotionCard from '@/components/DevotionCard';
import MemorizationCard from '@/components/MemorizationCard';
import WeeklyReport from '@/components/WeeklyReport';
import StudyTimer from '@/components/StudyTimer';
import { TOTAL_CONCEPTS } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';

export default function DashboardPage() {
  const { profile, studentId } = useProfile();
  const [streak, setStreak] = useState(0);
  const [todayStudy, setTodayStudy] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 실제 데이터 로드
  useEffect(() => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // concept_progress에서 mastered 개수 가져오기
        const progressRes = await fetch(`/api/sheets?tab=concept_progress&student=${studentId}`);
        const progressData = await progressRes.json();
        const mastered = progressData.data?.filter(p => p.status === 'mastered') || [];
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

      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [studentId]);

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-5xl mx-auto">
        {/* 상단 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 스트릭 */}
          <div className="streak-card">
            <div className="w-10 h-10 rounded-full bg-success-light flex items-center justify-center">
              <span className="text-xl">🔥</span>
            </div>
            <div>
              <div className="streak-number">{streak}</div>
              <div className="streak-label">연속 학습일</div>
            </div>
          </div>

          {/* 오늘 학습 */}
          <div className="streak-card">
            <div className="w-10 h-10 rounded-full bg-info-light flex items-center justify-center">
              <span className="text-xl">📚</span>
            </div>
            <div>
              <div className="text-stat text-info">{todayStudy}</div>
              <div className="streak-label">오늘 마스터</div>
            </div>
          </div>

          {/* 전체 진행 */}
          <div className="streak-card">
            <div className="w-10 h-10 rounded-full bg-warning-light flex items-center justify-center">
              <span className="text-xl">🎯</span>
            </div>
            <div>
              <div className="text-stat text-warning">
                {((masteredCount / TOTAL_CONCEPTS) * 100).toFixed(1)}%
              </div>
              <div className="streak-label">{masteredCount.toLocaleString()} / {TOTAL_CONCEPTS.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽 컬럼 */}
          <div className="space-y-6">
            {/* 오늘의 묵상 */}
            <DevotionCard />

            {/* 이번 주 암송 */}
            <MemorizationCard />
          </div>

          {/* 오른쪽 컬럼 */}
          <div className="space-y-6">
            {/* 순공 타이머 */}
            <StudyTimer />

            {/* 주간 리포트 */}
            <WeeklyReport />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
