'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';

export function useProfile() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // NextAuth 세션 로딩 중
    if (status === 'loading') return;

    // 1. NextAuth 세션에서 등록된 사용자 정보 확인
    if (session?.user?.registered) {
      const authProfile = {
        id: session.user.studentId,
        name: session.user.displayName,
        email: session.user.email,
        role: session.user.role,
        grade: session.user.grade,
        bgClass: session.user.role === 'admin' ? 'bg-neutral-700' : 'bg-blue-500',
      };
      setProfile(authProfile);
      // localStorage에도 동기화
      localStorage.setItem('jb_profile', JSON.stringify(authProfile));
      setIsLoading(false);
      return;
    }

    // 2. localStorage에서 프로필 확인 (가입 직후 또는 레거시 지원)
    const stored = localStorage.getItem('jb_profile');
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('jb_profile');
      }
    }
    setIsLoading(false);
  }, [session, status]);

  const logout = useCallback(async () => {
    localStorage.removeItem('jb_profile');
    localStorage.removeItem('jb_onboarding_completed');
    setProfile(null);

    // NextAuth 세션이 있으면 로그아웃
    if (session) {
      await signOut({ callbackUrl: '/login' });
    } else {
      window.location.href = '/login';
    }
  }, [session]);

  const isAdmin = profile?.role === 'admin';
  const isStudent = profile?.role === 'student';
  const studentId = profile?.id;

  return {
    profile,
    isLoading: isLoading || status === 'loading',
    isAdmin,
    isStudent,
    studentId,
    logout,
    session,
    sessionStatus: status,
  };
}

export default useProfile;
