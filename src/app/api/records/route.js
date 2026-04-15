import { NextResponse } from 'next/server';
import { supabaseAdmin, TABLES } from '@/lib/supabase';

/**
 * Records API - 학습 기록 통합 조회
 *
 * GET ?student_id=xxx&view=calendar&month=2026-04
 * GET ?student_id=xxx&view=concepts&subject=math
 * GET ?student_id=xxx&view=stats&period=week
 */

// Demo data for development
const DEMO_CONCEPT_HISTORY = [
  { id: 1, student_id: 'JH', concept_id: 'MATH-ALG-001', event_type: 'quiz_correct', xp_earned: 10, created_at: '2026-04-15T10:30:00Z', metadata: { concept_name: '이차방정식' } },
  { id: 2, student_id: 'JH', concept_id: 'MATH-ALG-002', event_type: 'quiz_incorrect', xp_earned: 0, created_at: '2026-04-15T10:35:00Z', metadata: { concept_name: '인수분해', misconception: '부호 혼동' } },
  { id: 3, student_id: 'JH', concept_id: 'MATH-ALG-002', event_type: 'tutor_session', xp_earned: 5, created_at: '2026-04-15T10:40:00Z', metadata: { concept_name: '인수분해', turns: 5 } },
  { id: 4, student_id: 'JH', concept_id: 'SAT-MATH', event_type: 'test_completed', xp_earned: 50, created_at: '2026-04-15T11:00:00Z', metadata: { score_percent: 72 } },
  { id: 5, student_id: 'JH', concept_id: 'MATH-CALC-001', event_type: 'homework_scan', xp_earned: 20, created_at: '2026-04-15T14:00:00Z', metadata: { correct: 8, total: 10 } },
  { id: 6, student_id: 'JH', concept_id: 'ENG-VOC-001', event_type: 'word_quiz', xp_earned: 15, created_at: '2026-04-15T16:00:00Z', metadata: { accuracy: 90 } },
  { id: 7, student_id: 'JH', concept_id: 'MATH-ALG-001', event_type: 'quiz_correct', xp_earned: 10, created_at: '2026-04-14T09:00:00Z', metadata: { concept_name: '이차방정식' } },
  { id: 8, student_id: 'JH', concept_id: 'MATH-GEO-001', event_type: 'quiz_correct', xp_earned: 10, created_at: '2026-04-13T10:00:00Z', metadata: { concept_name: '삼각형' } },
  { id: 9, student_id: 'EH', concept_id: 'ENG-VOC-001', event_type: 'quiz_correct', xp_earned: 10, created_at: '2026-04-15T09:00:00Z', metadata: { concept_name: 'Vocabulary' } },
];

const DEMO_STUDY_SESSIONS = [
  { id: 1, student_id: 'JH', subject: 'math', duration_minutes: 45, created_at: '2026-04-15T15:30:00Z' },
  { id: 2, student_id: 'JH', subject: 'english', duration_minutes: 30, created_at: '2026-04-14T14:00:00Z' },
  { id: 3, student_id: 'JH', subject: 'science', duration_minutes: 60, created_at: '2026-04-13T16:00:00Z' },
  { id: 4, student_id: 'EH', subject: 'english', duration_minutes: 25, created_at: '2026-04-15T10:00:00Z' },
];

const DEMO_CONCEPT_PROGRESS = [
  { student_id: 'JH', concept_id: 'MATH-ALG-001', status: 'mastered', score: 95, attempts: 3, updated_at: '2026-04-15' },
  { student_id: 'JH', concept_id: 'MATH-ALG-002', status: 'learning', score: 60, attempts: 5, updated_at: '2026-04-15' },
  { student_id: 'JH', concept_id: 'MATH-GEO-001', status: 'mastered', score: 88, attempts: 2, updated_at: '2026-04-13' },
  { student_id: 'JH', concept_id: 'ENG-VOC-001', status: 'learning', score: 70, attempts: 4, updated_at: '2026-04-14' },
  { student_id: 'EH', concept_id: 'ENG-VOC-001', status: 'mastered', score: 92, attempts: 2, updated_at: '2026-04-15' },
];

const DEMO_STUDENT_PROGRESS = [
  { student_id: 'JH', total_xp: 1250, level: 5, current_streak: 7, longest_streak: 14 },
  { student_id: 'EH', total_xp: 890, level: 4, current_streak: 3, longest_streak: 10 },
];

function isUsingDemo() {
  return !supabaseAdmin;
}

