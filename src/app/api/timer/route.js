import { NextResponse } from "next/server";
import { google } from "googleapis";
import { isUsingDemo } from "@/lib/demo-data";

// Google Sheets 인증
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// study_timer 탭 헤더
const TIMER_HEADERS = ['student', 'subject', 'date', 'start_at', 'end_at', 'duration_min', 'source'];

// study_timer 탭 확인/생성
async function ensureTimerSheet(sheets, spreadsheetId) {
  try {
    // 스프레드시트 메타데이터 조회
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets?.some(
      s => s.properties?.title === 'study_timer'
    );

    if (!sheetExists) {
      // 시트 추가
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: 'study_timer' }
            }
          }]
        }
      });

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'study_timer!A1:G1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [TIMER_HEADERS]
        }
      });

      console.log('Created study_timer sheet with headers');
    }

    return true;
  } catch (error) {
    console.error('Error ensuring timer sheet:', error);
    return false;
  }
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

    // 최소 검증 제거 (0분도 허용, 클라이언트에서 10초 미만만 필터링)

    if (isUsingDemo()) {
      // 데모 모드: 성공 응답만 반환
      return NextResponse.json({
        success: true,
        message: 'Demo mode - session not saved',
        session: { student, subject, startAt, endAt, durationMin }
      });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // study_timer 탭 확인/생성
    await ensureTimerSheet(sheets, spreadsheetId);

    // 날짜 추출 (startAt에서)
    const date = startAt.split('T')[0];

    // 행 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'study_timer!A:G',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[student, subject, date, startAt, endAt, durationMin, 'timer']]
      }
    });

    return NextResponse.json({
      success: true,
      session: { student, subject, date, startAt, endAt, durationMin }
    });

  } catch (error) {
    console.error('Timer POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save timer session' },
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
      // 데모 데이터
      return NextResponse.json({
        sessions: [
          { subject: 'math', durationMin: 45, startAt: `${date}T09:00:00`, endAt: `${date}T09:45:00` },
          { subject: 'english', durationMin: 30, startAt: `${date}T10:00:00`, endAt: `${date}T10:30:00` },
        ],
        todayTotal: 75,
        weekTotal: 420
      });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // study_timer 탭 확인/생성
    await ensureTimerSheet(sheets, spreadsheetId);

    // 데이터 조회
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'study_timer!A:G',
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({ sessions: [], todayTotal: 0, weekTotal: 0 });
    }

    const headers = rows[0];
    const studentIdx = headers.indexOf('student');
    const subjectIdx = headers.indexOf('subject');
    const dateIdx = headers.indexOf('date');
    const startAtIdx = headers.indexOf('start_at');
    const endAtIdx = headers.indexOf('end_at');
    const durationIdx = headers.indexOf('duration_min');

    // 학생 필터링
    const studentRows = rows.slice(1).filter(row => row[studentIdx] === student);

    // 오늘 날짜
    const today = date || new Date().toISOString().split('T')[0];

    // 주간 시작일 (일요일)
    const todayDate = new Date(today);
    const dayOfWeek = todayDate.getDay();
    const weekStart = new Date(todayDate);
    weekStart.setDate(todayDate.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // 오늘 세션
    const todaySessions = studentRows
      .filter(row => row[dateIdx] === today)
      .map(row => ({
        subject: row[subjectIdx],
        durationMin: parseInt(row[durationIdx]) || 0,
        startAt: row[startAtIdx],
        endAt: row[endAtIdx]
      }));

    // 오늘 총 시간
    const todayTotal = todaySessions.reduce((sum, s) => sum + s.durationMin, 0);

    // 주간 총 시간
    const weekSessions = studentRows.filter(row => {
      const rowDate = row[dateIdx];
      return rowDate >= weekStartStr && rowDate <= today;
    });
    const weekTotal = weekSessions.reduce((sum, row) => sum + (parseInt(row[durationIdx]) || 0), 0);

    // 과목별 오늘 누적
    const subjectTotals = {};
    for (const session of todaySessions) {
      subjectTotals[session.subject] = (subjectTotals[session.subject] || 0) + session.durationMin;
    }

    // 과목별 주간 누적
    const weekSubjectTotals = {};
    for (const row of weekSessions) {
      const subject = row[subjectIdx];
      const duration = parseInt(row[durationIdx]) || 0;
      weekSubjectTotals[subject] = (weekSubjectTotals[subject] || 0) + duration;
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
      { error: 'Failed to fetch timer data' },
      { status: 500 }
    );
  }
}
