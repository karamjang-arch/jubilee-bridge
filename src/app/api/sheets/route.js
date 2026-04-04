import { NextResponse } from "next/server";
import {
  fetchConcepts,
  fetchDaily,
  fetchSATScores,
  fetchAssignments,
  fetchStudyTimer,
  fetchMemorization,
  fetchDevotion,
  fetchMyVocabulary,
  fetchStudentProfiles,
} from "@/lib/sheets";
import { isUsingDemo, DEMO_CONCEPTS, DEMO_DAILY, DEMO_SAT_SCORES } from "@/lib/demo-data";

// Phase 1 MVP 데모 데이터
const DEMO_ASSIGNMENTS = [
  { id: '1', student: 'demo', date: '2026-04-03', subject: 'math', cb_id: 'MATH-ALG-001', title: 'SAT Math Practice', due_date: new Date('2026-04-05'), status: 'pending' },
  { id: '2', student: 'demo', date: '2026-04-03', subject: 'english', cb_id: 'ENG-VOCAB-001', title: 'Vocabulary Quiz', due_date: new Date('2026-04-06'), status: 'pending' },
];

const DEMO_STUDY_TIMER = [
  { id: '1', student: 'demo', date: '2026-04-03', subject: 'math', duration_seconds: 1800 },
  { id: '2', student: 'demo', date: '2026-04-03', subject: 'english', duration_seconds: 1200 },
  { id: '3', student: 'demo', date: '2026-04-02', subject: 'physics', duration_seconds: 2400 },
];

const DEMO_MEMORIZATION = [
  { id: '1', student: 'demo', verse_ref: '로마서 8:28', status: 'completed' },
];

const DEMO_DEVOTION = [
  { id: '1', student: 'demo', date: '2026-04-03', passage: '요19:28-30', memo: '다 이루었다는 말씀이 마음에 남습니다.' },
];

const DEMO_VOCABULARY = [
  { id: '1', student: 'demo', word: 'aberration', met_in_cb: 'ENG-VOCAB-001', review_count: 2, status: 'learning' },
];

// concept_progress 탭 - 학습 진행 상태
const DEMO_CONCEPT_PROGRESS = [
  // JH (지후)
  { student: 'JH', concept_id: 'MATH-NUM-001', status: 'mastered', mastered_at: '2026-03-15' },
  { student: 'JH', concept_id: 'MATH-NUM-002', status: 'mastered', mastered_at: '2026-03-18' },
  { student: 'JH', concept_id: 'MATH-ALG-001', status: 'available', mastered_at: null },
  // EH (은후)
  { student: 'EH', concept_id: 'ENG-VOC-001', status: 'mastered', mastered_at: '2026-03-20' },
  { student: 'EH', concept_id: 'ENG-VOC-002', status: 'available', mastered_at: null },
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "concepts";
  const student = searchParams.get("student");

  try {
    let data;

    if (isUsingDemo()) {
      // 데모 데이터 반환
      switch (tab) {
        case "concepts": data = DEMO_CONCEPTS; break;
        case "daily": data = DEMO_DAILY; break;
        case "sat_scores": data = DEMO_SAT_SCORES; break;
        case "assignments": data = DEMO_ASSIGNMENTS; break;
        case "study_timer": data = DEMO_STUDY_TIMER; break;
        case "memorization": data = DEMO_MEMORIZATION; break;
        case "devotion": data = DEMO_DEVOTION; break;
        case "my_vocabulary": data = DEMO_VOCABULARY; break;
        case "concept_progress": data = DEMO_CONCEPT_PROGRESS; break;
        case "student_profile": data = [
          { id: 'JH', name: '지후', role: 'student', grade: 10 },
          { id: 'EH', name: '은후', role: 'student', grade: 7 },
          { id: 'KJ', name: '관리자', role: 'admin', grade: null },
        ]; break;
        default: data = [];
      }
    } else {
      // Sheets API 호출
      switch (tab) {
        case "concepts": data = await fetchConcepts(); break;
        case "daily": data = await fetchDaily(); break;
        case "sat_scores": data = await fetchSATScores(); break;
        case "assignments": data = await fetchAssignments(); break;
        case "study_timer": data = await fetchStudyTimer(); break;
        case "memorization": data = await fetchMemorization(); break;
        case "devotion": data = await fetchDevotion(); break;
        case "my_vocabulary": data = await fetchMyVocabulary(); break;
        case "student_profile": data = await fetchStudentProfiles(); break;
        default: data = [];
      }
    }

    // 학생 필터
    if (student) {
      data = data.filter(d => d.student === student);
    }

    return NextResponse.json({ data, demo: isUsingDemo() });
  } catch (error) {
    console.error("Sheets API route error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

// POST: 데이터 저장 (concept_progress 등)
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab");

  try {
    const body = await request.json();

    if (tab === 'concept_progress') {
      // 데모 모드에서는 메모리에 저장 (실제로는 Google Sheets에 저장)
      const { student, concept_id, status, mastered_at } = body;

      // 기존 항목 찾기
      const existingIndex = DEMO_CONCEPT_PROGRESS.findIndex(
        p => p.student === student && p.concept_id === concept_id
      );

      if (existingIndex >= 0) {
        DEMO_CONCEPT_PROGRESS[existingIndex] = { student, concept_id, status, mastered_at };
      } else {
        DEMO_CONCEPT_PROGRESS.push({ student, concept_id, status, mastered_at });
      }

      return NextResponse.json({ success: true, data: body });
    }

    if (tab === 'reset_progress') {
      // 관리자 전용: 전체 리셋
      const { student } = body;
      if (student === 'all') {
        DEMO_CONCEPT_PROGRESS.length = 0;
      } else {
        const filtered = DEMO_CONCEPT_PROGRESS.filter(p => p.student !== student);
        DEMO_CONCEPT_PROGRESS.length = 0;
        DEMO_CONCEPT_PROGRESS.push(...filtered);
      }
      return NextResponse.json({ success: true, message: 'Progress reset' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheets POST error:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}
