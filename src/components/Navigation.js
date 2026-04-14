'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';

const navLinks = [
  { href: '/', label: '대시보드' },
  { href: '/skillmap', label: '스킬맵' },
  { href: '/words', label: '단어' },
  { href: '/practice-tests', label: '실전' },
  { href: '/calendar', label: '과제' },
  { href: '/timer', label: '순공' },
  { href: '/leaderboard', label: '랭킹' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { profile, isAdmin, logout } = useProfile();
  const [showMenu, setShowMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = async () => {
    try {
      await fetch('/api/sheets?tab=reset_progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student: 'all' }),
      });
      setShowResetConfirm(false);
      window.location.reload();
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  return (
    <nav className="h-14 bg-bg-card border-b border-border-subtle sticky top-0 z-50">
      <div className="max-w-container mx-auto h-full px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold text-text-primary">
            JubileeBridge
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  px-4 py-2 text-ui rounded-md transition-colors relative
                  ${isActive
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }
                `}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-subj-math rounded-full" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Settings & User Avatar */}
        <div className="relative flex items-center gap-3">
          {/* Settings Link */}
          <Link
            href="/settings"
            className={`
              p-2 rounded-md transition-colors
              ${pathname === '/settings'
                ? 'text-text-primary bg-bg-hover'
                : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
              }
            `}
            title="설정"
          >
            ⚙️
          </Link>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`
              w-8 h-8 rounded-full flex items-center justify-center text-caption font-medium text-white
              ${profile?.bgClass || (isAdmin ? 'bg-neutral-700' : 'bg-blue-500')}
            `}
          >
            {profile?.id || '?'}
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 w-48 bg-bg-card border border-border-subtle rounded-lg shadow-elevated z-50 py-2">
                <div className="px-4 py-2 border-b border-border-subtle">
                  <div className="text-ui font-medium text-text-primary">{profile?.name}</div>
                  <div className="text-caption text-text-tertiary">
                    {isAdmin ? '관리자' : `학생 · ${profile?.grade}학년`}
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowResetConfirm(true);
                    }}
                    className="w-full px-4 py-2 text-left text-ui text-danger hover:bg-bg-hover"
                  >
                    전체 리셋
                  </button>
                )}

                <button
                  onClick={logout}
                  className="w-full px-4 py-2 text-left text-ui text-text-secondary hover:bg-bg-hover"
                >
                  프로필 변경
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowResetConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-card rounded-lg shadow-elevated z-50 p-6 w-full max-w-sm">
            <h3 className="text-heading text-text-primary mb-2">전체 리셋</h3>
            <p className="text-body text-text-secondary mb-4">
              모든 학생의 학습 진행 상태가 초기화됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                className="flex-1 btn bg-danger text-white hover:bg-danger/90"
              >
                리셋
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
