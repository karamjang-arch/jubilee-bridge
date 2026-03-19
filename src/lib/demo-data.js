/**
 * 데모 데이터 — Sheets API 연결 전 개발용
 * Sheets 연동 후에도 fallback으로 유지
 */

export const DEMO_USERS = [
  { email: "pastor@purdue.edu", role: "teacher", student_code: "-", name: "Pastor Jang" },
  { email: "jihu@gmail.com", role: "student", student_code: "jihu", name: "지후" },
  { email: "minji@gmail.com", role: "student", student_code: "minji", name: "민지" },
  { email: "eunseo@gmail.com", role: "student", student_code: "eunseo", name: "은서" },
];

export const DEMO_CONCEPTS = [
  { date: "2026-06-16", student: "jihu", subject: "sat-math", topic: "Quadratic Equations", unit: "completing-the-square", status: "in-progress", mastery: 0.65, study_minutes: 25, quiz_result: "3/5" },
  { date: "2026-06-17", student: "jihu", subject: "sat-math", topic: "Linear Systems", unit: "substitution-method", status: "mastered", mastery: 0.95, study_minutes: 20, quiz_result: "5/5" },
  { date: "2026-06-17", student: "jihu", subject: "sat-reading", topic: "Vocabulary in Context", unit: "secondary-meanings", status: "strong", mastery: 0.78, study_minutes: 30, quiz_result: "4/5" },
  { date: "2026-06-18", student: "jihu", subject: "sat-writing", topic: "Grammar Rules", unit: "subject-verb-agreement", status: "mastered", mastery: 0.92, study_minutes: 15, quiz_result: "5/5" },
  { date: "2026-06-18", student: "jihu", subject: "sat-math", topic: "Geometry", unit: "circle-equations", status: "weak", mastery: 0.35, study_minutes: 30, quiz_result: "1/5" },
  { date: "2026-06-19", student: "jihu", subject: "bible", topic: "James", unit: "james-1-5-wisdom", status: "strong", mastery: 0.80, study_minutes: 20, quiz_result: "4/5" },
  { date: "2026-06-19", student: "jihu", subject: "sat-math", topic: "Data Analysis", unit: "scatterplot-interpretation", status: "in-progress", mastery: 0.55, study_minutes: 25, quiz_result: "3/5" },
  { date: "2026-06-20", student: "jihu", subject: "english", topic: "Essay Writing", unit: "thesis-statements", status: "strong", mastery: 0.82, study_minutes: 35, quiz_result: "4/5" },
  { date: "2026-06-20", student: "jihu", subject: "sat-reading", topic: "Paired Passages", unit: "compare-contrast", status: "mastered", mastery: 0.88, study_minutes: 28, quiz_result: "5/5" },
  { date: "2026-06-21", student: "jihu", subject: "sat-math", topic: "Probability", unit: "conditional-probability", status: "in-progress", mastery: 0.50, study_minutes: 22, quiz_result: "2/5" },
  // 민지 데이터
  { date: "2026-06-16", student: "minji", subject: "sat-math", topic: "Algebra", unit: "linear-equations", status: "mastered", mastery: 0.90, study_minutes: 20, quiz_result: "5/5" },
  { date: "2026-06-17", student: "minji", subject: "sat-reading", topic: "Main Idea", unit: "central-claim", status: "in-progress", mastery: 0.60, study_minutes: 25, quiz_result: "3/5" },
  { date: "2026-06-18", student: "minji", subject: "sat-writing", topic: "Punctuation", unit: "comma-rules", status: "strong", mastery: 0.75, study_minutes: 18, quiz_result: "4/5" },
  { date: "2026-06-19", student: "minji", subject: "bible", topic: "Proverbs", unit: "proverbs-3-5-trust", status: "mastered", mastery: 0.92, study_minutes: 15, quiz_result: "5/5" },
  { date: "2026-06-20", student: "minji", subject: "sat-math", topic: "Functions", unit: "function-notation", status: "weak", mastery: 0.40, study_minutes: 30, quiz_result: "2/5" },
  // 은서 데이터
  { date: "2026-06-16", student: "eunseo", subject: "sat-math", topic: "Ratios", unit: "proportion-problems", status: "mastered", mastery: 0.85, study_minutes: 22, quiz_result: "4/5" },
  { date: "2026-06-17", student: "eunseo", subject: "sat-reading", topic: "Evidence Support", unit: "text-evidence", status: "in-progress", mastery: 0.55, study_minutes: 28, quiz_result: "3/5" },
  { date: "2026-06-18", student: "eunseo", subject: "english", topic: "Vocabulary", unit: "word-smart-ch1", status: "strong", mastery: 0.72, study_minutes: 20, quiz_result: "4/5" },
];

