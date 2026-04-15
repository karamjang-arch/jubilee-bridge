import { NextResponse } from "next/server";
import { supabaseAdmin, TABLES } from "@/lib/supabase";

// Check if using demo mode
function isUsingDemo() {
  return !supabaseAdmin;
}

// 스트릭 계산 헬퍼
function calculateStreak(dates) {
  if (!dates || dates.length === 0) return 0;
  const sortedDays = [...new Set(dates)].sort().reverse();
  let streak = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - i);
    const expected = expectedDate.toISOString().split('T')[0];
    if (sortedDays[i] === expected) {
      streak++;
    } else if (i === 0) {
      // Allow for today not having activity yet
      continue;
    } else {
      break;
    }
  }
  return streak;
}

// GET: 학생 목록 + 통계
export async function GET(request) {
  try {
    if (isUsingDemo()) {
      return NextResponse.json({
        students: [
          { id: 'JH', name: '지후', grade: 10, masteredCount: 127, streak: 7 },
          { id: 'EH', name: '은후', grade: 7, masteredCount: 43, streak: 3 },
        ],
        demo: true
      });
    }

    // 1. 학생 프로필 조회
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from(TABLES.PROFILES)
      .select('*')
      .eq('role', 'student');

    if (profileError) throw profileError;

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ students: [] });
    }

    // 2. concept_progress에서 mastered 개수 조회
    const { data: progressData, error: progressError } = await supabaseAdmin
      .from(TABLES.CONCEPT_PROGRESS)
      .select('student_id, status')
      .in('status', ['mastered', 'placement_mastered']);

    if (progressError) throw progressError;

    // 학생별 마스터 개수 계산
    const masterCounts = {};
    (progressData || []).forEach(row => {
      masterCounts[row.student_id] = (masterCounts[row.student_id] || 0) + 1;
    });

    // 3. study_sessions에서 스트릭 계산
    const { data: sessionsData, error: sessionsError } = await supabaseAdmin
      .from(TABLES.STUDY_SESSIONS)
      .select('student_id, created_at');

    if (sessionsError) throw sessionsError;

    // 학생별 학습일 수집
    const studyDays = {};
    (sessionsData || []).forEach(row => {
      const studentId = row.student_id;
      const date = row.created_at?.split('T')[0];
      if (!studyDays[studentId]) studyDays[studentId] = [];
      if (date) studyDays[studentId].push(date);
    });

    // 4. 학생 정보 합치기
    const studentsWithStats = profiles.map(student => ({
      id: student.id,
      name: student.name,
      grade: student.grade,
      masteredCount: masterCounts[student.id] || 0,
      streak: calculateStreak(studyDays[student.id]),
    }));

    return NextResponse.json({ students: studentsWithStats });
  } catch (error) {
    console.error('Admin students GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch students', details: error.message }, { status: 500 });
  }
}

// POST: 학생 데이터 관리 액션
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, studentId } = body;

    if (!action || !studentId) {
      return NextResponse.json({ error: 'Missing action or studentId' }, { status: 400 });
    }

    if (isUsingDemo()) {
      return NextResponse.json({ success: true, message: `${action} completed (demo)`, demo: true });
    }

    if (action === 'reset') {
      // 전체 리셋: 여러 테이블에서 해당 학생 데이터 삭제
      const tablesToReset = [
        TABLES.CONCEPT_PROGRESS,
        TABLES.CONCEPT_HISTORY,
        TABLES.STUDY_SESSIONS,
        TABLES.STUDENT_BADGES,
        TABLES.STUDENT_PROGRESS,
      ];

      for (const table of tablesToReset) {
        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .eq('student_id', studentId);

        if (error) {
          console.error(`Error deleting from ${table}:`, error);
        }
      }

      return NextResponse.json({ success: true, message: '전체 데이터가 초기화되었습니다.' });
    }

    if (action === 'rediagnose') {
      // 재진단: placement_mastered만 삭제
      const { error } = await supabaseAdmin
        .from(TABLES.CONCEPT_PROGRESS)
        .delete()
        .eq('student_id', studentId)
        .eq('status', 'placement_mastered');

      if (error) throw error;

      return NextResponse.json({ success: true, message: '진단평가가 초기화되었습니다.' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Admin students POST error:', error);
    return NextResponse.json({ error: 'Failed to perform action', details: error.message }, { status: 500 });
  }
}
