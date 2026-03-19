/**
 * Google Sheets API 연동 모듈
 * 
 * Sheets 탭 구조 (WisdomDock_Progress):
 *   concepts   - 개념별 학습 기록
 *   daily      - 일일 학습 요약
 *   sat_scores - SAT 모의고사 점수
 *   users      - 사용자 역할 매핑 (email, role, student_code, name)
 */

const API_KEY = process.env.NEXT_PUBLIC_SHEETS_API_KEY;
const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID;
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
