'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Login 페이지 - 프로필 선택 페이지로 리다이렉트
 *
 * Google OAuth 비활성화됨. 프로필 선택 방식으로 변경.
 * 기존 Google OAuth 코드는 route.js에 보존됨.
 */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // 프로필 선택 페이지로 리다이렉트
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center">
      <div className="text-text-secondary">리다이렉트 중...</div>
    </div>
  );
}