// Get calendar view data
async function getCalendarData(studentId, month) {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);

  if (isUsingDemo()) {
    const events = DEMO_CONCEPT_HISTORY.filter(e => {
      if (studentId && e.student_id !== studentId) return false;
      const eventDate = new Date(e.created_at);
      return eventDate >= startDate && eventDate <= endDate;
    });

    const sessions = DEMO_STUDY_SESSIONS.filter(s => {
      if (studentId && s.student_id !== studentId) return false;
      const sessionDate = new Date(s.created_at);
      return sessionDate >= startDate && sessionDate <= endDate;
    });

    const progress = DEMO_STUDENT_PROGRESS.find(p => p.student_id === studentId) || { current_streak: 0 };

    return { events, sessions, streak: progress.current_streak };
  }

  // Supabase queries
  let eventsQuery = supabaseAdmin
    .from(TABLES.CONCEPT_HISTORY)
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  let sessionsQuery = supabaseAdmin
    .from(TABLES.STUDY_SESSIONS)
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  let progressQuery = supabaseAdmin
    .from(TABLES.STUDENT_PROGRESS)
    .select('current_streak')
    .eq('student_id', studentId)
    .single();

  if (studentId) {
    eventsQuery = eventsQuery.eq('student_id', studentId);
    sessionsQuery = sessionsQuery.eq('student_id', studentId);
  }

  const [eventsRes, sessionsRes, progressRes] = await Promise.all([
    eventsQuery,
    sessionsQuery,
    progressQuery,
  ]);

  return {
    events: eventsRes.data || [],
    sessions: sessionsRes.data || [],
    streak: progressRes.data?.current_streak || 0,
  };
}

// Get concepts view data
async function getConceptsData(studentId, subject) {
  if (isUsingDemo()) {
    let progress = DEMO_CONCEPT_PROGRESS;
    if (studentId) {
      progress = progress.filter(p => p.student_id === studentId);
    }
    if (subject) {
      const subjectPrefix = subject.toUpperCase();
      progress = progress.filter(p => p.concept_id.startsWith(subjectPrefix));
    }

    // Get history for misconceptions
    const history = DEMO_CONCEPT_HISTORY.filter(h => {
      if (studentId && h.student_id !== studentId) return false;
      return h.metadata?.misconception;
    });

    // Merge misconceptions into progress
    const conceptsWithMisconceptions = progress.map(p => {
      const misconceptions = history
        .filter(h => h.concept_id === p.concept_id && h.metadata?.misconception)
        .map(h => h.metadata.misconception);
      return {
        ...p,
        misconceptions: [...new Set(misconceptions)],
      };
    });

    return { concepts: conceptsWithMisconceptions };
  }

  // Supabase query
  let query = supabaseAdmin
    .from(TABLES.CONCEPT_PROGRESS)
    .select('*')
    .order('updated_at', { ascending: false });

  if (studentId) {
    query = query.eq('student_id', studentId);
  }
  if (subject) {
    const subjectPrefix = subject.toUpperCase();
    query = query.ilike('concept_id', `${subjectPrefix}%`);
  }

  const { data: progress, error } = await query;
  if (error) throw error;

  // Get misconceptions from history
  let historyQuery = supabaseAdmin
    .from(TABLES.CONCEPT_HISTORY)
    .select('concept_id, metadata')
    .not('metadata->misconception', 'is', null);

  if (studentId) {
    historyQuery = historyQuery.eq('student_id', studentId);
  }

  const { data: history } = await historyQuery;

  // Merge misconceptions
  const misconceptionMap = {};
  (history || []).forEach(h => {
    if (h.metadata?.misconception) {
      if (!misconceptionMap[h.concept_id]) {
        misconceptionMap[h.concept_id] = new Set();
      }
      misconceptionMap[h.concept_id].add(h.metadata.misconception);
    }
  });

  const conceptsWithMisconceptions = (progress || []).map(p => ({
    ...p,
    misconceptions: Array.from(misconceptionMap[p.concept_id] || []),
  }));

  return { concepts: conceptsWithMisconceptions };
}

