'use client';

import { useState, useEffect, useCallback } from 'react';

// 개념 상태 4종
export const CONCEPT_STATUS = {
  LOCKED: 'locked',           // prerequisites 미충족
  AVAILABLE: 'available',     // prerequisites 충족, 도전 가능
  REVIEW_NEEDED: 'review_needed', // 시간 초과 맞힘 or 부분 통과
  MASTERED: 'mastered',       // 도전 통과
  PLACEMENT_MASTERED: 'placement_mastered', // 온보딩에서 자동 마스터
};

// Entry-point 개념 목록 (prerequisites가 없는 개념)
const ENTRY_POINTS = {
  math: ['MATH-K-CC-A-S1', 'MATH-K-CC-A-S2', 'MATH-K-CC-B-S1'],
  english: ['ENG-VOC-001', 'ENG-READ-001', 'ENG-GRAM-001'],
  physics: ['PHYS-MECH-001', 'PHYS-UNIT-001'],
  chemistry: ['CHEM-ATOM-001', 'CHEM-MAT-001'],
  biology: ['BIO-CELL-001', 'BIO-LIFE-001'],
  history: ['HIST-ANC-001', 'HIST-WH-001'],
  economics: ['ECON-INTRO-001', 'ECON-MIC-001'],
  cs: ['CS-PROG-001', 'CS-ALGO-001'],
};

export function useConceptProgress(studentId) {
  const [progress, setProgress] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // 진행 상태 로드
  useEffect(() => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/sheets?tab=concept_progress&student=${studentId}`);
        const { data } = await res.json();

        // 맵으로 변환
        const progressMap = {};
        data?.forEach(item => {
          progressMap[item.concept_id] = {
            status: item.status,
            diagnosed_weakness: item.diagnosed_weakness || null,
            mastered_at: item.mastered_at || null,
          };
        });
        setProgress(progressMap);
      } catch (error) {
        console.error('Failed to load progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, [studentId]);

  // 개념 상태 가져오기 (실제 로직: prerequisites 체크)
  const getConceptStatus = useCallback((conceptId, subject, prerequisites = []) => {
    // 이미 저장된 상태가 있으면 반환
    const savedProgress = progress[conceptId];
    if (savedProgress?.status) {
      return savedProgress.status;
    }

    // Entry-point 개념은 기본 available
    const entryPoints = ENTRY_POINTS[subject] || [];
    if (entryPoints.includes(conceptId)) {
      return CONCEPT_STATUS.AVAILABLE;
    }

    // Prerequisites가 없으면 available
    if (!prerequisites || prerequisites.length === 0) {
      return CONCEPT_STATUS.AVAILABLE;
    }

    // Prerequisites가 모두 mastered 또는 placement_mastered면 available
    const allPrereqsMastered = prerequisites.every(prereqId => {
      const prereqStatus = progress[prereqId]?.status;
      return prereqStatus === CONCEPT_STATUS.MASTERED ||
             prereqStatus === CONCEPT_STATUS.PLACEMENT_MASTERED;
    });

    return allPrereqsMastered ? CONCEPT_STATUS.AVAILABLE : CONCEPT_STATUS.LOCKED;
  }, [progress]);

  // 진단 결과 저장 (diagnosed_weakness 포함)
  const saveDiagnosis = useCallback(async (conceptId, status, diagnosedWeakness = null) => {
    if (!studentId) return;

    const newProgress = {
      [conceptId]: {
        status,
        diagnosed_weakness: diagnosedWeakness,
        mastered_at: status === CONCEPT_STATUS.MASTERED ? new Date().toISOString() : null,
      },
    };

    // 상태 업데이트
    setProgress(prev => ({ ...prev, ...newProgress }));

    // API 저장
    try {
      await fetch('/api/sheets?tab=concept_progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student: studentId,
          concept_id: conceptId,
          status,
          diagnosed_weakness: diagnosedWeakness,
          mastered_at: status === CONCEPT_STATUS.MASTERED ? new Date().toISOString() : null,
        }),
      });
    } catch (error) {
      console.error('Failed to save diagnosis:', error);
    }
  }, [studentId]);

  // 개념 마스터 처리
  const markMastered = useCallback(async (conceptId, subject, prerequisites = []) => {
    if (!studentId) return;

    const newStatus = {
      [conceptId]: {
        status: CONCEPT_STATUS.MASTERED,
        diagnosed_weakness: null,
        mastered_at: new Date().toISOString(),
      }
    };

    // 역방향 전파: 상위 개념 mastered 시 prerequisite 체인 전체 자동 mastered
    const markPrereqsMastered = (prereqs) => {
      prereqs?.forEach(prereqId => {
        if (progress[prereqId]?.status !== CONCEPT_STATUS.MASTERED) {
          newStatus[prereqId] = {
            status: CONCEPT_STATUS.MASTERED,
            diagnosed_weakness: null,
            mastered_at: new Date().toISOString(),
          };
        }
      });
    };
    markPrereqsMastered(prerequisites);

    // 상태 업데이트
    setProgress(prev => ({ ...prev, ...newStatus }));

    // API 저장
    try {
      for (const [id, data] of Object.entries(newStatus)) {
        await fetch('/api/sheets?tab=concept_progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student: studentId,
            concept_id: id,
            status: data.status,
            diagnosed_weakness: data.diagnosed_weakness,
            mastered_at: data.mastered_at,
          }),
        });
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [studentId, progress]);

  // review_needed 상태로 표시
  const markReviewNeeded = useCallback(async (conceptId) => {
    await saveDiagnosis(conceptId, CONCEPT_STATUS.REVIEW_NEEDED);
  }, [saveDiagnosis]);

  // 전체 리셋 (관리자 전용)
  const resetAllProgress = useCallback(async (targetStudent = 'all') => {
    try {
      await fetch('/api/sheets?tab=reset_progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student: targetStudent }),
      });
      setProgress({});
    } catch (error) {
      console.error('Failed to reset progress:', error);
    }
  }, []);

  // 진단된 약점 가져오기
  const getDiagnosedWeakness = useCallback((conceptId) => {
    return progress[conceptId]?.diagnosed_weakness || null;
  }, [progress]);

  return {
    progress,
    isLoading,
    getConceptStatus,
    markMastered,
    markReviewNeeded,
    saveDiagnosis,
    getDiagnosedWeakness,
    resetAllProgress,
    CONCEPT_STATUS,
  };
}

export default useConceptProgress;
