import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

// 공개 경로 (로그인 없이 접근 가능)
const publicPaths = [
  "/login",
  "/signup",
  "/api/auth",
  "/_next",
  "/favicon.ico",
];

// 인증 필요 경로
const protectedPaths = [
  "/dashboard",
  "/skillmap",
  "/words",
  "/practice-tests",
  "/calendar",
  "/timer",
  "/onboarding",
  "/settings",
];

export async function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  // 데모 모드는 인증 없이 접근 허용
  if (searchParams.get("demo") === "true") {
    return NextResponse.next();
  }

  // 공개 경로는 통과
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // API 경로는 통과 (개별 API에서 인증 처리)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 보호 경로 확인
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  // JWT 토큰 확인
  const token = await getToken({ req: request });

  if (!token) {
    // localStorage 프로필은 클라이언트에서 확인하므로
    // 서버에서는 토큰만 확인하고 없으면 로그인 페이지로
    // 단, 토큰이 없어도 localStorage에 프로필이 있을 수 있으므로 리다이렉트 안 함
    // 클라이언트에서 처리하도록 통과
    return NextResponse.next();
  }

  // 토큰은 있지만 미등록 사용자인 경우
  if (token && !token.registered && !pathname.startsWith("/signup")) {
    return NextResponse.redirect(new URL("/signup", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 다음 경로는 제외:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
