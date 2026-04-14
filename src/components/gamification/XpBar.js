'use client';

import { LEVELS } from '@/lib/gamification';

/**
 * XP 진행 바 컴포넌트
 * 현재 XP, 레벨, 다음 레벨까지 진행도 표시
 */
export default function XpBar({
  totalXp = 0,
  level = { level: 1, title: 'Beginner', titleKo: '입문자' },
  nextLevel = { nextLevel: null, xpNeeded: 100, progress: 0 },
  streak = 0,
  compact = false,
}) {
  const isMaxLevel = !nextLevel.nextLevel;

  // 레벨 아이콘 (레벨별 차별화)
  const levelIcons = ['', '', '', '', '', '', ''];

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* 레벨 뱃지 */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)' }}
        >
          {level.level}
        </div>

        {/* XP */}
        <div className="flex-1">
          <div className="flex items-center justify-between text-caption mb-1">
            <span className="text-text-secondary font-medium">{totalXp.toLocaleString()} XP</span>
            {!isMaxLevel && (
              <span className="text-text-tertiary">{nextLevel.xpNeeded.toLocaleString()} to Lv.{nextLevel.nextLevel?.level}</span>
            )}
          </div>
          <div className="progress-bar h-2">
            <div
              className="progress-bar-fill"
              style={{
                width: `${isMaxLevel ? 100 : nextLevel.progress}%`,
                background: 'linear-gradient(90deg, #ffc107, #ff9800)',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        {/* 레벨 뱃지 */}
        <div className="relative">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-raised"
            style={{ background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)' }}
          >
            {level.level}
          </div>
          {streak > 0 && (
            <div className="absolute -bottom-1 -right-1 bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <span>+{streak}</span>
            </div>
          )}
        </div>

        {/* XP 정보 */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-subheading text-text-primary">{level.titleKo}</span>
              <span className="text-caption text-text-tertiary ml-2">{level.title}</span>
            </div>
            <span className="text-stat text-warning text-xl">{totalXp.toLocaleString()}</span>
          </div>

          <div className="text-caption text-text-tertiary mb-2">
            {isMaxLevel ? (
              '최고 레벨 달성!'
            ) : (
              <>다음 레벨까지 <span className="text-warning font-medium">{nextLevel.xpNeeded.toLocaleString()} XP</span></>
            )}
          </div>

          {/* 진행 바 */}
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${isMaxLevel ? 100 : nextLevel.progress}%`,
                background: 'linear-gradient(90deg, #ffc107, #ff9800)',
              }}
            />
          </div>

          {/* 레벨 마커 */}
          <div className="flex justify-between mt-2 text-caption text-text-disabled">
            {LEVELS.slice(0, -1).map((lv, i) => (
              <span
                key={lv.level}
                className={lv.level <= level.level ? 'text-warning' : ''}
              >
                {lv.level}
              </span>
            ))}
            <span className={level.level === 7 ? 'text-warning' : ''}>7</span>
          </div>
        </div>
      </div>
    </div>
  );
}