export const DEMO_DAILY = [
  { date: "2026-06-16", student: "jihu", total_minutes: 45, new_concepts: 2, reviewed: 0, mastery_change: 0.12, xp: 25, streak: 1 },
  { date: "2026-06-17", student: "jihu", total_minutes: 50, new_concepts: 2, reviewed: 1, mastery_change: 0.15, xp: 35, streak: 2 },
  { date: "2026-06-18", student: "jihu", total_minutes: 45, new_concepts: 2, reviewed: 0, mastery_change: -0.05, xp: 25, streak: 3 },
  { date: "2026-06-19", student: "jihu", total_minutes: 45, new_concepts: 2, reviewed: 1, mastery_change: 0.10, xp: 30, streak: 4 },
  { date: "2026-06-20", student: "jihu", total_minutes: 63, new_concepts: 2, reviewed: 2, mastery_change: 0.08, xp: 35, streak: 5 },
  { date: "2026-06-21", student: "jihu", total_minutes: 22, new_concepts: 1, reviewed: 1, mastery_change: 0.03, xp: 15, streak: 6 },
  // 민지
  { date: "2026-06-16", student: "minji", total_minutes: 20, new_concepts: 1, reviewed: 0, mastery_change: 0.10, xp: 15, streak: 1 },
  { date: "2026-06-17", student: "minji", total_minutes: 25, new_concepts: 1, reviewed: 0, mastery_change: 0.08, xp: 18, streak: 2 },
  { date: "2026-06-18", student: "minji", total_minutes: 18, new_concepts: 1, reviewed: 0, mastery_change: 0.05, xp: 12, streak: 3 },
  { date: "2026-06-19", student: "minji", total_minutes: 15, new_concepts: 1, reviewed: 1, mastery_change: 0.12, xp: 20, streak: 4 },
  { date: "2026-06-20", student: "minji", total_minutes: 30, new_concepts: 1, reviewed: 0, mastery_change: -0.02, xp: 15, streak: 5 },
  // 은서
  { date: "2026-06-16", student: "eunseo", total_minutes: 22, new_concepts: 1, reviewed: 0, mastery_change: 0.08, xp: 15, streak: 1 },
  { date: "2026-06-17", student: "eunseo", total_minutes: 28, new_concepts: 1, reviewed: 1, mastery_change: 0.10, xp: 22, streak: 2 },
  { date: "2026-06-18", student: "eunseo", total_minutes: 20, new_concepts: 1, reviewed: 0, mastery_change: 0.06, xp: 14, streak: 3 },
];

export const DEMO_SAT_SCORES = [
  { date: "2026-06-18", student: "jihu", rw_score: 520, math_score: 580, total_score: 1100, test_name: "Practice Test 1" },
  { date: "2026-06-25", student: "jihu", rw_score: 540, math_score: 600, total_score: 1140, test_name: "Practice Test 2" },
  { date: "2026-06-18", student: "minji", rw_score: 480, math_score: 550, total_score: 1030, test_name: "Practice Test 1" },
];

/**
 * 데이터 소스 결정: Sheets API 키가 있으면 API, 없으면 데모
 */
export function isUsingDemo() {
  return !process.env.NEXT_PUBLIC_SHEETS_API_KEY || 
         process.env.NEXT_PUBLIC_SHEETS_API_KEY === 'YOUR_API_KEY_HERE';
}
