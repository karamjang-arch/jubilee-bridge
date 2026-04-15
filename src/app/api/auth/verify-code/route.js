import { NextResponse } from "next/server";
import { supabaseAdmin, TABLES } from "@/lib/supabase";

// 공용 가입 코드 (반복 사용 가능, 대소문자 무시)
const ACCESS_CODES = [
  { code: 'JUBILEE2026', role: 'student' },
  { code: 'ADMIN-KARAM', role: 'admin' },
];

// Check if using demo mode
function isUsingDemo() {
  return !supabaseAdmin;
}

// 코드 검증 (간단한 매칭, used 체크 없음)
function verifyCode(inputCode) {
  const normalized = inputCode.toUpperCase().trim();
  return ACCESS_CODES.find(c => c.code === normalized) || null;
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
      curriculum: 'us',
    };

    // 프로필 저장
    if (!isUsingDemo()) {
      try {
        const { error } = await supabaseAdmin
          .from(TABLES.PROFILES)
          .upsert({
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            grade: newUser.grade,
            curriculum: newUser.curriculum,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'id',
          });

        if (error) {
          console.error('Failed to save profile:', error);
          // 프로필 저장 실패해도 로그인은 허용 (localStorage에 저장됨)
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
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
