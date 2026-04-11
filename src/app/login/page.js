'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (session) {
      // 로그인됨
      if (session.user?.registered) {
        // 등록된 사용자 → localStorage에 프로필 저장 후 대시보드로
        const profile = {
          id: session.user.studentId,
          name: session.user.displayName,
          email: session.user.email,
          role: session.user.role,
          grade: session.user.grade,
          bgClass: session.user.role === 'admin' ? 'bg-neutral-700' : 'bg-blue-500',
        };
        localStorage.setItem('jb_profile', JSON.stringify(profile));

        // 온보딩 완료 여부 확인
        const onboardingCompleted = localStorage.getItem('jb_onboarding_completed');
        if (onboardingCompleted === profile.id || session.user.role === 'admin') {
          router.push('/dashboard');
        } else {
          router.push('/onboarding');
        }
      } else {
        // 미등록 사용자 → 가입 페이지로
        router.push('/signup');
      }
    }
  }, [session, status, router]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      await signIn('google', { callbackUrl: '/login' });
    } catch (err) {
      console.error('Login error:', err);
      setError('로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  // 이미 로그인된 경우 로딩 표시
  if (status === 'loading' || session) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-text-secondary">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-display font-bold text-text-primary mb-2">
            JubileeBridge
          </h1>
          <p className="text-body text-text-secondary">
            AI 기반 맞춤형 학습 플랫폼
          </p>
        </div>

        {/* 로그인 카드 */}
        <div className="card p-6">
          {/* Google 로그인 버튼 */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className={`
              w-full flex items-center justify-center gap-3 py-3 px-4
              bg-white border border-gray-300 rounded-lg
              text-ui font-medium text-gray-700
              hover:bg-gray-50 hover:border-gray-400
              transition-all
              ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {/* Google 아이콘 */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isLoading ? '로그인 중...' : 'Google로 로그인'}
          </button>

          {/* 에러 메시지 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* 안내 */}
          <div className="mt-6 pt-4 border-t border-border-subtle">
            <p className="text-caption text-text-tertiary text-center">
              처음 사용하시나요? Google 로그인 후<br />
              선생님께 받은 가입 코드를 입력하세요.
            </p>
          </div>
        </div>

        {/* 정보 */}
        <div className="mt-6 text-center text-caption text-text-tertiary">
          <p>Phase 1 MVP : 8과목 4,351 CB</p>
        </div>
      </div>
    </div>
  );
}
