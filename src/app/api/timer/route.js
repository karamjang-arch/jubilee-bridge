import { NextResponse } from "next/server";
import { supabaseAdmin, TABLES } from "@/lib/supabase";

// Check if using demo mode
function isUsingDemo() {
  return !supabaseAdmin;
}

// POST: 타이머 세션 저장
export async function POST(request) {
  try {
    const body = await request.json();
    const { student, subject, startAt, endAt, durationMin } = body;

    // 필수 필드 검증
    if (!student || !subject || !startAt || !endAt || durationMin === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: student, subject, startAt, endAt, durationMin' },
        { status: 400 }
      );
    }

    // 6시간(360분) 초과 검증
    if (durationMin > 360) {
      return NextResponse.json(
        { error: 'Session exceeds 6 hours limit', maxMinutes: 360 },
        { status: 400 }
      );
    }

    if (isUsingDemo()) {
      return NextResponse.json({
        success: true,
        message: 'Demo mode - session not saved',
        session: { student, subject, startAt, endAt, durationMin },
        demo: true
      });
    }

    // Insert into Supabase
    const { data, error } = await supabaseAdmin
      .from(TABLES.STUDY_SESSIONS)
      .insert({
        student_id: student,
        subject,
        start_time: startAt,
        end_time: endAt,
        duration_minutes: durationMin,
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      session: { student, subject, startAt, endAt, durationMin }
    });

  } catch (error) {
    console.error('Timer POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save timer session', details: error.message },
      { status: 500 }
    );
  }
}

// GET: 학생별 타이머 기록 조회
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const student = searchParams.get('student');
    const date = searchParams.get('date'); // YYYY-MM-DD

    if (!student) {
      return NextResponse.json(
        { error: 'Missing required parameter: student' },
        { status: 400 }
      );
    }

    if (isUsingDemo()) {
      const today = date || new Date().toISOString().split('T')[0];
      return NextResponse.json({
        sessions: [
          { subject: 'math', durationMin: 45, startAt: `${today}T09:00:00`, endAt: `${today}T09:45:00` },
          { subject: 'english', durationMin: 30, startAt: `${today}T10:00:00`, endAt: `${today}T10:30:00` },
        ],
        todayTotal: 75,
        weekTotal: 420,
        demo: true
      });
    }

    // 오늘 날짜
    const today = date || new Date().toISOString().split('T')[0];

    // 주간 시작일 (일요일)
    const todayDate = new Date(today);
    const dayOfWeek = todayDate.getDay();
    const weekStart = new Date(todayDate);
    weekStart.setDate(todayDate.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // 전체 세션 가져오기 (주간 데이터)
    const { data: sessions, error } = await supabaseAdmin
      .from(TABLES.STUDY_SESSIONS)
      .select('*')
      .eq('student_id', student)
      .gte('created_at', `${weekStartStr}T00:00:00`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 오늘 세션
    const todaySessions = (sessions || [])
      .filter(s => s.created_at?.startsWith(today))
      .map(s => ({
        subject: s.subject,
        durationMin: Math.round(s.duration_minutes || 0),
        startAt: s.start_time,
        endAt: s.end_time
      }));

    // 오늘 총 시간
    const todayTotal = todaySessions.reduce((sum, s) => sum + s.durationMin, 0);

    // 주간 총 시간
    const weekTotal = (sessions || []).reduce((sum, s) => sum + Math.round(s.duration_minutes || 0), 0);

    // 과목별 오늘 누적
    const subjectTotals = {};
    for (const session of todaySessions) {
      subjectTotals[session.subject] = (subjectTotals[session.subject] || 0) + session.durationMin;
    }

    // 과목별 주간 누적
    const weekSubjectTotals = {};
    for (const s of sessions || []) {
      weekSubjectTotals[s.subject] = (weekSubjectTotals[s.subject] || 0) + Math.round(s.duration_minutes || 0);
    }

    return NextResponse.json({
      sessions: todaySessions,
      todayTotal,
      weekTotal,
      subjectTotals,
      weekSubjectTotals
    });

  } catch (error) {
    console.error('Timer GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timer data', details: error.message },
      { status: 500 }
    );
  }
}
