'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export default function SignupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 세션 로딩 중
    if (status === 'loading') return;

    // 로그인 안 됨 → 로그인 페이지로
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    // 이미 등록된 사용자 → 대시보드로
    if (session?.user?.registered) {
      router.push('/dashboard');
      return;
    }

    // Google 이름으로 기본값 설정
    if (session?.user?.name && !name) {
      setName(session.user.name);
    }
  }, [session, status, router, name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase().trim(),
          email: session.user.email,
          name: name.trim(),
          grade: grade || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '가입 처리 중 오류가 발생했습니다.');
        setIsLoading(false);
        return;
      }

      // 성공: localStorage에 저장 후 리다이렉트
      localStorage.setItem('jb_profile', JSON.stringify(data.user));

      // 관리자는 대시보드로, 학생은 온보딩으로
      if (data.user.role === 'admin') {
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('네트워크 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  if (status === 'loading') {
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
            가입 코드를 입력하세요
          </p>
        </div>

        {/* 현재 Google 계정 */}
        <div className="card p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt="Profile"
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <div className="text-ui font-medium text-text-primary">
                {session?.user?.email}
              </div>
              <div className="text-caption text-text-tertiary">
                Google 계정으로 로그인됨
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-caption text-text-secondary hover:text-text-primary"
          >
            변경
          </button>
        </div>

        {/* 가입 폼 */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 */}
            <div>
              <label className="block text-ui font-medium text-text-primary mb-2">
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름 입력"
                className="w-full px-4 py-3 bg-bg-sidebar border border-border-subtle rounded-lg text-body focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            {/* 학년 */}
            <div>
              <label className="block text-ui font-medium text-text-primary mb-2">
                학년
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-4 py-3 bg-bg-sidebar border border-border-subtle rounded-lg text-body focus:border-blue-500 focus:outline-none"
              >
                <option value="">학년 선택 (학생만)</option>
                <option value="6">6학년</option>
                <option value="7">7학년</option>
                <option value="8">8학년</option>
                <option value="9">9학년</option>
                <option value="10">10학년</option>
                <option value="11">11학년</option>
                <option value="12">12학년</option>
              </select>
              <p className="mt-1 text-xs text-text-tertiary">
                관리자 코드는 학년 선택 불필요
              </p>
            </div>

            {/* 가입 코드 */}
            <div>
              <label className="block text-ui font-medium text-text-primary mb-2">
                가입 코드
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="가입 코드 입력"
                className="w-full px-4 py-3 bg-bg-sidebar border border-border-subtle rounded-lg text-body tracking-widest font-mono focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* 가입 버튼 */}
            <button
              type="submit"
              disabled={isLoading || !code.trim() || !name.trim()}
              className={`
                w-full py-3 rounded-lg text-ui font-semibold transition-all text-white
                ${isLoading || !code.trim() || !name.trim()
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
                }
              `}
            >
              {isLoading ? '확인 중...' : '가입하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
