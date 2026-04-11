'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { SUBJECTS, getSubjectColor } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';

// 6시간 제한 (초)
const MAX_SESSION_SECONDS = 6 * 60 * 60;
const WARNING_SECONDS = 5.5 * 60 * 60; // 5시간 30분에 경고

export default function TimerPage() {
  const { profile, studentId, isLoading: profileLoading } = useProfile();

  const [activeSubject, setActiveSubject] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null); // ISO timestamp
  const [todayTimes, setTodayTimes] = useState({});
  const [weekTimes, setWeekTimes] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const intervalRef = useRef(null);
  const warningShownRef = useRef(false);

  // localStorage 키
  const getStorageKey = useCallback((key) => {
    return `jb_timer_${studentId || 'guest'}_${key}`;
  }, [studentId]);

  // API에서 오늘/주간 데이터 로드
  const loadFromAPI = useCallback(async () => {
    if (!studentId) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/timer?student=${studentId}&date=${today}`);

      if (response.ok) {
        const data = await response.json();

        // 과목별 오늘 누적 (분 → 초)
        if (data.subjectTotals) {
          const todaySeconds = {};
          for (const [subject, minutes] of Object.entries(data.subjectTotals)) {
            todaySeconds[subject] = minutes * 60;
          }
          setTodayTimes(todaySeconds);
        }

        // 과목별 주간 누적 (분 → 초)
        if (data.weekSubjectTotals) {
          const weekSeconds = {};
          for (const [subject, minutes] of Object.entries(data.weekSubjectTotals)) {
            weekSeconds[subject] = minutes * 60;
          }
          setWeekTimes(weekSeconds);
        }
      }
    } catch (error) {
      console.error('Failed to load timer data:', error);
    }
  }, [studentId]);

  // localStorage에서 진행 중 세션 복원
  const restoreSession = useCallback(() => {
    if (!studentId) return;

    const savedSession = localStorage.getItem(getStorageKey('active_session'));
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        const now = Date.now();
        const elapsed = Math.floor((now - new Date(session.startedAt).getTime()) / 1000);

        // 6시간 이내면 복원
        if (elapsed < MAX_SESSION_SECONDS && elapsed > 0) {
          setActiveSubject(session.subject);
          setStartedAt(session.startedAt);
          setElapsedTime(elapsed);
          setIsRunning(true);
        } else {
          // 만료된 세션 정리
          localStorage.removeItem(getStorageKey('active_session'));
        }
      } catch (e) {
        localStorage.removeItem(getStorageKey('active_session'));
      }
    }
  }, [studentId, getStorageKey]);

  // 초기 로드
  useEffect(() => {
    if (studentId && !isLoaded) {
      loadFromAPI();
      restoreSession();
      setIsLoaded(true);
    }
  }, [studentId, isLoaded, loadFromAPI, restoreSession]);

  // 타이머 tick (시작 시각 기반 계산)
  useEffect(() => {
    if (isRunning && startedAt) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000);
        setElapsedTime(elapsed);

        // 6시간 제한 체크
        if (elapsed >= MAX_SESSION_SECONDS) {
          handleAutoStop();
        } else if (elapsed >= WARNING_SECONDS && !warningShownRef.current) {
          warningShownRef.current = true;
          setShowWarning(true);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, startedAt]);

  // 탭 전환/백그라운드 복귀 시 시간 재계산
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && startedAt) {
        const now = Date.now();
        const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000);
        setElapsedTime(elapsed);

        if (elapsed >= MAX_SESSION_SECONDS) {
          handleAutoStop();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, startedAt]);

  // 6시간 초과 자동 정지
  const handleAutoStop = async () => {
    setShowWarning(false);
    warningShownRef.current = false;

    if (activeSubject && startedAt) {
      const now = new Date();
      const durationSec = Math.min(elapsedTime, MAX_SESSION_SECONDS);

      await saveSession(activeSubject, startedAt, now.toISOString(), durationSec);

      setTodayTimes(prev => ({
        ...prev,
        [activeSubject]: (prev[activeSubject] || 0) + durationSec
      }));
      setWeekTimes(prev => ({
        ...prev,
        [activeSubject]: (prev[activeSubject] || 0) + durationSec
      }));
    }

    setIsRunning(false);
    setElapsedTime(0);
    setActiveSubject(null);
    setStartedAt(null);
    localStorage.removeItem(getStorageKey('active_session'));

    alert('6시간이 경과하여 자동 정지되었습니다. 아직 공부 중인가요?');
  };

  // 세션 저장 (API + localStorage 병행)
  const saveSession = async (subject, startAt, endAt, durationSec) => {
    const durationMin = Math.round(durationSec / 60);

    if (durationMin < 1) return; // 1분 미만은 저장 안 함

    // localStorage에 히스토리 저장
    const today = new Date().toISOString().split('T')[0];
    const historyKey = getStorageKey(`history_${today}`);
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    history.push({ subject, startAt, endAt, durationMin });
    localStorage.setItem(historyKey, JSON.stringify(history));

    // API 저장
    if (studentId) {
      try {
        await fetch('/api/timer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student: studentId,
            subject,
            startAt,
            endAt,
            durationMin
          })
        });
      } catch (error) {
        console.error('Failed to save timer session:', error);
      }
    }
  };

  // 과목 선택/변경
  const handleSubjectSelect = async (subjectId) => {
    // 이전 과목 시간 저장
    if (activeSubject && elapsedTime > 0 && startedAt) {
      const now = new Date();
      await saveSession(activeSubject, startedAt, now.toISOString(), elapsedTime);

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
      if (isRunning) {
        setIsRunning(false);
        localStorage.removeItem(getStorageKey('active_session'));
      } else {
        const now = new Date().toISOString();
        setStartedAt(now);
        setIsRunning(true);
        localStorage.setItem(getStorageKey('active_session'), JSON.stringify({
          subject: subjectId,
          startedAt: now
        }));
      }
      return;
    }

    // 새 과목 시작
    const now = new Date().toISOString();
    setActiveSubject(subjectId);
    setStartedAt(now);
    setElapsedTime(0);
    setIsRunning(true);
    warningShownRef.current = false;

    localStorage.setItem(getStorageKey('active_session'), JSON.stringify({
      subject: subjectId,
      startedAt: now
    }));
  };

  // 정지
  const handleStop = async () => {
    if (activeSubject && elapsedTime > 0 && startedAt) {
      const now = new Date();
      await saveSession(activeSubject, startedAt, now.toISOString(), elapsedTime);

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
    setStartedAt(null);
    warningShownRef.current = false;
    localStorage.removeItem(getStorageKey('active_session'));
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
        {/* 6시간 경고 모달 */}
        {showWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
              <div className="text-4xl text-center mb-4">⏰</div>
              <h3 className="text-xl font-bold text-center mb-2">5시간 30분 경과</h3>
              <p className="text-text-secondary text-center mb-4">
                아직 공부 중인가요? 30분 후 자동 정지됩니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWarning(false)}
                  className="flex-1 btn bg-green-600 text-white"
                >
                  네, 계속할게요
                </button>
                <button
                  onClick={handleStop}
                  className="flex-1 btn btn-secondary"
                >
                  지금 정지
                </button>
              </div>
            </div>
          </div>
        )}

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
              <div className="text-center py-8 mb-6 bg-bg-sidebar rounded-xl relative">
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
                {/* 6시간 프로그레스 바 */}
                {isRunning && (
                  <div className="absolute bottom-2 left-4 right-4">
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 transition-all"
                        style={{ width: `${Math.min((elapsedTime / MAX_SESSION_SECONDS) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-text-tertiary mt-1 text-right">
                      {formatTimeShort(MAX_SESSION_SECONDS - elapsedTime)} 남음
                    </div>
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
                      onClick={() => {
                        setIsRunning(false);
                        localStorage.removeItem(getStorageKey('active_session'));
                      }}
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
                      onClick={() => {
                        const now = new Date().toISOString();
                        setStartedAt(now);
                        setIsRunning(true);
                        localStorage.setItem(getStorageKey('active_session'), JSON.stringify({
                          subject: activeSubject,
                          startedAt: now
                        }));
                      }}
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
                const seconds = (weekTimes[subject.id] || 0) + (activeSubject === subject.id && isRunning ? elapsedTime : 0);
                const percentage = maxWeekSeconds > 0 ? (seconds / maxWeekSeconds) * 100 : 0;

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
