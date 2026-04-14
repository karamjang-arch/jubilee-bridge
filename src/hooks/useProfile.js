'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * useProfile - localStorage 기반 프로필 관리
 *
 * Google OAuth/NextAuth 대신 간단한 프로필 선택 방식 사용.
 * 프로필은 localStorage에 저장됨.
 */
export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // localStorage에서 프로필 로드
    const stored = localStorage.getItem('jb_profile');
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem('jb_profile');
      }
    }
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('jb_profile');
    localStorage.removeItem('jb_onboarding_completed');
    setProfile(null);
    window.location.href = '/';
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isStudent = profile?.role === 'student';
  const studentId = profile?.id;

  return {
    profile,
    isLoading,
    isAdmin,
    isStudent,
    studentId,
    logout,
  };
}

export default useProfile;
