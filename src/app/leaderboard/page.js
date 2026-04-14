'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useProfile } from '@/hooks/useProfile';
import { calculateLevel } from '@/lib/gamification';

export default function LeaderboardPage() {
  const { studentId } = useProfile();
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState('total'); // 'total' | 'weekly'
  const [myRank, setMyRank] = useState(null);

  // 리더보드 로드
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('/api/gamification?leaderboard=true');
        const data = await res.json();

        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);

          // 내 순위 찾기
          const myIndex = data.leaderboard.findIndex(p => p.studentId === studentId);
          if (myIndex >= 0) {
            setMyRank(myIndex + 1);
          }
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [studentId]);

  // Top 10만 표시
  const topPlayers = leaderboard.slice(0, 10);

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-text-tertiary hover:text-text-primary">
              ←
            </Link>
            <h1 className="text-heading text-text-primary">리더보드</h1>
          </div>

          {/* 탭 전환 */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab('total')}
              className={`px-4 py-2 rounded-lg text-ui transition-colors ${
                tab === 'total'
                  ? 'bg-warning text-white'
                  : 'bg-bg-hover text-text-secondary hover:bg-bg-selected'
              }`}
            >
              전체 XP
            </button>
            <button
              onClick={() => setTab('weekly')}
              className={`px-4 py-2 rounded-lg text-ui transition-colors ${
                tab === 'weekly'
                  ? 'bg-warning text-white'
                  : 'bg-bg-hover text-text-secondary hover:bg-bg-selected'
              }`}
            >
              이번 주
            </button>
          </div>
        </div>

        {/* 내 순위 카드 */}
        {myRank && (
          <div className="card p-4 mb-6 border-warning/30 bg-warning-light">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rank-badge rank-badge-1 w-10 h-10 text-lg">
                  {myRank}
                </div>
                <div>
                  <p className="text-subheading text-text-primary">내 순위</p>
                  <p className="text-caption text-text-tertiary">
                    {leaderboard.find(p => p.studentId === studentId)?.nickname || studentId}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-stat text-warning text-xl">
                  {leaderboard.find(p => p.studentId === studentId)?.totalXp?.toLocaleString() || 0}
                </p>
                <p className="text-caption text-text-tertiary">XP</p>
              </div>
            </div>
          </div>
        )}

        {/* 리더보드 목록 */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-text-tertiary">
              로딩 중...
            </div>
          ) : topPlayers.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary">
              아직 참가자가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {topPlayers.map((player, index) => {
                const rank = index + 1;
                const level = calculateLevel(player.totalXp);
                const isMe = player.studentId === studentId;

                return (
                  <div
                    key={player.studentId}
                    className={`flex items-center gap-4 p-4 transition-colors ${
                      isMe ? 'bg-warning-light' : 'hover:bg-bg-hover'
                    }`}
                  >
                    {/* 순위 */}
                    <div className="w-10 flex-shrink-0">
                      {rank <= 3 ? (
                        <div className={`rank-badge rank-badge-${rank}`}>
                          {rank === 1 ? '' : rank === 2 ? '' : ''}
                        </div>
                      ) : (
                        <span className="text-ui text-text-tertiary text-center block">
                          {rank}
                        </span>
                      )}
                    </div>

                    {/* 레벨 뱃지 */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)' }}
                    >
                      {level.level}
                    </div>

                    {/* 닉네임 & 레벨 */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-ui truncate ${isMe ? 'text-warning font-medium' : 'text-text-primary'}`}>
                        {player.nickname}
                        {isMe && <span className="text-caption ml-2">(나)</span>}
                      </p>
                      <p className="text-caption text-text-tertiary">
                        {level.titleKo} · Lv.{level.level}
                      </p>
                    </div>

                    {/* XP */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-subheading text-warning font-mono">
                        {player.totalXp.toLocaleString()}
                      </p>
                      <p className="text-caption text-text-disabled">XP</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 프라이버시 안내 */}
        <p className="text-caption text-text-tertiary mt-4 text-center">
          닉네임만 공개되며, 실명은 관리자만 확인할 수 있습니다.
        </p>
      </div>
    </DashboardLayout>
  );
}
