'use client';

import { XP_RULES } from '@/lib/gamification';

/**
 * 일일 미션 카드 컴포넌트
 */
export default function DailyMissions({
  missions = [],
  completedCount = 0,
  allComplete = false,
  compact = false,
}) {
  const totalXp = missions.reduce((sum, m) => sum + m.xp, 0);
  const earnedXp = missions.filter(m => m.completed).reduce((sum, m) => sum + m.xp, 0);
  const bonusXp = allComplete ? XP_RULES.DAILY_MISSION_COMPLETE : 0;

  // 컴팩트 모드: 카드 래퍼 없이 미션 목록만
  if (compact) {
    return (
      <div className="space-y-2">
        {missions.map(mission => (
          <MissionItem key={mission.id} mission={mission} compact />
        ))}
        {allComplete && (
          <div className="p-2 bg-success-light rounded-lg text-center">
            <span className="text-caption text-success font-medium">
              모든 미션 완료! +{XP_RULES.DAILY_MISSION_COMPLETE} XP
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-subheading text-text-primary flex items-center gap-2">
          <span>오늘의 미션</span>
          <span className={`text-caption font-medium ${allComplete ? 'text-success' : 'text-text-tertiary'}`}>
            {completedCount}/{missions.length}
          </span>
        </h3>
        <div className="text-caption text-text-tertiary">
          +{earnedXp + bonusXp} / {totalXp + XP_RULES.DAILY_MISSION_COMPLETE} XP
        </div>
      </div>

      <div className="space-y-3">
        {missions.map(mission => (
          <MissionItem key={mission.id} mission={mission} />
        ))}
      </div>

      {/* 보너스 표시 */}
      {allComplete ? (
        <div className="mt-4 p-3 bg-success-light rounded-lg flex items-center justify-between">
          <span className="text-ui text-success font-medium">
            모든 미션 완료!
          </span>
          <span className="text-caption text-success">+{XP_RULES.DAILY_MISSION_COMPLETE} XP 보너스</span>
        </div>
      ) : (
        <p className="text-caption text-text-tertiary mt-3">
          3개 미션 완료 시 +{XP_RULES.DAILY_MISSION_COMPLETE} XP 보너스!
        </p>
      )}
    </div>
  );
}

/**
 * 개별 미션 아이템
 */
function MissionItem({ mission, compact = false }) {
  const { icon, text, xp, completed, progress, target } = mission;
  const progressPercent = Math.min((progress / target) * 100, 100);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-lg ${completed ? 'bg-success-light' : 'bg-bg-card'}`}>
        <span className={completed ? 'text-success' : ''}>{completed ? '✓' : icon}</span>
        <span className={`flex-1 text-caption ${completed ? 'text-success line-through' : 'text-text-primary'}`}>
          {text}
        </span>
        {!completed && (
          <span className="text-caption text-text-tertiary">{progress}/{target}</span>
        )}
        <span className={`text-caption font-medium ${completed ? 'text-success' : 'text-warning'}`}>
          +{xp}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        completed
          ? 'bg-success-light border-success/30'
          : 'bg-bg-card border-border-subtle'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* 아이콘 / 체크박스 */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
            completed ? 'bg-success text-white' : 'bg-bg-hover'
          }`}
        >
          {completed ? '✓' : icon}
        </div>

        {/* 미션 텍스트 */}
        <div className="flex-1">
          <p className={`text-ui ${completed ? 'text-success line-through' : 'text-text-primary'}`}>
            {text}
          </p>
          {!completed && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-info rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-caption text-text-tertiary">{progress}/{target}</span>
            </div>
          )}
        </div>

        {/* XP */}
        <span className={`text-caption font-medium ${completed ? 'text-success' : 'text-warning'}`}>
          +{xp} XP
        </span>
      </div>
    </div>
  );
}
