'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Signup 페이지 - 프로필 선택 페이지로 리다이렉트
 *
 * Google OAuth 비활성화됨. 가입 불필요.
 * 기존 코드는 git history에 보존됨.
 */
export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center">
      <div className="text-text-secondary">리다이렉트 중...</div>
    </div>
  );
}
