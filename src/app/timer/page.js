'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { SUBJECTS, getSubjectColor } from '@/lib/constants';

export default function TimerPage() {
  const [activeSubject, setActiveSubject] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [todayTimes, setTodayTimes] = useState({});
  const [weekTimes, setWeekTimes] = useState({
    math: 14520,     // 4시간 2분
    english: 11340,  // 3시간 9분
    physics: 9360,   // 2시간 36분
    chemistry: 5880, // 1시간 38분
    biology: 4320,   // 1시간 12분
    history: 2700,   // 45분
    economics: 1680, // 28분
    cs: 840,         // 14분
  });
  const intervalRef = useRef(null);

  // 타이머 시작/정지
  useEffect(() => {
    if (isRunning && activeSubject) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, activeSubject]);

  // 과목 선택/변경
  const handleSubjectSelect = (subjectId) => {
    // 이전 과목 시간 저장
    if (activeSubject && elapsedTime > 0) {
      setTodayTimes(prev => ({
        ...prev,
        [activeSubject]: (prev[activeSubject] || 0) + elapsedTime
      }));
      setWeekTimes(prev => ({
        ...prev,
        [activeSubject]: (prev[activeSubject] || 0) + elapsedTime
      }));
    }

    // 같은 과목 클릭 시 토글
    if (activeSubject === subjectId) {
      setIsRunning(!isRunning);
      return;
    }

    // 새 과목 시작
    setActiveSubject(subjectId);
    setElapsedTime(0);
    setIsRunning(true);
  };

  // 정지
  const handleStop = () => {
    if (activeSubject && elapsedTime > 0) {
      setTodayTimes(prev => ({
        ...prev,
        [activeSubject]: (prev[activeSubject] || 0) + elapsedTime
      }));
      setWeekTimes(prev => ({
        ...prev,
        [activeSubject]: (prev[activeSubject] || 0) + elapsedTime
      }));
    }
    setIsRunning(false);
    setElapsedTime(0);
    setActiveSubject(null);
  };

  // 시간 포맷
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeShort = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // 오늘 총 시간
  const totalTodaySeconds = Object.values(todayTimes).reduce((sum, t) => sum + t, 0) + (isRunning ? elapsedTime : 0);

  // 주간 총 시간
  const totalWeekSeconds = Object.values(weekTimes).reduce((sum, t) => sum + t, 0) + (isRunning ? elapsedTime : 0);

  // 주간 최대값 (차트 스케일링용)
  const maxWeekSeconds = Math.max(...Object.values(weekTimes), 1);

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-display text-text-primary">순공 타이머</h1>
          <p className="text-body text-text-secondary mt-1">
            과목을 선택하고 집중 시간을 기록하세요
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 타이머 카드 */}
          <div className="card overflow-hidden">
            {/* 상단 컬러 바 */}
            <div
              className="h-1 transition-colors duration-300"
              style={{ backgroundColor: activeSubject ? getSubjectColor(activeSubject) : 'var(--border-subtle)' }}
            />

            <div className="p-6">
              {/* 타이머 디스플레이 */}
              <div className="text-center py-8 mb-6 bg-bg-sidebar rounded-xl">
                <div
                  className="font-mono text-6xl font-bold transition-colors"
                  style={{ color: activeSubject ? getSubjectColor(activeSubject) : 'var(--text-tertiary)' }}
                >
                  {formatTime(elapsedTime)}
                </div>
                {activeSubject && (
                  <div className="mt-3 text-subheading" style={{ color: getSubjectColor(activeSubject) }}>
                    {SUBJECTS.find(s => s.id === activeSubject)?.name}
                  </div>
                )}
                {isRunning && (
                  <div className="mt-2 text-caption text-text-tertiary animate-pulse">
                    학습 중...
                  </div>
                )}
              </div>

              {/* 과목 선택 그리드 */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {SUBJECTS.map((subject) => {
                  const isActive = activeSubject === subject.id;
                  const subjectTime = todayTimes[subject.id] || 0;

                  return (
                    <button
                      key={subject.id}
                      onClick={() => handleSubjectSelect(subject.id)}
                      className={`
                        p-4 rounded-lg text-center transition-all
                        ${isActive ? 'ring-2 ring-offset-2' : 'hover:bg-bg-hover'}
                      `}
                      style={{
                        backgroundColor: isActive ? `var(${subject.cssVar}-light)` : undefined,
                        '--tw-ring-color': `var(${subject.cssVar})`,
                      }}
                    >
                      <div
                        className="text-ui font-medium mb-1"
                        style={{ color: `var(${subject.cssVar}-dark)` }}
                      >
                        {subject.name}
                      </div>
                      <div className="text-caption font-mono text-text-tertiary">
                        {formatTime(subjectTime + (isActive ? elapsedTime : 0))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 컨트롤 버튼 */}
              <div className="flex gap-2">
                {isRunning ? (
                  <>
                    <button
                      onClick={() => setIsRunning(false)}
                      className="btn btn-secondary flex-1"
                    >
                      ⏸️ 일시정지
                    </button>
                    <button
                      onClick={handleStop}
                      className="btn btn-danger flex-1"
                    >
                      ⏹️ 정지
                    </button>
                  </>
                ) : activeSubject ? (
                  <>
                    <button
                      onClick={() => setIsRunning(true)}
                      className="btn flex-1 text-white"
                      style={{ backgroundColor: getSubjectColor(activeSubject) }}
                    >
                      ▶️ 재개
                    </button>
                    <button
                      onClick={handleStop}
                      className="btn btn-secondary flex-1"
                    >
                      🔄 리셋
                    </button>
                  </>
                ) : (
                  <div className="flex-1 text-center py-3 text-text-tertiary">
                    과목을 선택하여 시작하세요
                  </div>
                )}
              </div>

              {/* 오늘 총 시간 */}
              <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center">
                <span className="text-ui text-text-secondary">오늘 순공시간</span>
                <span className="font-mono text-heading text-text-primary">
                  {formatTimeShort(totalTodaySeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* 주간 통계 */}
          <div className="card p-6">
            <h3 className="text-heading text-text-primary mb-4">이번 주 학습 시간</h3>

            {/* 주간 총 시간 */}
            <div className="mb-6 p-4 bg-bg-sidebar rounded-lg text-center">
              <div className="text-stat text-progress-streak">
                {Math.floor(totalWeekSeconds / 3600)}시간 {Math.floor((totalWeekSeconds % 3600) / 60)}분
              </div>
              <div className="text-caption text-text-tertiary mt-1">주간 총 순공시간</div>
            </div>

            {/* 과목별 바 차트 */}
            <div className="space-y-3">
              {SUBJECTS.map((subject) => {
                const seconds = weekTimes[subject.id] || 0;
                const percentage = (seconds / maxWeekSeconds) * 100;

                return (
                  <div key={subject.id} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `var(${subject.cssVar})` }}
                    />
                    <div className="w-12 text-ui text-text-secondary">
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
                    <div className="w-14 text-right text-caption font-mono text-text-tertiary">
                      {formatTimeShort(seconds)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 일별 히트맵 */}
            <div className="mt-6 pt-6 border-t border-border-subtle">
              <h4 className="text-ui text-text-secondary mb-3">이번 주 활동</h4>
              <div className="flex gap-1">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => {
                  const isToday = idx === new Date().getDay();
                  const hasActivity = idx <= new Date().getDay();
                  return (
                    <div key={day} className="flex-1 text-center">
                      <div className="text-caption text-text-tertiary mb-1">{day}</div>
                      <div
                        className={`
                          h-8 rounded-md transition-colors
                          ${isToday ? 'ring-2 ring-progress-streak ring-offset-1' : ''}
                        `}
                        style={{
                          backgroundColor: hasActivity ? 'var(--progress-streak)' : 'var(--bg-hover)',
                          opacity: hasActivity ? 0.3 + (idx / 7) * 0.7 : 1,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
