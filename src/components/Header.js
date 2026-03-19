"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const isTeacher = session?.user?.role === "teacher";
  const isStudent = session?.user?.role === "student";
  const displayName = session?.user?.displayName || session?.user?.name || "";

  return (
    <header className="bg-navy px-4 sm:px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div>
          <Link href={isTeacher ? "/teacher" : "/student"} className="text-white text-lg sm:text-xl tracking-tight" style={{ fontWeight: 700 }}>
            Jubilee Bridge
          </Link>
          <div className="text-white/50 text-xs mt-0.5">Progress dashboard</div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 역할 기반 네비게이션 */}
          {isStudent && (
            <Link
              href="/student"
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs transition-colors ${
                pathname === "/student" 
                  ? "bg-white text-navy" 
                  : "bg-white/15 text-white hover:bg-white/25"
              }`}
              style={{ fontWeight: 500 }}
            >
              My Dashboard
            </Link>
          )}
          
          {isTeacher && (
            <>
              <Link
                href="/teacher"
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs transition-colors ${
                  pathname === "/teacher"
                    ? "bg-white text-navy"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
                style={{ fontWeight: 500 }}
              >
                All Students
              </Link>
              <Link
                href="/student"
                className={`px-3 sm:px-4 py-1.5 rounded-full text-xs transition-colors ${
                  pathname.startsWith("/student")
                    ? "bg-white text-navy"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
                style={{ fontWeight: 500 }}
              >
                Student View
              </Link>
            </>
          )}
          
          {/* 사용자 정보 + 로그아웃 */}
          {session && (
            <div className="flex items-center gap-2 ml-2 sm:ml-4">
              <span className="text-white/60 text-xs hidden sm:inline">{displayName}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-white/40 hover:text-white/80 text-xs transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
