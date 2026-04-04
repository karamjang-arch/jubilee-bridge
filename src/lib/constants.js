// 8과목 정의
export const SUBJECTS = [
  { id: 'math', name: '수학', nameEn: 'Math', color: 'subj-math', cssVar: '--subj-math', count: 1114 },
  { id: 'english', name: '영어', nameEn: 'English', color: 'subj-english', cssVar: '--subj-english', count: 820 },
  { id: 'physics', name: '물리', nameEn: 'Physics', color: 'subj-physics', cssVar: '--subj-physics', count: 498 },
  { id: 'chemistry', name: '화학', nameEn: 'Chemistry', color: 'subj-chemistry', cssVar: '--subj-chemistry', count: 400 },
  { id: 'biology', name: '생물', nameEn: 'Biology', color: 'subj-biology', cssVar: '--subj-biology', count: 399 },
  { id: 'history', name: '역사', nameEn: 'History', color: 'subj-history', cssVar: '--subj-history', count: 500 },
  { id: 'economics', name: '경제', nameEn: 'Economics', color: 'subj-economics', cssVar: '--subj-economics', count: 300 },
  { id: 'cs', name: 'CS', nameEn: 'CS', color: 'subj-cs', cssVar: '--subj-cs', count: 320 },
];

export const TOTAL_CONCEPTS = SUBJECTS.reduce((sum, s) => sum + s.count, 0);

// 과목 ID로 과목 정보 찾기
export function getSubject(subjectId) {
  return SUBJECTS.find(s => s.id === subjectId);
}

// 과목 색상 가져오기 (CSS var 값)
export function getSubjectColor(subjectId) {
  const subject = getSubject(subjectId);
  return subject ? `var(${subject.cssVar})` : 'var(--text-tertiary)';
}

// 과목 라이트 색상 가져오기
export function getSubjectLightColor(subjectId) {
  const subject = getSubject(subjectId);
  return subject ? `var(${subject.cssVar}-light)` : 'var(--bg-hover)';
}

// Google Sheets 설정
export const SHEETS_CONFIG = {
  spreadsheetId: '1gcCoEC0LvKTefu8FW6V90T20WZ0l1phQ9-NRNb8xFzI',
  tabs: {
    studentProfile: 'student_profile',
    assignments: 'assignments',
    studyTimer: 'study_timer',
    memorization: 'memorization',
    devotion: 'devotion',
    myVocabulary: 'my_vocabulary',
  }
};

// Notion 설정 (D6 암송)
export const NOTION_CONFIG = {
  apiKey: process.env.NOTION_API_KEY || '',
};

// 노드 상태
export const NODE_STATUS = {
  LOCKED: 'locked',
  AVAILABLE: 'available',
  MASTERED: 'mastered',
  CURRENT: 'current',
};

// Bloom Levels
export const BLOOM_LEVELS = [
  { level: 1, name: 'Remember', nameKo: '기억' },
  { level: 2, name: 'Understand', nameKo: '이해' },
  { level: 3, name: 'Apply', nameKo: '적용' },
  { level: 4, name: 'Analyze', nameKo: '분석' },
  { level: 5, name: 'Evaluate', nameKo: '평가' },
  { level: 6, name: 'Create', nameKo: '창조' },
];

// Learning Pathways
export const LEARNING_PATHWAYS = [
  { id: 'real_life', name: '실생활', icon: '🌍' },
  { id: 'visual', name: '시각', icon: '👁️' },
  { id: 'procedural', name: '절차', icon: '📋' },
  { id: 'analogy', name: '비유', icon: '🔗' },
  { id: 'error_correction', name: '오류 교정', icon: '❌' },
];
