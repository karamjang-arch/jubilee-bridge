import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  
  // 데모 모드는 인증 없이 접근 허용
  if (searchParams.get("demo") === "true") {
    return NextResponse.next();
  }

  // 보호 경로 확인
  const protectedPaths = ["/student", "/teacher"];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));
  
  if (!isProtected) {
    return NextResponse.next();
  }

  // JWT 토큰 확인
  const token = await getToken({ req: request });
  
  if (!token) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("error", "SessionRequired");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*"],
};
