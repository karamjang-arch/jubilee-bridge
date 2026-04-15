import { NextResponse } from "next/server";
import { supabaseAdmin, TABLES } from "@/lib/supabase";

// Demo data fallback (when Supabase is not available)
const DEMO_CONCEPTS = [];
const DEMO_DAILY = [];
const DEMO_SAT_SCORES = [];

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

const DEMO_CONCEPT_PROGRESS = [
  { student: 'JH', concept_id: 'MATH-NUM-001', status: 'mastered', mastered_at: '2026-03-15' },
  { student: 'JH', concept_id: 'MATH-NUM-002', status: 'mastered', mastered_at: '2026-03-18' },
  { student: 'JH', concept_id: 'MATH-ALG-001', status: 'available', mastered_at: null },
  { student: 'EH', concept_id: 'ENG-VOC-001', status: 'mastered', mastered_at: '2026-03-20' },
  { student: 'EH', concept_id: 'ENG-VOC-002', status: 'available', mastered_at: null },
];

const DEMO_PROFILES = [
  { id: 'JH', name: '지후', role: 'student', grade: 10 },
  { id: 'EH', name: '은후', role: 'student', grade: 7 },
  { id: 'KJ', name: '관리자', role: 'admin', grade: null },
];

// Check if using demo mode
function isUsingDemo() {
  return !supabaseAdmin;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "concepts";
  const student = searchParams.get("student");

  try {
    let data;

    if (isUsingDemo()) {
      // Demo data fallback
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
        case "student_profile": data = DEMO_PROFILES; break;
        default: data = [];
      }

      // Filter by student if provided
      if (student && data.length > 0) {
        data = data.filter(d => d.student === student || d.id === student);
      }

      return NextResponse.json({ data, demo: true });
    }

    // Supabase queries
    switch (tab) {
      case "concept_progress": {
        let query = supabaseAdmin.from(TABLES.CONCEPT_PROGRESS).select('*');
        if (student) {
          query = query.eq('student_id', student);
        }
        const { data: rows, error } = await query;
        if (error) throw error;
        // Map to legacy format
        data = rows.map(r => ({
          student: r.student_id,
          concept_id: r.concept_id,
          status: r.status,
          mastered_at: r.updated_at,
          score: r.score,
          attempts: r.attempts,
        }));
        break;
      }

      case "student_profile": {
        let query = supabaseAdmin.from(TABLES.PROFILES).select('*');
        if (student) {
          query = query.eq('id', student);
        }
        const { data: rows, error } = await query;
        if (error) throw error;
        data = rows;
        break;
      }

      case "study_timer": {
        let query = supabaseAdmin.from(TABLES.STUDY_SESSIONS).select('*');
        if (student) {
          query = query.eq('student_id', student);
        }
        const { data: rows, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        // Map to legacy format
        data = rows.map(r => ({
          id: r.id,
          student: r.student_id,
          date: r.created_at?.split('T')[0],
          subject: r.subject,
          duration_seconds: Math.round((r.duration_minutes || 0) * 60),
          created_at: r.created_at,
        }));
        break;
      }

      case "sat_scores": {
        let query = supabaseAdmin.from(TABLES.TEST_SCORES).select('*');
        if (student) {
          query = query.eq('student_id', student);
        }
        const { data: rows, error } = await query.order('completed_at', { ascending: false });
        if (error) throw error;
        data = rows.map(r => ({
          id: r.id,
          student: r.student_id,
          test_type: r.test_type,
          test_id: r.test_id,
          ...r.score,
          completed_at: r.completed_at,
        }));
        break;
      }

      // These tabs are not yet in Supabase - return demo data or empty
      case "concepts":
      case "daily":
      case "assignments":
      case "memorization":
      case "devotion":
      case "my_vocabulary":
      default:
        // Return demo data for tabs not yet migrated
        data = {
          concepts: DEMO_CONCEPTS,
          daily: DEMO_DAILY,
          assignments: DEMO_ASSIGNMENTS,
          memorization: DEMO_MEMORIZATION,
          devotion: DEMO_DEVOTION,
          my_vocabulary: DEMO_VOCABULARY,
        }[tab] || [];

        if (student && data.length > 0) {
          data = data.filter(d => d.student === student);
        }
    }

    return NextResponse.json({ data, demo: false });
  } catch (error) {
    console.error("Sheets API route error:", error);
    return NextResponse.json({ error: "Failed to fetch data", details: error.message }, { status: 500 });
  }
}

