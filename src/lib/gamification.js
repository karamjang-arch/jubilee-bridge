/**
 * Gamification System - Core Library
 * XP, Levels, Streaks, Daily Missions
 */

// XP 점수 규칙
export const XP_RULES = {
  QUIZ_CORRECT: 10,        // 퀴즈 정답
  QUIZ_ATTEMPT: 2,         // 퀴즈 오답 (시도 자체)
  CONCEPT_MASTERED: 50,    // 개념 마스터 달성
  TEST_COMPLETE: 100,      // 모의고사 완료
  TUTOR_SESSION: 15,       // 튜터 대화 1세션
  STREAK_3_DAYS: 30,       // 연속 학습 3일 보너스
  STREAK_7_DAYS: 100,      // 연속 학습 7일 보너스
  DAILY_MISSION_COMPLETE: 50, // 일일 미션 3/3 완료 보너스
};

// 레벨 시스템
export const LEVELS = [
  { level: 1, xpRequired: 0, title: 'Beginner', titleKo: '입문자' },
  { level: 2, xpRequired: 100, title: 'Explorer', titleKo: '탐험가' },
  { level: 3, xpRequired: 300, title: 'Learner', titleKo: '학습자' },
  { level: 4, xpRequired: 600, title: 'Scholar', titleKo: '학자' },
  { level: 5, xpRequired: 1000, title: 'Expert', titleKo: '전문가' },
  { level: 6, xpRequired: 1500, title: 'Master', titleKo: '마스터' },
  { level: 7, xpRequired: 2500, title: 'Genius', titleKo: '천재' },
];

/**
 * XP로 현재 레벨 계산
 */
export function calculateLevel(totalXp) {
  let currentLevel = LEVELS[0];
  for (const level of LEVELS) {
    if (totalXp >= level.xpRequired) {
      currentLevel = level;
    } else {
      break;
    }
  }
  return currentLevel;
}

/**
 * 다음 레벨까지 필요한 XP 계산
 */
export function getXpToNextLevel(totalXp) {
  const currentLevel = calculateLevel(totalXp);
  const nextLevelIndex = LEVELS.findIndex(l => l.level === currentLevel.level) + 1;

  if (nextLevelIndex >= LEVELS.length) {
    return { nextLevel: null, xpNeeded: 0, progress: 100 };
  }

  const nextLevel = LEVELS[nextLevelIndex];
  const xpNeeded = nextLevel.xpRequired - totalXp;
  const levelRange = nextLevel.xpRequired - currentLevel.xpRequired;
  const progressInLevel = totalXp - currentLevel.xpRequired;
  const progress = Math.round((progressInLevel / levelRange) * 100);

  return { nextLevel, xpNeeded, progress };
}

/**
 * concept_history 이벤트에서 XP 계산
 */
export function calculateXpFromEvents(events) {
  let totalXp = 0;
  const xpBreakdown = {
    quizCorrect: 0,
    quizAttempt: 0,
    conceptMastered: 0,
    testComplete: 0,
    tutorSession: 0,
    streakBonus: 0,
  };

  for (const event of events) {
    switch (event.event_type) {
      case 'test_attempt':
        // 퀴즈 시도
        if (event.detail?.correct) {
          const correct = event.detail.correct;
          const total = event.detail.total || correct;
          const wrong = total - correct;
          xpBreakdown.quizCorrect += correct * XP_RULES.QUIZ_CORRECT;
          xpBreakdown.quizAttempt += wrong * XP_RULES.QUIZ_ATTEMPT;
          totalXp += correct * XP_RULES.QUIZ_CORRECT + wrong * XP_RULES.QUIZ_ATTEMPT;
        }
        break;

      case 'test_complete':
        // 모의고사 완료
        xpBreakdown.testComplete += XP_RULES.TEST_COMPLETE;
        totalXp += XP_RULES.TEST_COMPLETE;
        // 정답/오답도 계산
        if (event.detail?.correct !== undefined) {
          const correct = event.detail.correct;
          const total = event.detail.total || correct;
          const wrong = total - correct;
          xpBreakdown.quizCorrect += correct * XP_RULES.QUIZ_CORRECT;
          xpBreakdown.quizAttempt += wrong * XP_RULES.QUIZ_ATTEMPT;
          totalXp += correct * XP_RULES.QUIZ_CORRECT + wrong * XP_RULES.QUIZ_ATTEMPT;
        }
        break;

      case 'mastery_update':
        // 개념 마스터
        if (event.detail?.status === 'mastered') {
          xpBreakdown.conceptMastered += XP_RULES.CONCEPT_MASTERED;
          totalXp += XP_RULES.CONCEPT_MASTERED;
        }
        break;

      case 'tutor_session':
        // 튜터 세션
        xpBreakdown.tutorSession += XP_RULES.TUTOR_SESSION;
        totalXp += XP_RULES.TUTOR_SESSION;
        break;
    }
  }

  return { totalXp, xpBreakdown };
}

