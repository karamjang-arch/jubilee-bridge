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
    if (session?.user) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-text-tertiary text-ui">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* 상단 장식 바 */}
      <div className="h-1 bg-subj-math" />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* 로고 영역 */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-subj-math mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-display text-text-primary mb-1">
              JubileeBridge
            </h1>
            <p className="text-text-tertiary text-body">8과목 4,351 CB 학습 플랫폼</p>
          </div>

          {/* 로그인 카드 */}
          <div className="card p-6 sm:p-8">
            <p className="text-body text-center text-text-secondary mb-6">
              등록된 Google 계정으로 로그인하세요.
            </p>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-danger-light border border-danger/20 text-ui text-danger text-center">
                {error === "AccessDenied"
                  ? "접근 권한이 없습니다. 담당자에게 문의하세요."
                  : "로그인에 실패했습니다. 다시 시도해주세요."}
              </div>
            )}

            {/* Google 로그인 버튼 */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-md border border-border-medium bg-bg-card hover:bg-bg-hover transition-colors text-ui text-text-primary"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google로 로그인
            </button>

            {/* 데모 모드 안내 */}
            <div className="mt-5 pt-4 border-t border-border-subtle">
              <p className="text-caption text-text-tertiary text-center mb-3">
                또는 데모 모드로 둘러보기:
              </p>
              <a
                href="/dashboard?demo=true"
                className="block w-full text-center px-3 py-2 rounded-md bg-subj-math/10 text-subj-math text-ui hover:bg-subj-math/20 transition-colors"
              >
                데모 대시보드
              </a>
            </div>
          </div>

          {/* 하단 텍스트 */}
          <p className="text-center text-caption text-text-disabled mt-6">
            Jubilee Lab · 주빌리브릿지 v1.0
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-text-tertiary text-ui">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
