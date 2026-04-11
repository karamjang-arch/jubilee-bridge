import { NextResponse } from "next/server";
import { google } from "googleapis";
import { isUsingDemo } from "@/lib/demo-data";

// 공용 가입 코드 (반복 사용 가능, 대소문자 무시)
const ACCESS_CODES = [
  { code: 'JUBILEE2026', role: 'student' },
  { code: 'ADMIN-KARAM', role: 'admin' },
];

// 코드 검증 (간단한 매칭, used 체크 없음)
function verifyCode(inputCode) {
  const normalized = inputCode.toUpperCase().trim();
  return ACCESS_CODES.find(c => c.code === normalized) || null;
}

// 새 사용자를 student_profile에 추가
async function addUserToProfiles(userData) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // student_profile 탭에 새 행 추가
  // 컬럼 순서: id, name, email, role, grade, school, created_at
  const newRow = [
    userData.id,
    userData.name,
    userData.email,
    userData.role,
    userData.grade || '',
    userData.school || '',
    new Date().toISOString().split('T')[0],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'student_profile!A:G',
    valueInputOption: 'RAW',
    requestBody: {
      values: [newRow],
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { code, email, name, grade } = body;

    if (!code || !email || !name) {
      return NextResponse.json(
        { error: '필수 항목을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 코드 검증
    const codeData = verifyCode(code);

    if (!codeData) {
      return NextResponse.json(
        { error: '유효하지 않은 코드입니다.' },
        { status: 400 }
      );
    }

    // 학생인 경우 학년 필수
    if (codeData.role === 'student' && !grade) {
      return NextResponse.json(
        { error: '학년을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 사용자 ID 생성 (이름의 이니셜 + 랜덤)
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
    const randomSuffix = Math.random().toString(36).substring(2, 4).toUpperCase();
    const userId = initials + randomSuffix;

    const newUser = {
      id: userId,
      name,
      email,
      role: codeData.role,
      grade: codeData.role === 'student' ? parseInt(grade) : null,
      school: '',
    };

    // 프로필 저장 (데모가 아닌 경우)
    if (!isUsingDemo()) {
      try {
        await addUserToProfiles(newUser);
      } catch (sheetError) {
        console.error('Failed to save to Sheets:', sheetError);
        // Sheets 저장 실패해도 로그인은 허용 (localStorage에 저장됨)
      }
    }

    return NextResponse.json({
      success: true,
      user: newUser,
    });
  } catch (error) {
    console.error('Verify code error:', error);
    return NextResponse.json(
      { error: '코드 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
