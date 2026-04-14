'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Gamification Hook
 * XP, 레벨, 뱃지, 일일 미션 관리
 */
export function useGamification(studentId) {
  const [data, setData] = useState({
    totalXp: 0,
    level: { level: 1, title: 'Beginner', titleKo: '입문자' },
    nextLevel: { nextLevel: null, xpNeeded: 100, progress: 0 },
    streak: 0,
    badges: [],
    newBadges: [],
    missions: [],
    nickname: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [xpGain, setXpGain] = useState(null); // 토스트용

  // 새 뱃지 알림 큐
  const [badgeQueue, setBadgeQueue] = useState([]);
  const processingBadge = useRef(false);

  // 데이터 로드
  const fetchGamification = useCallback(async () => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/gamification?student_id=${studentId}`);
      const json = await res.json();

      if (json.error) {
        console.error('Gamification fetch error:', json.error);
        return;
      }

      setData(prev => {
        // 새 뱃지 감지
        if (json.newBadges && json.newBadges.length > 0) {
          setBadgeQueue(q => [...q, ...json.newBadges]);
        }

        // XP 증가 감지
        if (prev.totalXp > 0 && json.totalXp > prev.totalXp) {
          const gained = json.totalXp - prev.totalXp;
          setXpGain(gained);
          setTimeout(() => setXpGain(null), 2500);
        }

        return {
          totalXp: json.totalXp || 0,
          level: json.level || { level: 1, title: 'Beginner', titleKo: '입문자' },
          nextLevel: json.nextLevel || { nextLevel: null, xpNeeded: 100, progress: 0 },
          streak: json.streak || 0,
          badges: json.badges || [],
          newBadges: json.newBadges || [],
          missions: json.missions || [],
          nickname: json.nickname || `Student_${studentId?.slice(0, 4)}`,
          xpBreakdown: json.xpBreakdown,
          streakBonus: json.streakBonus,
        };
      });
    } catch (error) {
      console.error('Failed to fetch gamification:', error);
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  // 초기 로드
  useEffect(() => {
    fetchGamification();
  }, [fetchGamification]);

  // 새 뱃지 처리 (하나씩 표시)
  const processNextBadge = useCallback(async () => {
    if (processingBadge.current || badgeQueue.length === 0) return;

    processingBadge.current = true;
    const badge = badgeQueue[0];

    // 뱃지 획득 API 호출
    try {
      await fetch('/api/gamification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'earn_badge',
          studentId,
          badgeId: badge.id,
        }),
      });
    } catch (error) {
      console.error('Failed to save badge:', error);
    }

    // 3초 후 큐에서 제거
    setTimeout(() => {
      setBadgeQueue(q => q.slice(1));
      processingBadge.current = false;
    }, 3000);
  }, [badgeQueue, studentId]);

  useEffect(() => {
    processNextBadge();
  }, [badgeQueue, processNextBadge]);

  // 닉네임 변경
  const updateNickname = useCallback(async (newNickname) => {
    if (!studentId || !newNickname) return;

    try {
      const res = await fetch('/api/gamification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_nickname',
          studentId,
          nickname: newNickname,
        }),
      });

      if (res.ok) {
        setData(prev => ({ ...prev, nickname: newNickname }));
      }
    } catch (error) {
      console.error('Failed to update nickname:', error);
    }
  }, [studentId]);

  // 데이터 새로고침
  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchGamification();
  }, [fetchGamification]);

  // 현재 표시 중인 새 뱃지
  const currentNewBadge = badgeQueue[0] || null;

  // 일일 미션 완료 개수
  const completedMissions = data.missions.filter(m => m.completed).length;
  const allMissionsComplete = completedMissions === data.missions.length && data.missions.length > 0;

  return {
    ...data,
    isLoading,
    xpGain,
    currentNewBadge,
    completedMissions,
    allMissionsComplete,
    updateNickname,
    refresh,
  };
}

export default useGamification;
