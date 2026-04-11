"use client";

import { useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";

function HomeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    // localStorage에서 프로필 확인
    const storedProfile = localStorage.getItem("jb_profile");

    if (session?.user?.registered || storedProfile) {
      // 로그인된 사용자 → 대시보드로
      router.replace("/dashboard");
    } else if (session && !session.user?.registered) {
      // Google 로그인은 됐지만 미등록 → signup으로
      router.replace("/signup");
    } else {
      // 로그인 안 됨 → 로그인 페이지로
      router.replace("/login");
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center">
      <div className="text-text-tertiary text-ui">Loading...</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-text-tertiary text-ui">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
