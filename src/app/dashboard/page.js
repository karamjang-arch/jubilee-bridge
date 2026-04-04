'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  const [showToast, setShowToast] = useState(false);
  const [wordSettings, setWordSettings] = useState(null);

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
        const mastered = progressData.data?.filter(p => p.status === 'mastered' || p.status === 'placement_mastered') || [];
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
  }, [studentId]);

  // 사진 분석 프롬프트 복사
  const copyPhotoPrompt = async () => {
    const prompt = `아래 문제의 내 풀이를 분석해주세요.

1. 어떤 개념의 문제인지 알려주세요
2. 내가 틀렸다면, 틀린 이유를 분류해주세요:
   A) 선행 개념을 모름 — 어떤 개념인지 알려주세요
   B) 비슷한 개념과 헷갈림 — 어떤 개념인지 알려주세요
   C) 개념은 알지만 계산/표기 실수
3. 각 경우에 내가 복습해야 할 것을 알려주세요
4. 답을 바로 알려주지 말고, 내가 어디서 잘못했는지 질문으로 유도해주세요`;

    try {
      await navigator.clipboard.writeText(prompt);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const wordDayNum = wordSettings ? Math.ceil(
    (new Date() - new Date(wordSettings.startDate)) / (1000 * 60 * 60 * 24)
  ) + 1 : 1;

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
                {((masteredCount / TOTAL_CONCEPTS) * 100).toFixed(1)}%
              </div>
              <div className="streak-label">{masteredCount.toLocaleString()} / {TOTAL_CONCEPTS.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* 퀵 액션 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 📸 숙제 분석 */}
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📸</span>
              <div>
                <h3 className="text-subheading text-text-primary">숙제 분석</h3>
                <p className="text-caption text-text-tertiary">틀린 문제 사진으로 분석하기</p>
              </div>
            </div>
            <button
              onClick={copyPhotoPrompt}
              className="w-full btn btn-secondary justify-between"
            >
              <span>Gemini 프롬프트 복사</span>
              <span className="text-text-tertiary">📋</span>
            </button>
          </div>

          {/* 📖 오늘의 단어 */}
          <Link href="/words" className="card p-4 hover:shadow-card-hover transition-shadow">
            <div className="flex items-center gap-3 mb-3">
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
            <div className="flex items-center justify-between">
              <span className="text-body text-subj-english font-medium">
                {wordSettings ? '학습 시작 →' : '설정하기 →'}
              </span>
              {wordSettings && (
                <span className="text-caption text-text-tertiary">
                  목표: {wordSettings.totalWords}단어
                </span>
              )}
            </div>
          </Link>
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

      {/* 토스트 */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-text-primary text-bg-card rounded-lg shadow-elevated z-50">
          프롬프트가 복사되었습니다!
        </div>
      )}
    </DashboardLayout>
  );
}
