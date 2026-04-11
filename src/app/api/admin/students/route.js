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

// GET: 학생 목록 + 통계
export async function GET(request) {
  try {
    if (isUsingDemo()) {
      // 데모 데이터
      return NextResponse.json({
        students: [
          { id: 'JH', name: '지후', grade: 10, masteredCount: 127, streak: 7 },
          { id: 'EH', name: '은후', grade: 7, masteredCount: 43, streak: 3 },
        ],
      });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 학생 프로필 조회
    const profileRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'student_profile!A:G',
    });

    const profileRows = profileRes.data.values || [];
    if (profileRows.length <= 1) {
      return NextResponse.json({ students: [] });
    }

    const profileHeaders = profileRows[0];
    const idIdx = profileHeaders.indexOf('id');
    const nameIdx = profileHeaders.indexOf('name');
    const gradeIdx = profileHeaders.indexOf('grade');
    const roleIdx = profileHeaders.indexOf('role');

    // 학생만 필터링
    const students = profileRows.slice(1)
      .filter(row => row[roleIdx] === 'student')
      .map(row => ({
        id: row[idIdx],
        name: row[nameIdx],
        grade: row[gradeIdx] ? parseInt(row[gradeIdx]) : null,
      }));

    // concept_progress에서 mastered 개수 조회
    const progressRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'concept_progress!A:D',
    });

    const progressRows = progressRes.data.values || [];
    const progressHeaders = progressRows[0] || [];
    const studentIdx = progressHeaders.indexOf('student');
    const statusIdx = progressHeaders.indexOf('status');

    // 학생별 마스터 개수 계산
    const masterCounts = {};
    progressRows.slice(1).forEach(row => {
      const student = row[studentIdx];
      const status = row[statusIdx];
      if (status === 'mastered' || status === 'placement_mastered') {
        masterCounts[student] = (masterCounts[student] || 0) + 1;
      }
    });

    // study_timer에서 스트릭 계산
    const timerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'study_timer!A:C',
    });

    const timerRows = timerRes.data.values || [];
    const timerHeaders = timerRows[0] || [];
    const timerStudentIdx = timerHeaders.indexOf('student');
    const dateIdx = timerHeaders.indexOf('date');

    // 학생별 학습일 수집
    const studyDays = {};
    timerRows.slice(1).forEach(row => {
      const student = row[timerStudentIdx];
      const date = row[dateIdx];
      if (!studyDays[student]) studyDays[student] = new Set();
      if (date) studyDays[student].add(date);
    });

    // 스트릭 계산
    const calculateStreak = (days) => {
      if (!days || days.size === 0) return 0;
      const sortedDays = [...days].sort().reverse();
      let streak = 0;
      for (let i = 0; i < sortedDays.length; i++) {
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        const expected = expectedDate.toISOString().split('T')[0];
        if (sortedDays[i] === expected) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    };

    // 학생 정보 합치기
    const studentsWithStats = students.map(student => ({
      ...student,
      masteredCount: masterCounts[student.id] || 0,
      streak: calculateStreak(studyDays[student.id]),
    }));

    return NextResponse.json({ students: studentsWithStats });
  } catch (error) {
    console.error('Admin students GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
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
      // 데모 모드에서는 성공 응답만 반환
      return NextResponse.json({ success: true, message: `${action} completed (demo)` });
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (action === 'reset') {
      // 전체 리셋: 여러 탭에서 해당 학생 데이터 삭제
      const tabsToReset = ['concept_progress', 'my_vocabulary', 'devotion', 'study_timer'];

      for (const tab of tabsToReset) {
        await deleteStudentRows(sheets, spreadsheetId, tab, studentId);
      }

      // student_profile에서 onboarding_done을 FALSE로 변경
      await updateOnboardingStatus(sheets, spreadsheetId, studentId, 'FALSE');

      return NextResponse.json({ success: true, message: '전체 데이터가 초기화되었습니다.' });
    }

    if (action === 'rediagnose') {
      // 재진단: placement_mastered만 삭제
      await deleteStudentRows(sheets, spreadsheetId, 'concept_progress', studentId, 'placement_mastered');

      // onboarding_done을 FALSE로 변경
      await updateOnboardingStatus(sheets, spreadsheetId, studentId, 'FALSE');

      return NextResponse.json({ success: true, message: '진단평가가 초기화되었습니다.' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Admin students POST error:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}

// 학생 행 삭제 헬퍼
async function deleteStudentRows(sheets, spreadsheetId, tabName, studentId, statusFilter = null) {
  // 먼저 데이터 읽기
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:Z`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return;

  const headers = rows[0];
  const studentIdx = headers.indexOf('student');
  const statusIdx = headers.indexOf('status');

  if (studentIdx === -1) return;

  // 삭제할 행 인덱스 찾기 (역순으로 삭제해야 인덱스가 안 꼬임)
  const rowsToDelete = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[studentIdx] === studentId) {
      if (statusFilter) {
        // 특정 status만 삭제
        if (row[statusIdx] === statusFilter) {
          rowsToDelete.push(i);
        }
      } else {
        // 모든 행 삭제
        rowsToDelete.push(i);
      }
    }
  }

  if (rowsToDelete.length === 0) return;

  // 시트 ID 가져오기
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === tabName);
  if (!sheet) return;

  const sheetId = sheet.properties.sheetId;

  // 역순으로 행 삭제 (batchUpdate)
  const requests = rowsToDelete.reverse().map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: rowIndex,
        endIndex: rowIndex + 1,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

// onboarding_done 상태 업데이트
async function updateOnboardingStatus(sheets, spreadsheetId, studentId, value) {
  // student_profile 탭에서 해당 학생 찾기
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'student_profile!A:H',
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return;

  const headers = rows[0];
  const idIdx = headers.indexOf('id');
  let onboardingIdx = headers.indexOf('onboarding_done');

  // onboarding_done 컬럼이 없으면 추가
  if (onboardingIdx === -1) {
    onboardingIdx = headers.length;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `student_profile!${String.fromCharCode(65 + onboardingIdx)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['onboarding_done']] },
    });
  }

  // 학생 행 찾기
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === studentId) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `student_profile!${String.fromCharCode(65 + onboardingIdx)}${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[value]] },
      });
      break;
    }
  }
}
