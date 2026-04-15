'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  clamp,
  InputManager,
  GameLoop,
  fitCanvas,
  GAME_STATE,
} from '@/lib/gameEngine';

const PLAYER_SIZE = 40;
const BALL_RADIUS = 15;
const GRAVITY = 800;
const JUMP_FORCE = -400;
const MOVE_SPEED = 250;
const NET_HEIGHT = 100;
const NET_WIDTH = 10;
const WIN_SCORE = 5;

export default function PeanutVolleyball({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  const gameRef = useRef({
    player: null,
    ai: null,
    ball: null,
    input: null,
    loop: null,
    canvasSize: { width: 600, height: 400 },
  });

  // 게임 초기화
  const initGame = useCallback(() => {
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    // 플레이어 (왼쪽)
    game.player = {
      x: width / 4,
      y: height - PLAYER_SIZE / 2,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      vy: 0,
      onGround: true,
    };

    // AI (오른쪽)
    game.ai = {
      x: (width * 3) / 4,
      y: height - PLAYER_SIZE / 2,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      vy: 0,
      onGround: true,
    };

    // 공
    game.ball = {
      x: width / 4,
      y: height / 2,
      vx: 100,
      vy: 0,
      radius: BALL_RADIUS,
    };

    setPlayerScore(0);
    setAiScore(0);
    setGameState(GAME_STATE.PLAYING);
  }, []);

  // 공 리셋
  const resetBall = useCallback((toPlayer) => {
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    game.ball = {
      x: toPlayer ? width / 4 : (width * 3) / 4,
      y: height / 2,
      vx: toPlayer ? 100 : -100,
      vy: 0,
      radius: BALL_RADIUS,
    };
  }, []);

  // 게임 업데이트
  const update = useCallback((dt) => {
    const game = gameRef.current;
    if (!game.player || !game.ball) return;

    const { width, height } = game.canvasSize;
    const input = game.input;
    const netX = width / 2;

    // 플레이어 이동
    let dx = 0;
    if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) dx = -1;
    if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) dx = 1;

    game.player.x = clamp(
      game.player.x + dx * MOVE_SPEED * dt,
      PLAYER_SIZE / 2,
      netX - NET_WIDTH / 2 - PLAYER_SIZE / 2
    );

    // 플레이어 점프
    if ((input.isPressed('ArrowUp') || input.isPressed('KeyW') || input.isPressed('Space')) && game.player.onGround) {
      game.player.vy = JUMP_FORCE;
      game.player.onGround = false;
    }

    // 플레이어 중력
    game.player.vy += GRAVITY * dt;
    game.player.y += game.player.vy * dt;

    if (game.player.y >= height - PLAYER_SIZE / 2) {
      game.player.y = height - PLAYER_SIZE / 2;
      game.player.vy = 0;
      game.player.onGround = true;
    }

    // AI 이동 (공 따라가기)
    const aiTargetX = game.ball.x > netX ? game.ball.x : (width * 3) / 4;
    const aiDiff = aiTargetX - game.ai.x;
    const aiSpeed = MOVE_SPEED * 0.8; // AI는 약간 느리게

    if (Math.abs(aiDiff) > 10) {
      game.ai.x += Math.sign(aiDiff) * aiSpeed * dt;
    }

    game.ai.x = clamp(
      game.ai.x,
      netX + NET_WIDTH / 2 + PLAYER_SIZE / 2,
      width - PLAYER_SIZE / 2
    );

    // AI 점프 (공이 가까이 오면)
    const ballDistToAi = Math.sqrt(
      (game.ball.x - game.ai.x) ** 2 + (game.ball.y - game.ai.y) ** 2
    );
    if (game.ball.x > netX && ballDistToAi < 100 && game.ball.vy > 0 && game.ai.onGround) {
      game.ai.vy = JUMP_FORCE;
      game.ai.onGround = false;
    }

    // AI 중력
    game.ai.vy += GRAVITY * dt;
    game.ai.y += game.ai.vy * dt;

    if (game.ai.y >= height - PLAYER_SIZE / 2) {
      game.ai.y = height - PLAYER_SIZE / 2;
      game.ai.vy = 0;
      game.ai.onGround = true;
    }

    // 공 물리
    game.ball.vy += GRAVITY * dt;
    game.ball.x += game.ball.vx * dt;
    game.ball.y += game.ball.vy * dt;

    // 공 벽 충돌
    if (game.ball.x - BALL_RADIUS < 0) {
      game.ball.x = BALL_RADIUS;
      game.ball.vx = Math.abs(game.ball.vx) * 0.8;
    }
    if (game.ball.x + BALL_RADIUS > width) {
      game.ball.x = width - BALL_RADIUS;
      game.ball.vx = -Math.abs(game.ball.vx) * 0.8;
    }
    if (game.ball.y - BALL_RADIUS < 0) {
      game.ball.y = BALL_RADIUS;
      game.ball.vy = Math.abs(game.ball.vy) * 0.8;
    }

    // 네트 충돌
    if (
      game.ball.y + BALL_RADIUS > height - NET_HEIGHT &&
      game.ball.x > netX - NET_WIDTH / 2 - BALL_RADIUS &&
      game.ball.x < netX + NET_WIDTH / 2 + BALL_RADIUS
    ) {
      // 공이 네트에 부딪힘
      if (game.ball.vx > 0) {
        game.ball.x = netX - NET_WIDTH / 2 - BALL_RADIUS;
      } else {
        game.ball.x = netX + NET_WIDTH / 2 + BALL_RADIUS;
      }
      game.ball.vx = -game.ball.vx * 0.7;
    }

    // 플레이어와 공 충돌
    const playerDist = Math.sqrt(
      (game.ball.x - game.player.x) ** 2 + (game.ball.y - game.player.y) ** 2
    );
    if (playerDist < BALL_RADIUS + PLAYER_SIZE / 2) {
      // 충돌 방향 계산
      const angle = Math.atan2(game.ball.y - game.player.y, game.ball.x - game.player.x);
      const speed = Math.sqrt(game.ball.vx ** 2 + game.ball.vy ** 2);
      const newSpeed = Math.max(speed, 300);

      game.ball.vx = Math.cos(angle) * newSpeed;
      game.ball.vy = Math.sin(angle) * newSpeed - 100; // 약간 위로

      // 분리
      game.ball.x = game.player.x + Math.cos(angle) * (BALL_RADIUS + PLAYER_SIZE / 2 + 2);
      game.ball.y = game.player.y + Math.sin(angle) * (BALL_RADIUS + PLAYER_SIZE / 2 + 2);
    }

    // AI와 공 충돌
    const aiDist = Math.sqrt(
      (game.ball.x - game.ai.x) ** 2 + (game.ball.y - game.ai.y) ** 2
    );
    if (aiDist < BALL_RADIUS + PLAYER_SIZE / 2) {
      const angle = Math.atan2(game.ball.y - game.ai.y, game.ball.x - game.ai.x);
      const speed = Math.sqrt(game.ball.vx ** 2 + game.ball.vy ** 2);
      const newSpeed = Math.max(speed, 280);

      game.ball.vx = Math.cos(angle) * newSpeed;
      game.ball.vy = Math.sin(angle) * newSpeed - 100;

      game.ball.x = game.ai.x + Math.cos(angle) * (BALL_RADIUS + PLAYER_SIZE / 2 + 2);
      game.ball.y = game.ai.y + Math.sin(angle) * (BALL_RADIUS + PLAYER_SIZE / 2 + 2);
    }

    // 득점 체크
    if (game.ball.y + BALL_RADIUS > height) {
      if (game.ball.x < netX) {
        // AI 득점
        setAiScore(prev => {
          const newScore = prev + 1;
          if (newScore >= WIN_SCORE) {
            setFinalScore(0);
            setGameState(GAME_STATE.GAME_OVER);
            onScore?.(0);
            onGameOver?.(0);
          } else {
            resetBall(true);
          }
          return newScore;
        });
      } else {
        // 플레이어 득점
        setPlayerScore(prev => {
          const newScore = prev + 1;
          if (newScore >= WIN_SCORE) {
            const finalPts = 500 + (WIN_SCORE - aiScore) * 100;
            setFinalScore(finalPts);
            setGameState(GAME_STATE.WIN);
            onScore?.(finalPts);
            onGameOver?.(finalPts);
          } else {
            resetBall(false);
          }
          return newScore;
        });
      }
    }
  }, [onGameOver, onScore, resetBall, aiScore]);

  // 렌더링
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    // 배경
    ctx.fillStyle = '#87ceeb'; // 하늘색
    ctx.fillRect(0, 0, width, height);

    // 바닥
    ctx.fillStyle = '#f4a460';
    ctx.fillRect(0, height - 20, width, 20);

    // 네트
    ctx.fillStyle = '#333';
    ctx.fillRect(width / 2 - NET_WIDTH / 2, height - NET_HEIGHT, NET_WIDTH, NET_HEIGHT);

    if (!game.player || !game.ball) return;

    // 플레이어 (🐿️)
    ctx.font = `${PLAYER_SIZE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐿️', game.player.x, game.player.y);

    // AI (🦔)
    ctx.fillText('🦔', game.ai.x, game.ai.y);

    // 공 (🏐)
    ctx.font = `${BALL_RADIUS * 2}px sans-serif`;
    ctx.fillText('🏐', game.ball.x, game.ball.y);

    // 점수판
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(width / 2 - 60, 10, 120, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${playerScore} : ${aiScore}`, width / 2, 38);
  }, [playerScore, aiScore]);

  // 터치 이벤트
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouch = (e) => {
      e.preventDefault();
      const game = gameRef.current;
      if (!game.input || gameState !== GAME_STATE.PLAYING) return;

      const rect = canvas.getBoundingClientRect();
      const touches = e.touches;

      game.input.keys = {};

      // 터치 위치에 따라 좌우 이동
      if (touches.length >= 1) {
        const x = touches[0].clientX - rect.left;
        const width = rect.width;

        if (x < width / 3) game.input.keys['ArrowLeft'] = true;
        else if (x > (width * 2) / 3) game.input.keys['ArrowRight'] = true;
      }

      // 두 손가락 탭 = 점프
      if (touches.length >= 2) {
        game.input.keys['Space'] = true;
      }
    };

    const handleTouchEnd = () => {
      const game = gameRef.current;
      if (game.input) game.input.keys = {};
    };

    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState]);

  // 게임 루프 설정
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = gameRef.current;
    game.canvasSize = fitCanvas(canvas);
    game.input = new InputManager();
    game.loop = new GameLoop(update, render);

    return () => {
      game.loop?.stop();
      game.input?.reset();
    };
  }, [update, render]);

  // 게임 상태 변경 시 루프 제어
  useEffect(() => {
    const game = gameRef.current;
    if (gameState === GAME_STATE.PLAYING) {
      game.loop?.start();
    } else {
      game.loop?.stop();
    }
  }, [gameState]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        className="border-2 border-gray-700 rounded-lg"
        width={600}
        height={400}
      />

      {gameState === GAME_STATE.READY && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">🏐 땅콩배구</div>
            <div className="text-sm mb-6 text-gray-300">
              ← → 이동 | ↑ 또는 스페이스 점프<br />
              먼저 {WIN_SCORE}점 득점하면 승리!
            </div>
            <button
              onClick={initGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
            >
              게임 시작
            </button>
          </div>
        </div>
      )}

      {gameState === GAME_STATE.WIN && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">🎉 승리!</div>
            <div className="text-2xl mb-2 text-blue-400">{finalScore} 점</div>
            <div className="text-sm text-gray-300">
              {playerScore} : {aiScore}
            </div>
          </div>
        </div>
      )}

      {gameState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">😢 패배</div>
            <div className="text-2xl mb-2">{playerScore} : {aiScore}</div>
            <div className="text-sm text-gray-300">
              다음에는 이길 수 있어요!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
