"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (session?.user?.role === "teacher") {
      router.push("/teacher");
    } else if (session?.user?.role === "student") {
      router.push("/student");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-light flex items-center justify-center">
        <div className="text-jgray text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light flex flex-col">
      {/* 상단 장식 바 */}
      <div className="h-1.5 bg-navy" />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* 로고 영역 */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <h1 className="text-navy text-2xl tracking-tight mb-1" style={{ fontWeight: 700 }}>
              Jubilee Bridge
            </h1>
            <p className="text-jgray text-sm">희년의 다리 — Progress Dashboard</p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-white rounded-2xl border border-jborder p-6 sm:p-8">
            <p className="text-sm text-center text-jgray mb-6">
              Sign in with your registered Google account to access your dashboard.
            </p>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-jred/5 border border-jred/20 text-sm text-jred text-center">
                {error === "AccessDenied"
                  ? "Access not authorized. Contact Pastor Jang."
                  : "Sign-in failed. Please try again."}
              </div>
            )}

            {/* Google 로그인 버튼 */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-jborder bg-white hover:bg-light transition-colors text-sm text-navy"
              style={{ fontWeight: 500 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

            {/* 데모 모드 안내 */}
            <div className="mt-5 pt-4 border-t border-jborder">
              <p className="text-xs text-jgray text-center mb-3">
                Or explore with demo data:
              </p>
              <div className="flex gap-2">
                <a
                  href="/student?demo=true"
                  className="flex-1 text-center px-3 py-2 rounded-lg bg-navy/5 text-navy text-xs hover:bg-navy/10 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Student Demo
                </a>
                <a
                  href="/teacher?demo=true"
                  className="flex-1 text-center px-3 py-2 rounded-lg bg-teal/5 text-teal text-xs hover:bg-teal/10 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Teacher Demo
                </a>
              </div>
            </div>
          </div>

          {/* 하단 텍스트 */}
          <p className="text-center text-[11px] text-jgray mt-6">
            Purdue Korean Church Youth · Wisdom Dock US Track
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-light flex items-center justify-center">
        <div className="text-jgray text-sm">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
