import { NextResponse } from "next/server";

/**
 * Middleware - 인증 비활성화 버전
 *
 * Google OAuth/NextAuth 인증 대신 localStorage 프로필 선택 방식 사용.
 * 모든 요청을 통과시키고, 프로필 확인은 클라이언트에서 처리.
 *
 * 나중에 OAuth 복원 시 이전 커밋 참조.
 */

export async function middleware(request) {
  // 모든 요청 통과 - 클라이언트에서 프로필 확인
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
