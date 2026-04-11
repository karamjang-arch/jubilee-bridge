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

// concept_history 탭 헤더 (9개)
const CONCEPT_HEADERS = [
  'student_id',
  'event_type',
  'timestamp',
  'curriculum',
  'subject',
  'concept_id',
  'score',
  'duration_sec',
  'detail_json'
];

// 유효한 event_type 목록
const VALID_EVENT_TYPES = [
  'content_view',      // 개념 콘텐츠 열람
  'test_attempt',      // 테스트 응시
  'test_complete',     // 테스트 완료 (점수 포함)
  'essay_submit',      // 에세이 제출 (채점 결과 포함)
  'mastery_update',    // 숙달도 변경
  'review_scheduled'   // 복습 예약
];

// concept_history 탭 확인/생성
async function ensureConceptHistorySheet(sheets, spreadsheetId) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets?.some(
      s => s.properties?.title === 'concept_history'
    );

    if (!sheetExists) {
      // 시트 추가
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'concept_history',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 9,
                  frozenRowCount: 1
                }
              }
            }
          }]
        }
      });

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'concept_history!A1:I1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [CONCEPT_HEADERS]
        }
      });

      console.log('Created concept_history sheet with headers');
    }

    return true;
  } catch (error) {
    console.error('Error ensuring concept_history sheet:', error);
    return false;
  }
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

    // timestamp 생성
    const timestamp = new Date().toISOString();

    // detail을 JSON 문자열로 변환
    const detailJson = detail ? JSON.stringify(detail) : '';

    if (isUsingDemo()) {
      return NextResponse.json({
        success: true,
        message: 'Demo mode - event not saved',
        event: { student_id, event_type, timestamp, curriculum, subject, concept_id, score, duration_sec }
      });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // concept_history 탭 확인/생성
    await ensureConceptHistorySheet(sheets, spreadsheetId);

    // 행 추가
    const row = [
      student_id,
      event_type,
      timestamp,
      curriculum || '',
      subject || '',
      concept_id || '',
      score !== undefined && score !== null ? String(score) : '',
      duration_sec !== undefined && duration_sec !== null ? String(duration_sec) : '',
      detailJson
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'concept_history!A:I',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    });

    return NextResponse.json({
      success: true,
      event: { student_id, event_type, timestamp, curriculum, subject, concept_id, score, duration_sec }
    });

  } catch (error) {
    console.error('Concept history POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save concept history event' },
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
        total: 2
      });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // concept_history 탭 확인/생성
    await ensureConceptHistorySheet(sheets, spreadsheetId);

    // 데이터 조회
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'concept_history!A:I',
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({ events: [], total: 0 });
    }

    const headers = rows[0];
    const studentIdIdx = headers.indexOf('student_id');
    const eventTypeIdx = headers.indexOf('event_type');
    const timestampIdx = headers.indexOf('timestamp');
    const curriculumIdx = headers.indexOf('curriculum');
    const subjectIdx = headers.indexOf('subject');
    const conceptIdIdx = headers.indexOf('concept_id');
    const scoreIdx = headers.indexOf('score');
    const durationIdx = headers.indexOf('duration_sec');
    const detailIdx = headers.indexOf('detail_json');

    // 필터링
    let filteredRows = rows.slice(1).filter(row => row[studentIdIdx] === student_id);

    if (event_type) {
      filteredRows = filteredRows.filter(row => row[eventTypeIdx] === event_type);
    }

    if (subject) {
      filteredRows = filteredRows.filter(row => row[subjectIdx] === subject);
    }

    if (concept_id) {
      filteredRows = filteredRows.filter(row => row[conceptIdIdx] === concept_id);
    }

    // 최신순 정렬
    filteredRows.sort((a, b) => {
      const dateA = new Date(a[timestampIdx] || 0);
      const dateB = new Date(b[timestampIdx] || 0);
      return dateB - dateA;
    });

    // limit 적용
    const limitedRows = filteredRows.slice(0, limit);

    // 데이터 변환
    const events = limitedRows.map(row => {
      let detail = {};
      try {
        if (row[detailIdx]) {
          detail = JSON.parse(row[detailIdx]);
        }
      } catch (e) {
        // JSON 파싱 실패 시 빈 객체
      }

      return {
        student_id: row[studentIdIdx],
        event_type: row[eventTypeIdx],
        timestamp: row[timestampIdx],
        curriculum: row[curriculumIdx] || null,
        subject: row[subjectIdx] || null,
        concept_id: row[conceptIdIdx] || null,
        score: row[scoreIdx] ? parseFloat(row[scoreIdx]) : null,
        duration_sec: row[durationIdx] ? parseInt(row[durationIdx]) : null,
        detail
      };
    });

    // 통계 계산
    const stats = calculateStats(filteredRows, {
      eventTypeIdx,
      subjectIdx,
      scoreIdx,
      durationIdx
    });

    return NextResponse.json({
      events,
      total: filteredRows.length,
      stats
    });

  } catch (error) {
    console.error('Concept history GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch concept history' },
      { status: 500 }
    );
  }
}

// 통계 계산 헬퍼
function calculateStats(rows, indices) {
  const { eventTypeIdx, subjectIdx, scoreIdx, durationIdx } = indices;

  // 이벤트 타입별 카운트
  const eventCounts = {};
  for (const row of rows) {
    const type = row[eventTypeIdx];
    eventCounts[type] = (eventCounts[type] || 0) + 1;
  }

  // 과목별 카운트
  const subjectCounts = {};
  for (const row of rows) {
    const subj = row[subjectIdx];
    if (subj) {
      subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
    }
  }

  // 테스트 평균 점수
  const testScores = rows
    .filter(row => row[eventTypeIdx] === 'test_complete' && row[scoreIdx])
    .map(row => parseFloat(row[scoreIdx]));
  const avgTestScore = testScores.length > 0
    ? Math.round(testScores.reduce((a, b) => a + b, 0) / testScores.length)
    : null;

  // 총 학습 시간 (초)
  const totalDurationSec = rows
    .filter(row => row[durationIdx])
    .reduce((sum, row) => sum + (parseInt(row[durationIdx]) || 0), 0);

  return {
    eventCounts,
    subjectCounts,
    avgTestScore,
    totalDurationSec,
    totalDurationMin: Math.round(totalDurationSec / 60)
  };
}
