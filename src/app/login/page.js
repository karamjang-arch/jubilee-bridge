'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PROFILES = [
  { id: 'JH', name: '지후', role: 'student', grade: 10, emoji: 'JH', color: 'blue', bgClass: 'bg-blue-500', lightBgClass: 'bg-blue-100', borderClass: 'border-blue-500', textClass: 'text-blue-600' },
  { id: 'EH', name: '은후', role: 'student', grade: 7, emoji: 'EH', color: 'pink', bgClass: 'bg-pink-500', lightBgClass: 'bg-pink-100', borderClass: 'border-pink-500', textClass: 'text-pink-600' },
  { id: 'KJ', name: '관리자', role: 'admin', grade: null, emoji: 'KJ', color: 'neutral', bgClass: 'bg-neutral-700', lightBgClass: 'bg-neutral-100', borderClass: 'border-neutral-700', textClass: 'text-neutral-700' },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    // 이미 로그인된 경우 대시보드로 리다이렉트
    const profile = localStorage.getItem('jb_profile');
    if (profile) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = () => {
    if (!selectedProfile) return;

    localStorage.setItem('jb_profile', JSON.stringify(selectedProfile));

    // 첫 로그인인 경우 온보딩으로
    const onboardingCompleted = localStorage.getItem('jb_onboarding_completed');
    if (onboardingCompleted === selectedProfile.id) {
      router.push('/dashboard');
    } else {
      router.push('/onboarding');
    }
  };

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-display font-bold text-text-primary mb-2">
            JubileeBridge
          </h1>
          <p className="text-body text-text-secondary">
            프로필을 선택하세요
          </p>
        </div>

        {/* 프로필 선택 */}
        <div className="card p-6 space-y-4">
          {PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => setSelectedProfile(profile)}
              className={`
                w-full p-4 rounded-lg border-2 transition-all flex items-center gap-4
                ${selectedProfile?.id === profile.id
                  ? `${profile.borderClass} ${profile.lightBgClass}`
                  : 'border-border-subtle hover:border-border-strong hover:bg-bg-hover'
                }
              `}
            >
              {/* 아바타 */}
              <div className={`
                w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white
                ${profile.bgClass}
              `}>
                {profile.emoji}
              </div>

              {/* 정보 */}
              <div className="flex-1 text-left">
                <div className={`text-subheading font-semibold ${selectedProfile?.id === profile.id ? profile.textClass : 'text-text-primary'}`}>
                  {profile.name}
                </div>
                <div className="text-caption text-text-tertiary">
                  {profile.role === 'admin'
                    ? '관리자 · 전체 데이터 접근 가능'
                    : `학생 · ${profile.grade}학년`
                  }
                </div>
              </div>

              {/* 체크 표시 */}
              {selectedProfile?.id === profile.id && (
                <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center ${profile.bgClass}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}

          {/* 로그인 버튼 */}
          <button
            onClick={handleLogin}
            disabled={!selectedProfile}
            className={`
              w-full py-3 rounded-lg text-ui font-semibold transition-all text-white
              ${selectedProfile
                ? `${selectedProfile.bgClass} hover:opacity-90`
                : 'bg-bg-hover !text-text-disabled cursor-not-allowed'
              }
            `}
          >
            시작하기
          </button>
        </div>

        {/* 정보 */}
        <div className="mt-6 text-center text-caption text-text-tertiary">
          <p>Phase 1 MVP · 8과목 4,351 CB</p>
        </div>
      </div>
    </div>
  );
}
