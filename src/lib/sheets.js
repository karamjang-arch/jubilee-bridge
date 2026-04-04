/**
 * Google Sheets API 연동 모듈
 *
 * Sheets 탭 구조 (JubileeBridge):
 *   concepts       - 개념별 학습 기록
 *   daily          - 일일 학습 요약
 *   sat_scores     - SAT 모의고사 점수
 *   users          - 사용자 역할 매핑 (email, role, student_code, name)
 *
 * Phase 1 MVP 추가 탭:
 *   student_profile - 학생 프로필 (name, grade, email, created_at)
 *   assignments     - 과제 (id, student, date, subject, cb_id, title, due_date, status, created_at)
 *   study_timer     - 순공 타이머 (id, student, date, subject, duration_seconds, cb_id, created_at)
 *   memorization    - 암송 (id, student, verse_ref, verse_ko, verse_en, status, completed_at)
 *   devotion        - 묵상 (id, student, date, passage, memo, created_at)
 *   my_vocabulary   - 단어장 (id, student, word, met_in_book, met_in_cb, date_added, review_count, status)
 */

const API_KEY = process.env.NEXT_PUBLIC_SHEETS_API_KEY;
const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID || '1gcCoEC0LvKTefu8FW6V90T20WZ0l1phQ9-NRNb8xFzI';
const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;

/**
 * Sheets 탭에서 데이터를 가져와 객체 배열로 변환
 * 첫 행을 헤더로 사용
 */
async function fetchTab(tabName) {
  const url = `${BASE_URL}/${encodeURIComponent(tabName)}?key=${API_KEY}`;
  
  try {
    const res = await fetch(url, { next: { revalidate: 60 } }); // 60초 캐시
    
    if (!res.ok) {
      console.error(`Sheets API error for tab "${tabName}": ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    const rows = data.values;
    
    if (!rows || rows.length < 2) return [];
    
    const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] || '';
      });
      return obj;
    });
  } catch (err) {
    console.error(`Failed to fetch tab "${tabName}":`, err);
    return [];
  }
}

/**
 * concepts 탭: 숫자 필드 파싱
 */
export async function fetchConcepts() {
  const raw = await fetchTab('concepts');
  return raw.map(row => ({
    ...row,
    mastery: parseFloat(row.mastery) || 0,
    study_minutes: parseInt(row.study_minutes) || 0,
  }));
}

/**
 * daily 탭: 숫자 필드 파싱
 */
export async function fetchDaily() {
  const raw = await fetchTab('daily');
  return raw.map(row => ({
    ...row,
    total_minutes: parseInt(row.total_minutes) || 0,
    new_concepts: parseInt(row.new_concepts) || 0,
    reviewed: parseInt(row.reviewed) || 0,
    mastery_change: parseFloat(row.mastery_change) || 0,
    xp: parseInt(row.xp) || 0,
    streak: parseInt(row.streak) || 0,
  }));
}

/**
 * sat_scores 탭
 */
export async function fetchSATScores() {
  const raw = await fetchTab('sat_scores');
  return raw.map(row => ({
    ...row,
    rw_score: parseInt(row.rw_score) || 0,
    math_score: parseInt(row.math_score) || 0,
    total_score: parseInt(row.total_score) || 0,
  }));
}

/**
 * users 탭: 역할 매핑
 */
export async function fetchUsers() {
  return fetchTab('users');
}

/**
 * 특정 학생의 역할 확인
 */
export async function getUserByEmail(email) {
  const users = await fetchUsers();
  return users.find(u => u.email === email) || null;
}

/**
 * 모든 학생 코드 목록
 */
export async function getStudentCodes() {
  const users = await fetchUsers();
  return users.filter(u => u.role === 'student').map(u => u.student_code);
}

// ============================================
// Phase 1 MVP 추가 함수들
// ============================================

/**
 * student_profile 탭
 */
export async function fetchStudentProfiles() {
  return fetchTab('student_profile');
}

/**
 * assignments 탭: 과제 목록
 */
export async function fetchAssignments() {
  const raw = await fetchTab('assignments');
  return raw.map(row => ({
    ...row,
    due_date: row.due_date ? new Date(row.due_date) : null,
    created_at: row.created_at ? new Date(row.created_at) : null,
  }));
}

/**
 * study_timer 탭: 순공 시간 기록
 */
export async function fetchStudyTimer() {
  const raw = await fetchTab('study_timer');
  return raw.map(row => ({
    ...row,
    duration_seconds: parseInt(row.duration_seconds) || 0,
    created_at: row.created_at ? new Date(row.created_at) : null,
  }));
}

/**
 * memorization 탭: 암송 기록
 */
export async function fetchMemorization() {
  const raw = await fetchTab('memorization');
  return raw.map(row => ({
    ...row,
    completed_at: row.completed_at ? new Date(row.completed_at) : null,
  }));
}

/**
 * devotion 탭: 묵상 기록
 */
export async function fetchDevotion() {
  const raw = await fetchTab('devotion');
  return raw.map(row => ({
    ...row,
    created_at: row.created_at ? new Date(row.created_at) : null,
  }));
}

/**
 * my_vocabulary 탭: 내 단어장
 */
export async function fetchMyVocabulary() {
  const raw = await fetchTab('my_vocabulary');
  return raw.map(row => ({
    ...row,
    review_count: parseInt(row.review_count) || 0,
    date_added: row.date_added ? new Date(row.date_added) : null,
  }));
}

/**
 * 학생별 주간 학습 시간 집계
 */
export async function getWeeklyStudyTime(student, weekStart) {
  const timerData = await fetchStudyTimer();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return timerData
    .filter(row =>
      row.student === student &&
      row.created_at >= weekStart &&
      row.created_at < weekEnd
    )
    .reduce((acc, row) => {
      const subject = row.subject || 'other';
      acc[subject] = (acc[subject] || 0) + row.duration_seconds;
      acc.total = (acc.total || 0) + row.duration_seconds;
      return acc;
    }, {});
}
