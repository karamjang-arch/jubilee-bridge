'use client';

import { useState } from 'react';
import { getBadgesByCategory } from '@/lib/badges';

/**
 * 뱃지 표시 컴포넌트
 */
export function BadgeItem({ badge, size = 'md' }) {
  const sizeClasses = {
    sm: 'w-10 h-10 text-lg',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-4xl',
  };

  const isEarned = badge.earned;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center transition-all ${
          isEarned
            ? 'shadow-raised'
            : 'bg-progress-locked opacity-50 grayscale'
        }`}
        style={isEarned ? { backgroundColor: badge.color + '20', border: `2px solid ${badge.color}` } : {}}
        title={isEarned ? badge.description : `잠김: ${badge.description}`}
      >
        {isEarned ? (
          <span>{badge.icon}</span>
        ) : (
          <span className="text-text-disabled text-sm">?</span>
        )}
      </div>
      {size !== 'sm' && (
        <span className={`text-caption text-center ${isEarned ? 'text-text-secondary' : 'text-text-disabled'}`}>
          {badge.nameKo}
        </span>
      )}
    </div>
  );
}

/**
 * 뱃지 그리드 컴포넌트
 */
export default function BadgeCard({ badges = [], showAll = false }) {
  const [expanded, setExpanded] = useState(false);

  // 획득한 뱃지 먼저, 그 다음 획득 가능한 뱃지
  const sortedBadges = [...badges].sort((a, b) => {
    if (a.earned && !b.earned) return -1;
    if (!a.earned && b.earned) return 1;
    if (a.canEarn && !b.canEarn) return -1;
    if (!a.canEarn && b.canEarn) return 1;
    return 0;
  });

  const earnedCount = badges.filter(b => b.earned).length;
  const displayBadges = expanded || showAll ? sortedBadges : sortedBadges.slice(0, 6);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-subheading text-text-primary flex items-center gap-2">
          <span>내 뱃지</span>
          <span className="text-caption text-warning font-medium">{earnedCount}/{badges.length}</span>
        </h3>
        {badges.length > 6 && !showAll && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-caption text-info hover:underline"
          >
            {expanded ? '접기' : '모두 보기'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-6 gap-3">
        {displayBadges.map(badge => (
          <BadgeItem key={badge.id} badge={badge} size="sm" />
        ))}
      </div>

      {earnedCount === 0 && (
        <p className="text-caption text-text-tertiary mt-3 text-center">
          아직 획득한 뱃지가 없습니다. 학습을 시작해보세요!
        </p>
      )}
    </div>
  );
}

/**
 * 뱃지 상세 모달용 컴포넌트
 */
export function BadgeGrid({ badges = [] }) {
  const categories = getBadgesByCategory();
  const categoryLabels = {
    milestone: '마일스톤',
    subject: '과목 달성',
    streak: '연속 학습',
    achievement: '성취',
    social: '소셜',
    special: '스페셜',
  };

  return (
    <div className="space-y-6">
      {Object.entries(categories).map(([category, categoryBadges]) => (
        <div key={category}>
          <h4 className="text-ui text-text-secondary mb-3">{categoryLabels[category] || category}</h4>
          <div className="grid grid-cols-4 gap-4">
            {categoryBadges.map(defBadge => {
              const badge = badges.find(b => b.id === defBadge.id) || { ...defBadge, earned: false };
              return <BadgeItem key={badge.id} badge={badge} size="md" />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
