"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PROFILES = [
  {
    id: 'KJ',
    name: '장가람',
    role: 'admin',
    grade: null,
    emoji: '👨‍💼',
    label: '관리자',
    bgClass: 'bg-neutral-700',
  },
  {
    id: 'JH',
    name: '지후',
    role: 'student',
    grade: 11,
    emoji: '👦',
    label: '11학년',
    bgClass: 'bg-blue-500',
  },
  {
    id: 'EH',
    name: '은후',
    role: 'student',
    grade: 7,
    emoji: '👧',
    label: '7학년',
    bgClass: 'bg-pink-500',
  },
];

export default function ProfileSelectPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 이미 프로필이 선택되어 있으면 적절한 페이지로
    const stored = localStorage.getItem('jb_profile');
    if (stored) {
      try {
        const profile = JSON.parse(stored);
        const onboardingCompleted = localStorage.getItem('jb_onboarding_completed');

        // 관리자 또는 온보딩 완료 → 대시보드
        if (profile.role === 'admin' || onboardingCompleted === profile.id) {
          router.replace('/dashboard');
        } else {
          // 학생이고 온보딩 미완료 → 온보딩
          router.replace('/onboarding');
        }
      } catch (e) {
        localStorage.removeItem('jb_profile');
      }
    }
  }, [router]);

  const handleSelectProfile = (profile) => {
    localStorage.setItem('jb_profile', JSON.stringify(profile));

    // 관리자 → 대시보드
    if (profile.role === 'admin') {
      router.push('/dashboard');
      return;
    }

    // 학생: 온보딩 완료 여부 확인
    const onboardingCompleted = localStorage.getItem('jb_onboarding_completed');
    if (onboardingCompleted === profile.id) {
      router.push('/dashboard');
    } else {
      router.push('/onboarding');
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="text-text-tertiary text-ui">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-display font-bold text-text-primary mb-2">
            JubileeBridge
          </h1>
          <p className="text-body text-text-secondary">
            사용자를 선택하세요
          </p>
        </div>

        {/* 프로필 카드 */}
        <div className="space-y-3">
          {PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleSelectProfile(profile)}
              className="w-full card p-4 hover:shadow-card-hover transition-all hover:scale-[1.02] active:scale-[0.98] text-left"
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full ${profile.bgClass} flex items-center justify-center text-2xl`}>
                  {profile.emoji}
                </div>
                <div className="flex-1">
                  <div className="text-subheading text-text-primary font-medium">
                    {profile.name}
                  </div>
                  <div className="text-caption text-text-tertiary">
                    {profile.label}
                    {profile.grade && ` · ${profile.role === 'student' ? '학생' : ''}`}
                  </div>
                </div>
                <div className="text-text-tertiary">
                  →
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 정보 */}
        <div className="mt-8 text-center text-caption text-text-tertiary">
          <p>Phase 1 MVP : 8과목 4,351 CB</p>
        </div>
      </div>
    </div>
  );
}
