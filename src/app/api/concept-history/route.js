import { NextResponse } from "next/server";
import { supabaseAdmin, TABLES } from "@/lib/supabase";

// 유효한 event_type 목록
const VALID_EVENT_TYPES = [
  'content_view',      // 개념 콘텐츠 열람
  'test_attempt',      // 테스트 응시
  'test_complete',     // 테스트 완료 (점수 포함)
  'essay_submit',      // 에세이 제출 (채점 결과 포함)
  'mastery_update',    // 숙달도 변경
  'review_scheduled',  // 복습 예약
  'tutor_session',     // AI 튜터 대화 세션
  'homework_scan'      // 숙제/시험 사진 분석
];

// Check if using demo mode
function isUsingDemo() {
  return !supabaseAdmin;
}

// POST: 학습 이벤트 기록
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      student_id,
      event_type,
      curriculum,
      subject,
      concept_id,
      score,
      duration_sec,
      detail
    } = body;

    // 필수 필드 검증
    if (!student_id || !event_type) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, event_type' },
        { status: 400 }
      );
    }

    // event_type 유효성 검증
    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json(
        { error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    if (isUsingDemo()) {
      return NextResponse.json({
        success: true,
        message: 'Demo mode - event not saved',
        event: { student_id, event_type, timestamp, curriculum, subject, concept_id, score, duration_sec }
      });
    }

    // Insert into Supabase
    const { data, error } = await supabaseAdmin
      .from(TABLES.CONCEPT_HISTORY)
      .insert({
        student_id,
        event_type,
        concept_id: concept_id || null,
        score: score !== undefined && score !== null ? score : null,
        detail: detail || {},
        curriculum: curriculum || 'us',
        created_at: timestamp,
      })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      event: { student_id, event_type, timestamp, curriculum, subject, concept_id, score, duration_sec }
    });

  } catch (error) {
    console.error('Concept history POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save concept history event', details: error.message },
      { status: 500 }
    );
  }
}

// GET: 학생별 학습 이력 조회
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');
    const event_type = searchParams.get('event_type');
    const subject = searchParams.get('subject');
    const concept_id = searchParams.get('concept_id');
    const limit = parseInt(searchParams.get('limit')) || 100;

    if (!student_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: student_id' },
        { status: 400 }
      );
    }

    if (isUsingDemo()) {
      // 데모 데이터
      return NextResponse.json({
        events: [
          {
            student_id,
            event_type: 'test_complete',
            timestamp: new Date().toISOString(),
            curriculum: 'us',
            subject: 'math',
            concept_id: 'MATH-ALG-001',
            score: 85,
            duration_sec: 300,
            detail: { correct: 17, total: 20 }
          },
          {
            student_id,
            event_type: 'content_view',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            curriculum: 'us',
            subject: 'math',
            concept_id: 'MATH-ALG-001',
            score: null,
            duration_sec: 180,
            detail: {}
          }
        ],
        total: 2,
        demo: true
      });
    }

    // Build query
    let query = supabaseAdmin
      .from(TABLES.CONCEPT_HISTORY)
      .select('*')
      .eq('student_id', student_id);

    if (event_type) {
      query = query.eq('event_type', event_type);
    }

    if (concept_id) {
      query = query.eq('concept_id', concept_id);
    }

    // Execute query with ordering and limit
    const { data: rows, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Transform to expected format
    const events = rows.map(row => ({
      student_id: row.student_id,
      event_type: row.event_type,
      timestamp: row.created_at,
      curriculum: row.curriculum,
      subject: row.detail?.subject || null,
      concept_id: row.concept_id,
      score: row.score,
      duration_sec: row.detail?.duration_sec || null,
      detail: row.detail || {}
    }));

    // Calculate stats
    const stats = calculateStats(events);

    return NextResponse.json({
      events,
      total: events.length,
      stats
    });

  } catch (error) {
    console.error('Concept history GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch concept history', details: error.message },
      { status: 500 }
    );
  }
}

// 통계 계산 헬퍼
function calculateStats(events) {
  // 이벤트 타입별 카운트
  const eventCounts = {};
  for (const event of events) {
    eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1;
  }

  // 과목별 카운트
  const subjectCounts = {};
  for (const event of events) {
    const subj = event.subject || event.detail?.subject;
    if (subj) {
      subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
    }
  }

  // 테스트 평균 점수
  const testScores = events
    .filter(e => e.event_type === 'test_complete' && e.score !== null)
    .map(e => e.score);
  const avgTestScore = testScores.length > 0
    ? Math.round(testScores.reduce((a, b) => a + b, 0) / testScores.length)
    : null;

  // 총 학습 시간 (초)
  const totalDurationSec = events
    .filter(e => e.duration_sec)
    .reduce((sum, e) => sum + (e.duration_sec || 0), 0);

  return {
    eventCounts,
    subjectCounts,
    avgTestScore,
    totalDurationSec,
    totalDurationMin: Math.round(totalDurationSec / 60)
  };
}
