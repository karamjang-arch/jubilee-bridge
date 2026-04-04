'use client';

import { useState, useEffect, useCallback } from 'react';

// Entry-point 개념 목록 (prerequisites가 없는 개념)
const ENTRY_POINTS = {
  math: ['MATH-NUM-001', 'MATH-NUM-002', 'MATH-NUM-003'],
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
          progressMap[item.concept_id] = item.status;
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
    const savedStatus = progress[conceptId];
    if (savedStatus) {
      return savedStatus; // mastered, placement_mastered 등
    }

    // Entry-point 개념은 기본 available
    const entryPoints = ENTRY_POINTS[subject] || [];
    if (entryPoints.includes(conceptId)) {
      return 'available';
    }

    // Prerequisites가 없으면 available
    if (!prerequisites || prerequisites.length === 0) {
      return 'available';
    }

    // Prerequisites가 모두 mastered 또는 placement_mastered면 available
    const allPrereqsMastered = prerequisites.every(prereqId => {
      const prereqStatus = progress[prereqId];
      return prereqStatus === 'mastered' || prereqStatus === 'placement_mastered';
    });

    return allPrereqsMastered ? 'available' : 'locked';
  }, [progress]);

  // 개념 마스터 처리
  const markMastered = useCallback(async (conceptId, subject, prerequisites = []) => {
    if (!studentId) return;

    const newStatus = { [conceptId]: 'mastered' };

    // 역방향 전파: 상위 개념 mastered 시 prerequisite 체인 전체 자동 mastered
    const markPrereqsMastered = (prereqs) => {
      prereqs?.forEach(prereqId => {
        if (progress[prereqId] !== 'mastered') {
          newStatus[prereqId] = 'mastered';
        }
      });
    };
    markPrereqsMastered(prerequisites);

    // 상태 업데이트
    setProgress(prev => ({ ...prev, ...newStatus }));

    // API 저장
    try {
      for (const [id, status] of Object.entries(newStatus)) {
        await fetch('/api/sheets?tab=concept_progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student: studentId,
            concept_id: id,
            status,
            mastered_at: new Date().toISOString(),
          }),
        });
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [studentId, progress]);

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

  return {
    progress,
    isLoading,
    getConceptStatus,
    markMastered,
    resetAllProgress,
  };
}

export default useConceptProgress;
