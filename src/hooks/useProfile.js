'use client';

import { useState, useEffect, useCallback } from 'react';

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
    setProfile(null);
    window.location.href = '/login';
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
