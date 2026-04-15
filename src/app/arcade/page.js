'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useProfile } from '@/hooks/useProfile';

// 게임 컴포넌트 동적 로드 (SSR 비활성화)
const TankBattle = dynamic(() => import('@/components/games/TankBattle'), { ssr: false });
const DodgeGame = dynamic(() => import('@/components/games/DodgeGame'), { ssr: false });
const PeanutVolleyball = dynamic(() => import('@/components/games/PeanutVolleyball'), { ssr: false });

const GAMES = [
  {
    id: 'tank',
    name: '탱크 배틀',
    emoji: '🎯',
    description: '적 탱크 5대를 격파하세요!',
    color: 'from-green-500 to-green-700',
    Component: TankBattle,
  },
  {
    id: 'dodge',
    name: '똥피하기',
    emoji: '💩',
    description: '떨어지는 장애물을 피하고 별을 모으세요!',
    color: 'from-yellow-500 to-yellow-700',
    Component: DodgeGame,
  },
  {
    id: 'volleyball',
    name: '땅콩배구',
    emoji: '🏐',
    description: 'AI와 배구 대결! 먼저 5점 득점하면 승리!',
    color: 'from-blue-500 to-blue-700',
    Component: PeanutVolleyball,
  },
];

export default function ArcadePage() {
  const router = useRouter();
  const { studentId, isLoading: profileLoading } = useProfile();
  const [tokens, setTokens] = useState(0);
  const [highScores, setHighScores] = useState({});
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [loading, setLoading] = useState(true);

  // 아케이드 데이터 로드
  useEffect(() => {
    if (profileLoading || !studentId) return;

    const loadArcadeData = async () => {
      try {
        const res = await fetch(`/api/arcade?student_id=${studentId}`);
        const data = await res.json();

        // localStorage 토큰과 병합 (더 큰 값 사용)
        const storageKey = `jb_game_tokens_${studentId}`;
        const localTokens = parseInt(localStorage.getItem(storageKey) || '0');
        const serverTokens = data.tokens || 0;
        const mergedTokens = Math.max(localTokens, serverTokens);

        setTokens(mergedTokens);
        setHighScores(data.highScores || {});

        // localStorage 동기화
        localStorage.setItem(storageKey, String(mergedTokens));
      } catch (error) {
        console.error('Failed to load arcade data:', error);
        // 데모 모드 - localStorage에서 토큰 읽기
        const storageKey = `jb_game_tokens_${studentId}`;
        const localTokens = parseInt(localStorage.getItem(storageKey) || '0');
        setTokens(localTokens > 0 ? localTokens : 3);
        setHighScores({});
      } finally {
        setLoading(false);
      }
    };

    loadArcadeData();
  }, [profileLoading, studentId]);

  // 게임 시작
  const startGame = async (game) => {
    if (tokens < 1) return;

    const storageKey = `jb_game_tokens_${studentId}`;

    try {
      // 토큰 차감
      const res = await fetch('/api/arcade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'play',
          student_id: studentId,
          game_type: game.id,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const newTokens = data.tokens;
        setTokens(newTokens);
        localStorage.setItem(storageKey, String(newTokens));
        setSelectedGame(game);
        setGameEnded(false);
        setLastScore(0);
        setIsNewHighScore(false);
      } else {
        // API 실패 시 로컬에서 차감
        const newTokens = tokens - 1;
        setTokens(newTokens);
        localStorage.setItem(storageKey, String(newTokens));
        setSelectedGame(game);
        setGameEnded(false);
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      // 오프라인에서도 플레이 가능 - localStorage 동기화
      const newTokens = tokens - 1;
      setTokens(newTokens);
      localStorage.setItem(storageKey, String(newTokens));
      setSelectedGame(game);
      setGameEnded(false);
    }
  };

  // 게임 종료 처리
  const handleGameOver = useCallback(async (score) => {
    setLastScore(score);
    setGameEnded(true);

    // 최고 점수 갱신 확인
    const currentHigh = highScores[selectedGame?.id] || 0;
    const isNew = score > currentHigh;
    setIsNewHighScore(isNew);

    if (isNew) {
      setHighScores(prev => ({ ...prev, [selectedGame.id]: score }));
    }

    // 서버에 점수 저장
    try {
      await fetch('/api/arcade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'score',
          student_id: studentId,
          game_type: selectedGame?.id,
          score,
        }),
      });
    } catch (error) {
      console.error('Failed to save score:', error);
    }
  }, [highScores, selectedGame, studentId]);

  // 게임 화면으로 돌아가기
  const exitGame = () => {
    setSelectedGame(null);
    setGameEnded(false);
  };

  // 다시 하기 (토큰 있을 때만)
  const playAgain = () => {
    if (tokens >= 1 && selectedGame) {
      startGame(selectedGame);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">로딩 중...</div>
      </div>
    );
  }

  // 게임 플레이 화면
  if (selectedGame) {
    const GameComponent = selectedGame.Component;

    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* 게임 헤더 */}
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={exitGame}
            className="text-white hover:text-gray-300 flex items-center gap-2"
          >
            ← 나가기
          </button>
          <div className="text-white font-bold text-lg">
            {selectedGame.emoji} {selectedGame.name}
          </div>
          <div className="text-yellow-400">
            🎮 {tokens}
          </div>
        </div>

        {/* 게임 영역 */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="relative">
            <GameComponent
              onGameOver={handleGameOver}
              onScore={(score) => setLastScore(score)}
            />

            {/* 게임 종료 오버레이 */}
            {gameEnded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg z-10">
                <div className="text-center text-white p-8">
                  <div className="text-5xl mb-4">
                    {lastScore > 0 ? '🎮' : '😢'}
                  </div>

                  <div className="text-3xl font-bold mb-2">
                    {lastScore} 점
                  </div>

                  {isNewHighScore && (
                    <div className="text-yellow-400 text-lg mb-4">
                      🏆 새로운 최고 기록!
                    </div>
                  )}

                  <div className="space-y-3 mt-6">
                    {tokens >= 1 ? (
                      <button
                        onClick={playAgain}
                        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold"
                      >
                        한 번 더! (🎮 {tokens})
                      </button>
                    ) : (
                      <div className="text-gray-400 text-sm mb-4">
                        토큰이 없습니다. 학습을 완료하면 토큰을 받을 수 있어요!
                      </div>
                    )}

                    <button
                      onClick={exitGame}
                      className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-bold"
                    >
                      게임 선택으로
                    </button>

                    <button
                      onClick={() => router.push('/')}
                      className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
                    >
                      학습으로 돌아가기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 게임 선택 화면
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      {/* 헤더 */}
      <div className="p-4 flex items-center justify-between border-b border-gray-700">
        <button
          onClick={() => router.push('/')}
          className="text-white hover:text-gray-300"
        >
          ← 대시보드
        </button>
        <h1 className="text-2xl font-bold text-white">🎮 아케이드</h1>
        <div className="text-yellow-400 font-bold text-lg">
          🎮 {tokens}
        </div>
      </div>

      {/* 토큰 안내 */}
      <div className="max-w-2xl mx-auto p-6">
        {tokens === 0 && (
          <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4 mb-6 text-center">
            <div className="text-yellow-400 text-lg mb-2">토큰이 없습니다!</div>
            <div className="text-yellow-200 text-sm">
              학습 미션을 완료하면 게임 토큰을 받을 수 있어요
            </div>
            <div className="mt-4 text-xs text-yellow-300 space-y-1">
              <div>• 단어 퀴즈 80%+ 통과 → 🎮 1개</div>
              <div>• 개념 3개 마스터 → 🎮 1개</div>
              <div>• 모의고사 완료 → 🎮 2개</div>
              <div>• 7일 연속 학습 → 🎮 3개</div>
            </div>
          </div>
        )}

        {/* 게임 카드 */}
        <div className="grid gap-6">
          {GAMES.map(game => {
            const highScore = highScores[game.id] || 0;
            const canPlay = tokens >= 1;

            return (
              <div
                key={game.id}
                className={`relative overflow-hidden rounded-xl ${
                  canPlay ? 'cursor-pointer transform hover:scale-[1.02] transition-transform' : 'opacity-60'
                }`}
                onClick={() => canPlay && startGame(game)}
              >
                <div className={`bg-gradient-to-r ${game.color} p-6`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-4xl mb-2">{game.emoji}</div>
                      <div className="text-2xl font-bold text-white mb-1">{game.name}</div>
                      <div className="text-white/80 text-sm">{game.description}</div>
                    </div>

                    <div className="text-right">
                      {highScore > 0 && (
                        <div className="text-white/90 text-sm mb-2">
                          최고: {highScore}점
                        </div>
                      )}
                      {canPlay ? (
                        <div className="bg-white/20 px-4 py-2 rounded-lg text-white font-bold">
                          🎮 1개로 플레이
                        </div>
                      ) : (
                        <div className="bg-black/30 px-4 py-2 rounded-lg text-white/60">
                          토큰 필요
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 토큰 획득 방법 */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-white font-bold text-lg mb-4">🎮 토큰 획득 방법</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3 text-gray-300">
              <span className="text-2xl">📝</span>
              <div>
                <div className="font-medium">단어 퀴즈 통과</div>
                <div className="text-gray-500">80% 이상 정답</div>
              </div>
              <div className="ml-auto text-yellow-400">+1</div>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="font-medium">개념 마스터</div>
                <div className="text-gray-500">3개 달성</div>
              </div>
              <div className="ml-auto text-yellow-400">+1</div>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <span className="text-2xl">📋</span>
              <div>
                <div className="font-medium">모의고사 완료</div>
                <div className="text-gray-500">1세트</div>
              </div>
              <div className="ml-auto text-yellow-400">+2</div>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <span className="text-2xl">🔥</span>
              <div>
                <div className="font-medium">7일 스트릭</div>
                <div className="text-gray-500">연속 학습</div>
              </div>
              <div className="ml-auto text-yellow-400">+3</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
