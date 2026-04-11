'use client';

import { useState, useEffect, createContext, useContext } from 'react';

// 교육과정 Context
const CurriculumContext = createContext(null);

// 교육과정 상수
export const CURRICULUM_US = 'us';
export const CURRICULUM_KR = 'kr';

// US 과목 (8개)
export const SUBJECTS_US = [
  { id: 'math', name: 'Math', nameKo: '수학', color: 'subj-math', cssVar: '--subj-math' },
  { id: 'english', name: 'English', nameKo: '영어', color: 'subj-english', cssVar: '--subj-english' },
  { id: 'physics', name: 'Physics', nameKo: '물리', color: 'subj-physics', cssVar: '--subj-physics' },
  { id: 'chemistry', name: 'Chemistry', nameKo: '화학', color: 'subj-chemistry', cssVar: '--subj-chemistry' },
  { id: 'biology', name: 'Biology', nameKo: '생물', color: 'subj-biology', cssVar: '--subj-biology' },
  { id: 'history', name: 'History', nameKo: '역사', color: 'subj-history', cssVar: '--subj-history' },
  { id: 'economics', name: 'Economics', nameKo: '경제', color: 'subj-economics', cssVar: '--subj-economics' },
  { id: 'cs', name: 'CS', nameKo: 'CS', color: 'subj-cs', cssVar: '--subj-cs' },
];

// 한국 과목 (10개)
export const SUBJECTS_KR = [
  { id: 'kr-math', name: '수학', nameEn: 'Math', color: 'subj-math', cssVar: '--subj-math' },
  { id: 'kr-english', name: '영어', nameEn: 'English', color: 'subj-english', cssVar: '--subj-english' },
  { id: 'kr-korean', name: '국어', nameEn: 'Korean', color: 'subj-korean', cssVar: '--subj-korean' },
  { id: 'kr-history', name: '한국사', nameEn: 'Korean History', color: 'subj-history', cssVar: '--subj-history' },
  { id: 'kr-society', name: '사회문화', nameEn: 'Society', color: 'subj-society', cssVar: '--subj-society' },
  { id: 'kr-ethics', name: '윤리', nameEn: 'Ethics', color: 'subj-ethics', cssVar: '--subj-ethics' },
  { id: 'kr-physics', name: '물리', nameEn: 'Physics', color: 'subj-physics', cssVar: '--subj-physics' },
  { id: 'kr-chemistry', name: '화학', nameEn: 'Chemistry', color: 'subj-chemistry', cssVar: '--subj-chemistry' },
  { id: 'kr-biology', name: '생명과학', nameEn: 'Biology', color: 'subj-biology', cssVar: '--subj-biology' },
  { id: 'kr-earth-science', name: '지구과학', nameEn: 'Earth Science', color: 'subj-earth', cssVar: '--subj-earth' },
];

// localStorage 키
const STORAGE_KEY = 'curriculum_mode';

/**
 * 교육과정 Provider
 */
export function CurriculumProvider({ children }) {
  const [curriculum, setCurriculumState] = useState(CURRICULUM_US);
  const [isLoaded, setIsLoaded] = useState(false);

  // 초기 로드
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === CURRICULUM_KR || saved === CURRICULUM_US) {
      setCurriculumState(saved);
    }
    setIsLoaded(true);
  }, []);

  // 교육과정 변경
  const setCurriculum = (mode) => {
    if (mode === CURRICULUM_US || mode === CURRICULUM_KR) {
      setCurriculumState(mode);
      localStorage.setItem(STORAGE_KEY, mode);
    }
  };

  // 토글
  const toggleCurriculum = () => {
    const newMode = curriculum === CURRICULUM_US ? CURRICULUM_KR : CURRICULUM_US;
    setCurriculum(newMode);
  };

  // 현재 교육과정의 과목 목록
  const subjects = curriculum === CURRICULUM_KR ? SUBJECTS_KR : SUBJECTS_US;

  // 교육과정 표시명
  const curriculumLabel = curriculum === CURRICULUM_KR ? '한국 (수능)' : 'US (SAT)';

  const value = {
    curriculum,
    setCurriculum,
    toggleCurriculum,
    subjects,
    curriculumLabel,
    isUS: curriculum === CURRICULUM_US,
    isKR: curriculum === CURRICULUM_KR,
    isLoaded,
  };

  return (
    <CurriculumContext.Provider value={value}>
      {children}
    </CurriculumContext.Provider>
  );
}

/**
 * 교육과정 훅
 */
export function useCurriculum() {
  const context = useContext(CurriculumContext);
  if (!context) {
    // Provider 없이 사용할 경우 기본값 반환
    return {
      curriculum: CURRICULUM_US,
      setCurriculum: () => {},
      toggleCurriculum: () => {},
      subjects: SUBJECTS_US,
      curriculumLabel: 'US (SAT)',
      isUS: true,
      isKR: false,
      isLoaded: true,
    };
  }
  return context;
}

/**
 * 개념 ID로 교육과정 판별
 */
export function getCurriculumFromConceptId(conceptId) {
  if (!conceptId) return CURRICULUM_US;
  return conceptId.startsWith('KR-') ? CURRICULUM_KR : CURRICULUM_US;
}

/**
 * 과목 ID로 JSON 파일명 반환
 */
export function getSubjectFileName(subjectId, curriculum) {
  if (curriculum === CURRICULUM_KR || subjectId.startsWith('kr-')) {
    // kr-math → cb-content-kr-math.json
    const suffix = subjectId.replace('kr-', '');
    return `cb-content-kr-${suffix}.json`;
  }
  // US: math → cb-content-math.json
  return `cb-content-${subjectId}.json`;
}
