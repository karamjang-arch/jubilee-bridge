/**
 * Badge System - Definitions and Conditions
 */

// 뱃지 정의
export const BADGES = [
  {
    id: 'first_step',
    name: 'First Step',
    nameKo: '첫 걸음',
    description: '첫 퀴즈 정답',
    icon: '🌱',
    color: '#43a047', // green
    category: 'milestone',
  },
  {
    id: 'math_explorer',
    name: 'Math Explorer',
    nameKo: '수학 탐험가',
    description: '수학 10개념 마스터',
    icon: '🔢',
    color: '#fb8c00', // math orange
    category: 'subject',
  },
  {
    id: 'physics_pioneer',
    name: 'Physics Pioneer',
    nameKo: '물리 개척자',
    description: '물리 5개념 마스터',
    icon: '⚛️',
    color: '#1e88e5', // physics blue
    category: 'subject',
  },
  {
    id: 'english_ace',
    name: 'English Ace',
    nameKo: '영어 에이스',
    description: '영어 10개념 마스터',
    icon: '📝',
    color: '#43a047', // english green
    category: 'subject',
  },
  {
    id: 'streak_7',
    name: 'Streak 7',
    nameKo: '7일 연속',
    description: '7일 연속 학습',
    icon: '🔥',
    color: '#ff5722', // orange-red
    category: 'streak',
  },
  {
    id: 'streak_30',
    name: 'Streak 30',
    nameKo: '30일 연속',
    description: '30일 연속 학습',
    icon: '💎',
    color: '#2196f3', // blue
    category: 'streak',
  },
  {
    id: 'test_ace',
    name: 'Test Ace',
    nameKo: '테스트 에이스',
    description: '모의고사 80%+',
    icon: '🎯',
    color: '#9c27b0', // purple
    category: 'achievement',
  },
  {
    id: 'university_ready',
    name: 'University Ready',
    nameKo: '대학 준비 완료',
    description: '스킬맵 과목 80%+ 달성',
    icon: '🎓',
    color: '#673ab7', // deep purple
    category: 'achievement',
  },
  {
    id: 'perfect_score',
    name: 'Perfect Score',
    nameKo: '만점',
    description: '모의고사 100%',
    icon: '⭐',
    color: '#ffc107', // amber
    category: 'achievement',
  },
  {
    id: 'tutor_friend',
    name: 'Tutor Friend',
    nameKo: '튜터 친구',
    description: '튜터와 10회 대화',
    icon: '🤖',
    color: '#00bcd4', // cyan
    category: 'social',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    nameKo: '올빼미',
    description: '밤 10시 이후 학습',
    icon: '🦉',
    color: '#3f51b5', // indigo
    category: 'special',
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    nameKo: '아침형 인간',
    description: '아침 6시 이전 학습',
    icon: '🐦',
    color: '#ff9800', // orange
    category: 'special',
  },
];

/**
 * 뱃지 획득 조건 체크
 * @param {string} badgeId - 뱃지 ID
 * @param {Object} stats - 학습 통계
 * @returns {boolean} 획득 여부
 */
export function checkBadgeCondition(badgeId, stats) {
  const {
    totalCorrectAnswers = 0,
    masteredBySubject = {},
    streak = 0,
    testScores = [],
    tutorSessions = 0,
    studyHours = [],
    totalMasteredPercent = 0,
  } = stats;

  switch (badgeId) {
    case 'first_step':
      return totalCorrectAnswers >= 1;

    case 'math_explorer':
      return (masteredBySubject.math || 0) >= 10;

    case 'physics_pioneer':
      return (masteredBySubject.physics || 0) >= 5;

    case 'english_ace':
      return (masteredBySubject.english || 0) >= 10;

    case 'streak_7':
      return streak >= 7;

    case 'streak_30':
      return streak >= 30;

    case 'test_ace':
      return testScores.some(score => score >= 80);

    case 'perfect_score':
      return testScores.some(score => score === 100);

    case 'university_ready':
      return totalMasteredPercent >= 80;

    case 'tutor_friend':
      return tutorSessions >= 10;

    case 'night_owl':
      // 밤 10시(22시) 이후 학습 기록이 있는지
      return studyHours.some(hour => hour >= 22);

    case 'early_bird':
      // 아침 6시 이전 학습 기록이 있는지
      return studyHours.some(hour => hour < 6);

    default:
      return false;
  }
}

