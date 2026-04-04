'use client';

import { useState, useEffect, useRef } from 'react';
import { SUBJECTS, getSubjectColor } from '@/lib/constants';

export default function StudyTimer() {
  const [activeSubject, setActiveSubject] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [todayTimes, setTodayTimes] = useState({});
  const [isRunning, setIsRunning] = useState(false);
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

  // 오늘 총 시간
  const totalTodaySeconds = Object.values(todayTimes).reduce((sum, t) => sum + t, 0) + (isRunning ? elapsedTime : 0);

  return (
    <div className="card overflow-hidden">
      {/* 상단 컬러 바 - 현재 과목 색상 */}
      <div
        className="h-1 transition-colors duration-300"
        style={{ backgroundColor: activeSubject ? getSubjectColor(activeSubject) : 'var(--border-subtle)' }}
      />

      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-caption text-text-tertiary mb-1">순공 타이머</div>
            <h3 className="text-heading text-text-primary">
              {activeSubject
                ? SUBJECTS.find(s => s.id === activeSubject)?.name
                : '과목을 선택하세요'
              }
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-info-light flex items-center justify-center">
            <span className="text-xl">⏱️</span>
          </div>
        </div>

        {/* 타이머 디스플레이 */}
        <div className="text-center py-6 mb-4 bg-bg-sidebar rounded-lg">
          <div
            className="font-mono text-5xl font-bold transition-colors"
            style={{ color: activeSubject ? getSubjectColor(activeSubject) : 'var(--text-tertiary)' }}
          >
            {formatTime(elapsedTime)}
          </div>
          {isRunning && (
            <div className="mt-2 text-caption text-text-tertiary animate-pulse">
              학습 중...
            </div>
          )}
        </div>

        {/* 과목 탭 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {SUBJECTS.map((subject) => {
            const isActive = activeSubject === subject.id;
            const subjectTime = todayTimes[subject.id] || 0;

            return (
              <button
                key={subject.id}
                onClick={() => handleSubjectSelect(subject.id)}
                className={`
                  p-3 rounded-lg text-center transition-all
                  ${isActive
                    ? 'ring-2 ring-offset-2'
                    : 'hover:bg-bg-hover'
                  }
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
                <div className="text-caption text-text-tertiary">
                  {formatTime(subjectTime + (isActive ? elapsedTime : 0))}
                </div>
              </button>
            );
          })}
        </div>

        {/* 컨트롤 */}
        <div className="flex gap-2">
          {isRunning ? (
            <>
              <button
                onClick={() => setIsRunning(false)}
                className="btn btn-secondary flex-1"
              >
                일시정지
              </button>
              <button
                onClick={handleStop}
                className="btn btn-danger flex-1"
              >
                정지
              </button>
            </>
          ) : activeSubject ? (
            <>
              <button
                onClick={() => setIsRunning(true)}
                className="btn flex-1"
                style={{ backgroundColor: getSubjectColor(activeSubject), color: 'white' }}
              >
                재개
              </button>
              <button
                onClick={handleStop}
                className="btn btn-secondary flex-1"
              >
                리셋
              </button>
            </>
          ) : null}
        </div>

        {/* 오늘 총 학습 시간 */}
        <div className="mt-4 pt-4 border-t border-border-subtle flex justify-between items-center">
          <span className="text-ui text-text-secondary">오늘 순공시간</span>
          <span className="font-mono text-subheading text-text-primary">
            {formatTime(totalTodaySeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}