/**
 * 연속 학습일(스트릭) 계산
 */
export function calculateStreak(events, referenceDate = new Date()) {
  // 날짜별로 이벤트 그룹화
  const dateSet = new Set();
  for (const event of events) {
    if (event.timestamp) {
      const date = event.timestamp.split('T')[0];
      dateSet.add(date);
    }
  }

  const sortedDates = Array.from(dateSet).sort().reverse();
  if (sortedDates.length === 0) return 0;

  let streak = 0;
  const today = referenceDate.toISOString().split('T')[0];

  for (let i = 0; i <= sortedDates.length; i++) {
    const expectedDate = new Date(referenceDate);
    expectedDate.setDate(expectedDate.getDate() - i);
    const expected = expectedDate.toISOString().split('T')[0];

    if (sortedDates.includes(expected)) {
      streak++;
    } else if (i === 0) {
      // 오늘 활동이 없어도 어제부터 계산
      continue;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * 스트릭 보너스 XP 계산
 */
export function calculateStreakBonus(streak) {
  let bonus = 0;
  if (streak >= 7) {
    bonus += XP_RULES.STREAK_7_DAYS;
  } else if (streak >= 3) {
    bonus += XP_RULES.STREAK_3_DAYS;
  }
  return bonus;
}

/**
 * 일일 미션 생성 (날짜 기반 시드)
 */
export function generateDailyMissions(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  const seed = dateStr.split('-').reduce((a, b) => a + parseInt(b), 0);

  // 미션 풀
  const missionPool = {
    review: [
      { id: 'review_3', text: '오늘 3개 개념 복습하기', target: 3, xp: 20 },
      { id: 'review_5', text: '오늘 5개 개념 복습하기', target: 5, xp: 25 },
    ],
    challenge: [
      { id: 'master_1', text: '새로운 개념 1개 마스터하기', target: 1, xp: 30 },
      { id: 'master_2', text: '새로운 개념 2개 마스터하기', target: 2, xp: 40 },
    ],
    explore: [
      { id: 'tutor_1', text: 'AI 튜터와 대화하기', target: 1, xp: 15 },
      { id: 'quiz_10', text: '퀴즈 10문제 풀기', target: 10, xp: 20 },
    ],
  };

  // 날짜 기반으로 미션 선택
  const reviewMission = missionPool.review[seed % missionPool.review.length];
  const challengeMission = missionPool.challenge[(seed + 1) % missionPool.challenge.length];
  const exploreMission = missionPool.explore[(seed + 2) % missionPool.explore.length];

  return [
    { ...reviewMission, type: 'review', icon: '📚' },
    { ...challengeMission, type: 'challenge', icon: '🎯' },
    { ...exploreMission, type: 'explore', icon: '🔍' },
  ];
}

/**
 * 일일 미션 완료 여부 체크
 */
export function checkMissionCompletion(mission, events, today) {
  const todayEvents = events.filter(e => e.timestamp?.startsWith(today));

  switch (mission.id) {
    case 'review_3':
    case 'review_5':
      const reviewCount = todayEvents.filter(e =>
        e.event_type === 'content_view' || e.event_type === 'test_attempt'
      ).length;
      return reviewCount >= mission.target;

    case 'master_1':
    case 'master_2':
      const masteredCount = todayEvents.filter(e =>
        e.event_type === 'mastery_update' && e.detail?.status === 'mastered'
      ).length;
      return masteredCount >= mission.target;

    case 'tutor_1':
      const tutorCount = todayEvents.filter(e => e.event_type === 'tutor_session').length;
      return tutorCount >= mission.target;

    case 'quiz_10':
      let quizCount = 0;
      for (const e of todayEvents) {
        if (e.event_type === 'test_attempt' || e.event_type === 'test_complete') {
          quizCount += e.detail?.total || 1;
        }
      }
      return quizCount >= mission.target;

    default:
      return false;
  }
}

/**
 * 일일 미션 진행도 계산
 */
export function getMissionProgress(mission, events, today) {
  const todayEvents = events.filter(e => e.timestamp?.startsWith(today));

  switch (mission.id) {
    case 'review_3':
    case 'review_5':
      return todayEvents.filter(e =>
        e.event_type === 'content_view' || e.event_type === 'test_attempt'
      ).length;

    case 'master_1':
    case 'master_2':
      return todayEvents.filter(e =>
        e.event_type === 'mastery_update' && e.detail?.status === 'mastered'
      ).length;

    case 'tutor_1':
      return todayEvents.filter(e => e.event_type === 'tutor_session').length;

    case 'quiz_10':
      let quizCount = 0;
      for (const e of todayEvents) {
        if (e.event_type === 'test_attempt' || e.event_type === 'test_complete') {
          quizCount += e.detail?.total || 1;
        }
      }
      return quizCount;

    default:
      return 0;
  }
}