/**
 * 모든 뱃지 획득 상태 계산
 * @param {Object} stats - 학습 통계
 * @param {Array} earnedBadges - 이미 획득한 뱃지 목록
 * @returns {Array} 뱃지 상태 목록
 */
export function getAllBadgeStatus(stats, earnedBadges = []) {
  const earnedIds = new Set(earnedBadges.map(b => b.badge_id || b.id));

  return BADGES.map(badge => {
    const isEarned = earnedIds.has(badge.id);
    const canEarn = !isEarned && checkBadgeCondition(badge.id, stats);

    return {
      ...badge,
      earned: isEarned,
      canEarn,
      earnedDate: earnedBadges.find(b => (b.badge_id || b.id) === badge.id)?.earned_date,
    };
  });
}

/**
 * 새로 획득 가능한 뱃지 찾기
 * @param {Object} stats - 학습 통계
 * @param {Array} earnedBadges - 이미 획득한 뱃지 목록
 * @returns {Array} 새로 획득 가능한 뱃지 목록
 */
export function findNewBadges(stats, earnedBadges = []) {
  const earnedIds = new Set(earnedBadges.map(b => b.badge_id || b.id));

  return BADGES.filter(badge => {
    if (earnedIds.has(badge.id)) return false;
    return checkBadgeCondition(badge.id, stats);
  });
}

/**
 * concept_history에서 뱃지 체크용 통계 계산
 */
export function calculateBadgeStats(events, conceptProgress = []) {
  const stats = {
    totalCorrectAnswers: 0,
    masteredBySubject: {},
    streak: 0,
    testScores: [],
    tutorSessions: 0,
    studyHours: [],
    totalMasteredPercent: 0,
  };

  // 이벤트에서 통계 추출
  for (const event of events) {
    // 정답 수
    if (event.event_type === 'test_attempt' || event.event_type === 'test_complete') {
      stats.totalCorrectAnswers += event.detail?.correct || 0;
      if (event.score !== null && event.score !== undefined) {
        stats.testScores.push(event.score);
      }
    }

    // 튜터 세션
    if (event.event_type === 'tutor_session') {
      stats.tutorSessions++;
    }

    // 학습 시간대
    if (event.timestamp) {
      const hour = new Date(event.timestamp).getHours();
      stats.studyHours.push(hour);
    }
  }

  // 과목별 마스터 개수
  for (const progress of conceptProgress) {
    if (progress.status === 'mastered' || progress.status === 'placement_mastered') {
      const subject = progress.subject || extractSubjectFromConceptId(progress.concept_id);
      stats.masteredBySubject[subject] = (stats.masteredBySubject[subject] || 0) + 1;
    }
  }

  return stats;
}

/**
 * concept_id에서 과목 추출
 */
function extractSubjectFromConceptId(conceptId) {
  if (!conceptId) return 'unknown';

  const prefix = conceptId.split('-')[0]?.toUpperCase();
  const subjectMap = {
    'MATH': 'math',
    'ENG': 'english',
    'PHYS': 'physics',
    'CHEM': 'chemistry',
    'BIO': 'biology',
    'HIST': 'history',
    'ECON': 'economics',
    'CS': 'cs',
    'KR': 'korean',
  };

  return subjectMap[prefix] || 'unknown';
}

/**
 * 뱃지 ID로 뱃지 정보 가져오기
 */
export function getBadgeById(badgeId) {
  return BADGES.find(b => b.id === badgeId) || null;
}

/**
 * 카테고리별 뱃지 그룹화
 */
export function getBadgesByCategory() {
  const categories = {};
  for (const badge of BADGES) {
    if (!categories[badge.category]) {
      categories[badge.category] = [];
    }
    categories[badge.category].push(badge);
  }
  return categories;
}