// Get stats view data
async function getStatsData(studentId, period) {
  const now = new Date();
  const daysBack = period === 'month' ? 30 : 7;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysBack);

  if (isUsingDemo()) {
    const events = DEMO_CONCEPT_HISTORY.filter(e => {
      if (studentId && e.student_id !== studentId) return false;
      return new Date(e.created_at) >= startDate;
    });

    const sessions = DEMO_STUDY_SESSIONS.filter(s => {
      if (studentId && s.student_id !== studentId) return false;
      return new Date(s.created_at) >= startDate;
    });

    const progress = studentId
      ? DEMO_CONCEPT_PROGRESS.filter(p => p.student_id === studentId)
      : DEMO_CONCEPT_PROGRESS;

    const studentProgress = DEMO_STUDENT_PROGRESS.find(p => p.student_id === studentId) || {
      total_xp: 0,
      level: 1,
      current_streak: 0,
    };

    // Calculate daily activity
    const dailyActivity = {};
    events.forEach(e => {
      const date = e.created_at.split('T')[0];
      if (!dailyActivity[date]) {
        dailyActivity[date] = { date, events: 0, xp: 0, minutes: 0 };
      }
      dailyActivity[date].events++;
      dailyActivity[date].xp += e.xp_earned || 0;
    });

    sessions.forEach(s => {
      const date = s.created_at.split('T')[0];
      if (!dailyActivity[date]) {
        dailyActivity[date] = { date, events: 0, xp: 0, minutes: 0 };
      }
      dailyActivity[date].minutes += s.duration_minutes || 0;
    });

    // Calculate subject distribution
    const subjectCounts = {};
    events.forEach(e => {
      const subject = e.concept_id.split('-')[0];
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });

    // Calculate accuracy trend
    const correctEvents = events.filter(e => e.event_type === 'quiz_correct').length;
    const incorrectEvents = events.filter(e => e.event_type === 'quiz_incorrect').length;
    const totalQuizzes = correctEvents + incorrectEvents;
    const accuracy = totalQuizzes > 0 ? Math.round((correctEvents / totalQuizzes) * 100) : 0;

    return {
      dailyActivity: Object.values(dailyActivity).sort((a, b) => a.date.localeCompare(b.date)),
      subjectDistribution: Object.entries(subjectCounts).map(([subject, count]) => ({ subject, count })),
      accuracy,
      totalConcepts: progress.length,
      masteredConcepts: progress.filter(p => p.status === 'mastered').length,
      totalStudyMinutes: sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
      streak: studentProgress.current_streak,
    };
  }

  // Supabase queries
  let eventsQuery = supabaseAdmin
    .from(TABLES.CONCEPT_HISTORY)
    .select('*')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  let sessionsQuery = supabaseAdmin
    .from(TABLES.STUDY_SESSIONS)
    .select('*')
    .gte('created_at', startDate.toISOString());

  let progressQuery = supabaseAdmin
    .from(TABLES.CONCEPT_PROGRESS)
    .select('status');

  let studentProgressQuery = supabaseAdmin
    .from(TABLES.STUDENT_PROGRESS)
    .select('current_streak')
    .eq('student_id', studentId)
    .single();

  if (studentId) {
    eventsQuery = eventsQuery.eq('student_id', studentId);
    sessionsQuery = sessionsQuery.eq('student_id', studentId);
    progressQuery = progressQuery.eq('student_id', studentId);
  }

  const [eventsRes, sessionsRes, progressRes, studentProgressRes] = await Promise.all([
    eventsQuery,
    sessionsQuery,
    progressQuery,
    studentProgressQuery,
  ]);

  const events = eventsRes.data || [];
  const sessions = sessionsRes.data || [];
  const progress = progressRes.data || [];

  // Calculate daily activity
  const dailyActivity = {};
  events.forEach(e => {
    const date = e.created_at.split('T')[0];
    if (!dailyActivity[date]) {
      dailyActivity[date] = { date, events: 0, xp: 0, minutes: 0 };
    }
    dailyActivity[date].events++;
    dailyActivity[date].xp += e.xp_earned || 0;
  });

  sessions.forEach(s => {
    const date = s.created_at.split('T')[0];
    if (!dailyActivity[date]) {
      dailyActivity[date] = { date, events: 0, xp: 0, minutes: 0 };
    }
    dailyActivity[date].minutes += s.duration_minutes || 0;
  });

  // Calculate subject distribution
  const subjectCounts = {};
  events.forEach(e => {
    const subject = e.concept_id?.split('-')[0] || 'OTHER';
    subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
  });

  // Calculate accuracy
  const correctEvents = events.filter(e => e.event_type === 'quiz_correct').length;
  const incorrectEvents = events.filter(e => e.event_type === 'quiz_incorrect').length;
  const totalQuizzes = correctEvents + incorrectEvents;
  const accuracy = totalQuizzes > 0 ? Math.round((correctEvents / totalQuizzes) * 100) : 0;

  return {
    dailyActivity: Object.values(dailyActivity).sort((a, b) => a.date.localeCompare(b.date)),
    subjectDistribution: Object.entries(subjectCounts).map(([subject, count]) => ({ subject, count })),
    accuracy,
    totalConcepts: progress.length,
    masteredConcepts: progress.filter(p => p.status === 'mastered').length,
    totalStudyMinutes: sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
    streak: studentProgressRes.data?.current_streak || 0,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('student_id');
  const view = searchParams.get('view') || 'calendar';
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const subject = searchParams.get('subject');
  const period = searchParams.get('period') || 'week';

  try {
    let data;

    switch (view) {
      case 'calendar':
        data = await getCalendarData(studentId, month);
        break;
      case 'concepts':
        data = await getConceptsData(studentId, subject);
        break;
      case 'stats':
        data = await getStatsData(studentId, period);
        break;
      default:
        return NextResponse.json({ error: 'Invalid view type' }, { status: 400 });
    }

    return NextResponse.json({ data, demo: isUsingDemo() });
  } catch (error) {
    console.error('Records API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch records', details: error.message },
      { status: 500 }
    );
  }
}
