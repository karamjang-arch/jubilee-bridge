'use client';

import { useState, useEffect } from 'react';
import { SUBJECTS } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';

const EMPTY_DATA = {
  totalMinutes: 0,
  subjectMinutes: {
    math: 0, english: 0, physics: 0, chemistry: 0,
    biology: 0, history: 0, economics: 0, cs: 0,
  },
  streak: 0,
  memorizationStreak: 0,
  masteredThisWeek: 0,
};

export default function WeeklyReport() {
  const { studentId } = useProfile();
  const [data, setData] = useState(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    const fetchWeeklyData = async () => {
      try {
        // 이번 주 시작일 계산
        const now = new Date();
        const dayOfWeek = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek);
        const weekStartStr = weekStart.toISOString().split('T')[0];

        // study_timer 데이터
        const timerRes = await fetch(`/api/sheets?tab=study_timer&student=${studentId}`);
        const timerData = await timerRes.json();
        const timerRecords = timerData.data || [];

        // 이번 주 데이터 필터
        const thisWeekRecords = timerRecords.filter(r => r.date >= weekStartStr);

        // 과목별 시간 집계
        const subjectMinutes = { ...EMPTY_DATA.subjectMinutes };
        let totalMinutes = 0;
        thisWeekRecords.forEach(r => {
          const mins = r.duration_min || 0;
          if (subjectMinutes[r.subject] !== undefined) {
            subjectMinutes[r.subject] += mins;
          }
          totalMinutes += mins;
        });

        // 스트릭 계산
        const studyDays = [...new Set(timerRecords.map(t => t.date))].sort().reverse();
        let streak = 0;
        for (let i = 0; i < studyDays.length; i++) {
          const expectedDate = new Date();
          expectedDate.setDate(expectedDate.getDate() - i);
          if (studyDays[i] === expectedDate.toISOString().split('T')[0]) {
            streak++;
          } else break;
        }

        // concept_progress에서 이번 주 마스터 개수
        const progressRes = await fetch(`/api/sheets?tab=concept_progress&student=${studentId}`);
        const progressData = await progressRes.json();
        const masteredThisWeek = (progressData.data || []).filter(p =>
          p.status === 'mastered' && p.mastered_at >= weekStartStr
        ).length;

        setData({
          totalMinutes,
          subjectMinutes,
          streak,
          memorizationStreak: 0, // TODO: 암송 데이터 연동
          masteredThisWeek,
        });
      } catch (error) {
        console.error('Failed to fetch weekly data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeeklyData();
  }, [studentId]);

  // 시간 포맷 (분 → 시간:분)
  const formatMinutes = (mins) => {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if (hrs > 0) {
      return `${hrs}시간 ${m}분`;
    }
    return `${m}분`;
  };

  // 최대값 계산 (바 차트 스케일링용)
  const maxMinutes = Math.max(...Object.values(data.subjectMinutes));

  return (
    <div className="card overflow-hidden">
      {/* 상단 컬러 바 */}
      <div className="h-1 bg-progress-streak" />

      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-caption text-text-tertiary mb-1">주간 리포트</div>
            <h3 className="text-heading text-text-primary">
              이번 주 학습 현황
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-success-light flex items-center justify-center">
            <span className="text-xl">📊</span>
          </div>
        </div>

        {/* 통계 그리드 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-bg-sidebar rounded-lg">
            <div className="text-caption text-text-tertiary mb-1">순공시간</div>
            <div className="font-mono text-subheading text-text-primary">
              {formatMinutes(data.totalMinutes)}
            </div>
          </div>
          <div className="p-3 bg-bg-sidebar rounded-lg">
            <div className="text-caption text-text-tertiary mb-1">마스터</div>
            <div className="font-mono text-subheading text-text-primary">
              {data.masteredThisWeek}개
            </div>
          </div>
          <div className="p-3 bg-success-light rounded-lg">
            <div className="text-caption text-success mb-1">학습 스트릭</div>
            <div className="font-mono text-subheading text-success">
              {data.streak}일 🔥
            </div>
          </div>
          <div className="p-3 bg-subj-english-light rounded-lg">
            <div className="text-caption text-subj-english-dark mb-1">암송 스트릭</div>
            <div className="font-mono text-subheading text-subj-english-dark">
              {data.memorizationStreak}주 📖
            </div>
          </div>
        </div>

        {/* 과목별 시간 분포 */}
        <div className="border-t border-border-subtle pt-4">
          <h4 className="text-ui text-text-secondary mb-3">과목별 학습 시간</h4>
          <div className="space-y-2">
            {SUBJECTS.map((subject) => {
              const minutes = data.subjectMinutes[subject.id] || 0;
              const percentage = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;

              return (
                <div key={subject.id} className="flex items-center gap-3">
                  <div className="w-12 text-caption text-text-secondary">
                    {subject.name}
                  </div>
                  <div className="flex-1 h-6 bg-bg-hover rounded-pill overflow-hidden">
                    <div
                      className="h-full rounded-pill transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: `var(${subject.cssVar})`,
                      }}
                    />
                  </div>
                  <div className="w-16 text-right text-caption text-text-tertiary font-mono">
                    {formatMinutes(minutes)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