// POST: Save data
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab");

  try {
    const body = await request.json();

    if (isUsingDemo()) {
      // Demo mode - in-memory updates
      if (tab === 'concept_progress') {
        const { student, concept_id, status, mastered_at } = body;
        const existingIndex = DEMO_CONCEPT_PROGRESS.findIndex(
          p => p.student === student && p.concept_id === concept_id
        );
        if (existingIndex >= 0) {
          DEMO_CONCEPT_PROGRESS[existingIndex] = { student, concept_id, status, mastered_at };
        } else {
          DEMO_CONCEPT_PROGRESS.push({ student, concept_id, status, mastered_at });
        }
        return NextResponse.json({ success: true, data: body, demo: true });
      }

      if (tab === 'reset_progress') {
        const { student } = body;
        if (student === 'all') {
          DEMO_CONCEPT_PROGRESS.length = 0;
        } else {
          const filtered = DEMO_CONCEPT_PROGRESS.filter(p => p.student !== student);
          DEMO_CONCEPT_PROGRESS.length = 0;
          DEMO_CONCEPT_PROGRESS.push(...filtered);
        }
        return NextResponse.json({ success: true, message: 'Progress reset', demo: true });
      }

      return NextResponse.json({ success: true, demo: true });
    }

    // Supabase operations
    if (tab === 'concept_progress') {
      const { student, concept_id, status, mastered_at, diagnosed_weakness } = body;

      const { data, error } = await supabaseAdmin
        .from(TABLES.CONCEPT_PROGRESS)
        .upsert({
          student_id: student,
          concept_id,
          status,
          updated_at: mastered_at || new Date().toISOString(),
        }, {
          onConflict: 'student_id,concept_id',
        })
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, data: data[0] });
    }

    if (tab === 'reset_progress') {
      const { student } = body;

      if (student === 'all') {
        // Delete all progress
        const { error } = await supabaseAdmin
          .from(TABLES.CONCEPT_PROGRESS)
          .delete()
          .neq('id', 0); // Delete all rows
        if (error) throw error;
      } else {
        // Delete specific student's progress
        const { error } = await supabaseAdmin
          .from(TABLES.CONCEPT_PROGRESS)
          .delete()
          .eq('student_id', student);
        if (error) throw error;
      }

      return NextResponse.json({ success: true, message: 'Progress reset' });
    }

    if (tab === 'study_timer') {
      const { student, subject, duration_seconds, date } = body;

      const { data, error } = await supabaseAdmin
        .from(TABLES.STUDY_SESSIONS)
        .insert({
          student_id: student,
          subject,
          duration_minutes: (duration_seconds || 0) / 60,
          created_at: date ? new Date(date).toISOString() : new Date().toISOString(),
        })
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, data: data[0] });
    }

    if (tab === 'student_profile') {
      const { id, name, email, role, grade, curriculum, nickname } = body;

      const { data, error } = await supabaseAdmin
        .from(TABLES.PROFILES)
        .upsert({
          id,
          name,
          email,
          role: role || 'student',
          grade,
          curriculum: curriculum || 'us',
          nickname,
        }, {
          onConflict: 'id',
        })
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, data: data[0] });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheets POST error:", error);
    return NextResponse.json({ error: "Failed to save data", details: error.message }, { status: 500 });
  }
}
