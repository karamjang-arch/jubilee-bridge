/**
 * 데이터 서비스 레이어
 * Sheets API 키가 설정되면 실제 API 호출, 아니면 데모 데이터 사용
 */

import * as sheets from './sheets';
import * as demo from './demo-data';

function useDemo() {
  return demo.isUsingDemo();
}

export async function getConcepts(studentCode) {
  let concepts;
  
  if (useDemo()) {
    concepts = demo.DEMO_CONCEPTS;
  } else {
    concepts = await sheets.fetchConcepts();
  }
  
  if (studentCode) {
    concepts = concepts.filter(c => c.student === studentCode);
  }
  
  return concepts;
}

export async function getDaily(studentCode) {
  let daily;
  
  if (useDemo()) {
    daily = demo.DEMO_DAILY;
  } else {
    daily = await sheets.fetchDaily();
  }
  
  if (studentCode) {
    daily = daily.filter(d => d.student === studentCode);
  }
  
  return daily;
}

export async function getSATScores(studentCode) {
  let scores;
  
  if (useDemo()) {
    scores = demo.DEMO_SAT_SCORES;
  } else {
    scores = await sheets.fetchSATScores();
  }
  
  if (studentCode) {
    scores = scores.filter(s => s.student === studentCode);
  }
  
  return scores;
}

export async function getUsers() {
  if (useDemo()) {
    return demo.DEMO_USERS;
  }
  return sheets.fetchUsers();
}

export async function getUserByEmail(email) {
  const users = await getUsers();
  return users.find(u => u.email === email) || null;
}

export async function getAllStudents() {
  const users = await getUsers();
  return users.filter(u => u.role === 'student');
}

/**
 * 학생별 통계 요약 계산
 */
export function computeStudentStats(concepts, daily) {
  const mastered = concepts.filter(c => c.status === 'mastered').length;
  const strong = concepts.filter(c => c.status === 'strong').length;
  const inProgress = concepts.filter(c => c.status === 'in-progress').length;
  const weak = concepts.filter(c => c.status === 'weak').length;
  const avgMastery = concepts.length > 0
    ? concepts.reduce((a, c) => a + c.mastery, 0) / concepts.length
    : 0;
  const totalMinutes = daily.reduce((a, d) => a + d.total_minutes, 0);
  const streak = daily.length > 0 ? daily[daily.length - 1].streak : 0;
  const totalXP = daily.reduce((a, d) => a + d.xp, 0);
  
  let level = 'Rookie';
  if (totalXP >= 1000) level = 'Master';
  else if (totalXP >= 600) level = 'Specialist';
  else if (totalXP >= 300) level = 'Scholar';
  else if (totalXP >= 100) level = 'Grinder';

  const subjects = [...new Set(concepts.map(c => c.subject))];
  const subjectMastery = subjects.map(s => {
    const subConcepts = concepts.filter(c => c.subject === s);
    return {
      subject: s.replace('sat-', 'SAT '),
      mastery: subConcepts.reduce((a, c) => a + c.mastery, 0) / subConcepts.length,
    };
  });

  const statusDistribution = [
    { name: 'mastered', value: mastered },
    { name: 'strong', value: strong },
    { name: 'in-progress', value: inProgress },
    { name: 'weak', value: weak },
  ].filter(d => d.value > 0);

  const needReview = concepts
    .filter(c => c.status === 'weak' || c.status === 'in-progress')
    .sort((a, b) => a.mastery - b.mastery);

  const minutesTimeline = daily.map(d => ({
    date: d.date.slice(5),
    minutes: d.total_minutes,
  }));

  const masteryTimeline = daily.map(d => ({
    date: d.date.slice(5),
    change: d.mastery_change,
  }));

  return {
    total: concepts.length,
    mastered,
    strong,
    inProgress,
    weak,
    avgMastery,
    totalMinutes,
    totalHours: (totalMinutes / 60).toFixed(1),
    streak,
    totalXP,
    level,
    statusDistribution,
    subjectMastery,
    needReview,
    minutesTimeline,
    masteryTimeline,
  };
}
