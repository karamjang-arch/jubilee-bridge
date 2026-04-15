'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  clamp,
  InputManager,
  GameLoop,
  fitCanvas,
  GAME_STATE,
} from '@/lib/gameEngine';

const PLAYER_RADIUS = 20;
const BALL_RADIUS = 12;
const GRAVITY = 800;
const JUMP_FORCE = -420;
const MOVE_SPEED = 280;
const NET_HEIGHT = 90;
const NET_WIDTH = 8;
const WIN_SCORE = 5;
const SERVE_DELAY = 1500; // 1.5초 대기 후 자동 서브

export default function PeanutVolleyball({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [countdown, setCountdown] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [serving, setServing] = useState(false);

  const gameRef = useRef({
    player: null,
    ai: null,
    ball: null,
    input: null,
    loop: null,
    canvasSize: { width: 600, height: 400 },
    serveTimer: 0,
    lastScorer: 'none',
  });

  // 최고 점수 로드
  useEffect(() => {
    const saved = localStorage.getItem('jb_volleyball_highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  // 게임 초기화
  const initGame = useCallback(() => {
    const game = gameRef.current;
    const { width, height } = game.canvasSize;
    const groundY = height - 20;

    game.player = {
      x: width / 4,
      y: groundY - PLAYER_RADIUS,
      vy: 0,
      onGround: true,
    };

    game.ai = {
      x: (width * 3) / 4,
      y: groundY - PLAYER_RADIUS,
      vy: 0,
      onGround: true,
    };

    game.ball = {
      x: width / 4,
      y: height / 2,
      vx: 80,
      vy: 0,
    };

    game.serveTimer = 0;
    game.lastScorer = 'none';

    setPlayerScore(0);
    setAiScore(0);
    setServing(false);
  }, []);

  // 게임 시작 (카운트다운)
  const startGame = useCallback(() => {
    initGame();
    setGameState(GAME_STATE.PLAYING);
    setCountdown(3);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [initGame]);

  // 공 리셋 (득점 후)
  const resetBall = useCallback((toPlayer) => {
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    game.ball = {
      x: toPlayer ? width / 4 : (width * 3) / 4,
      y: height / 2,
      vx: toPlayer ? 80 : -80,
      vy: 0,
    };

    game.serveTimer = 0;
    setServing(false);
  }, []);

  // 득점 처리
  const handleScore = useCallback((scorer) => {
    const game = gameRef.current;
    game.lastScorer = scorer;

    if (scorer === 'player') {
      setPlayerScore(prev => {
        const newScore = prev + 1;
        if (newScore >= WIN_SCORE) {
          const finalPts = 500 + (WIN_SCORE - aiScore) * 100;
          setFinalScore(finalPts);

          if (finalPts > highScore) {
            setHighScore(finalPts);
            localStorage.setItem('jb_volleyball_highscore', String(finalPts));
          }

          setGameState(GAME_STATE.WIN);
          onScore?.(finalPts);
          onGameOver?.(finalPts);
        } else {
          setServing(true);
          game.serveTimer = SERVE_DELAY;
        }
        return newScore;
      });
    } else {
      setAiScore(prev => {
        const newScore = prev + 1;
        if (newScore >= WIN_SCORE) {
          setFinalScore(0);
          setGameState(GAME_STATE.GAME_OVER);
          onScore?.(0);
          onGameOver?.(0);
        } else {
          setServing(true);
          game.serveTimer = SERVE_DELAY;
        }
        return newScore;
      });
    }
  }, [aiScore, highScore, onScore, onGameOver]);

  // 게임 업데이트
  const update = useCallback((dt) => {
    const game = gameRef.current;
    if (!game.player || !game.ball || countdown > 0) return;

    const { width, height } = game.canvasSize;
    const input = game.input;
    const netX = width / 2;
    const groundY = height - 20;

    // 서브 대기 중
    if (serving) {
      game.serveTimer -= dt * 1000;
      if (game.serveTimer <= 0) {
        resetBall(game.lastScorer === 'ai');
      }
      return;
    }

    // 플레이어 이동
    let dx = 0;
    if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) dx = -1;
    if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) dx = 1;

    game.player.x = clamp(
      game.player.x + dx * MOVE_SPEED * dt,
      PLAYER_RADIUS,
      netX - NET_WIDTH / 2 - PLAYER_RADIUS
    );

    // 플레이어 점프
    if ((input.isPressed('ArrowUp') || input.isPressed('KeyW') || input.isPressed('Space')) && game.player.onGround) {
      game.player.vy = JUMP_FORCE;
      game.player.onGround = false;
    }

    // 플레이어 중력
    game.player.vy += GRAVITY * dt;
    game.player.y += game.player.vy * dt;

    if (game.player.y >= groundY - PLAYER_RADIUS) {
      game.player.y = groundY - PLAYER_RADIUS;
      game.player.vy = 0;
      game.player.onGround = true;
    }

    // AI 이동 (공 따라가기)
    const aiTargetX = game.ball.x > netX ? game.ball.x : (width * 3) / 4;
    const aiDiff = aiTargetX - game.ai.x;
    const aiSpeed = MOVE_SPEED * 0.75;

    if (Math.abs(aiDiff) > 15) {
      game.ai.x += Math.sign(aiDiff) * aiSpeed * dt;
    }

    game.ai.x = clamp(
      game.ai.x,
      netX + NET_WIDTH / 2 + PLAYER_RADIUS,
      width - PLAYER_RADIUS
    );

    // AI 점프
    const ballDistToAi = Math.sqrt(
      (game.ball.x - game.ai.x) ** 2 + (game.ball.y - game.ai.y) ** 2
    );
    if (game.ball.x > netX && ballDistToAi < 90 && game.ball.vy > 0 && game.ai.onGround) {
      game.ai.vy = JUMP_FORCE;
      game.ai.onGround = false;
    }

    // AI 중력
    game.ai.vy += GRAVITY * dt;
    game.ai.y += game.ai.vy * dt;

    if (game.ai.y >= groundY - PLAYER_RADIUS) {
      game.ai.y = groundY - PLAYER_RADIUS;
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
      game.ball.y + BALL_RADIUS > groundY - NET_HEIGHT &&
      game.ball.x > netX - NET_WIDTH / 2 - BALL_RADIUS &&
      game.ball.x < netX + NET_WIDTH / 2 + BALL_RADIUS
    ) {
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
    if (playerDist < BALL_RADIUS + PLAYER_RADIUS) {
      const angle = Math.atan2(game.ball.y - game.player.y, game.ball.x - game.player.x);
      const speed = Math.sqrt(game.ball.vx ** 2 + game.ball.vy ** 2);
      const newSpeed = Math.max(speed, 320);

      game.ball.vx = Math.cos(angle) * newSpeed;
      game.ball.vy = Math.sin(angle) * newSpeed - 120;

      game.ball.x = game.player.x + Math.cos(angle) * (BALL_RADIUS + PLAYER_RADIUS + 2);
      game.ball.y = game.player.y + Math.sin(angle) * (BALL_RADIUS + PLAYER_RADIUS + 2);
    }

    // AI와 공 충돌
    const aiDist = Math.sqrt(
      (game.ball.x - game.ai.x) ** 2 + (game.ball.y - game.ai.y) ** 2
    );
    if (aiDist < BALL_RADIUS + PLAYER_RADIUS) {
      const angle = Math.atan2(game.ball.y - game.ai.y, game.ball.x - game.ai.x);
      const speed = Math.sqrt(game.ball.vx ** 2 + game.ball.vy ** 2);
      const newSpeed = Math.max(speed, 300);

      game.ball.vx = Math.cos(angle) * newSpeed;
      game.ball.vy = Math.sin(angle) * newSpeed - 120;

      game.ball.x = game.ai.x + Math.cos(angle) * (BALL_RADIUS + PLAYER_RADIUS + 2);
      game.ball.y = game.ai.y + Math.sin(angle) * (BALL_RADIUS + PLAYER_RADIUS + 2);
    }

    // 득점 체크
    if (game.ball.y + BALL_RADIUS > groundY) {
      if (game.ball.x < netX) {
        handleScore('ai');
      } else {
        handleScore('player');
      }
    }
  }, [countdown, serving, resetBall, handleScore]);

  // 렌더링
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    const { width, height } = game.canvasSize;
    const groundY = height - 20;
    const netX = width / 2;

    // 배경 (하늘)
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, width, height);

    // 바닥 (모래)
    ctx.fillStyle = '#f4a460';
    ctx.fillRect(0, groundY, width, 20);

    // 네트
    ctx.fillStyle = '#333';
    ctx.fillRect(netX - NET_WIDTH / 2, groundY - NET_HEIGHT, NET_WIDTH, NET_HEIGHT);

    // 카운트다운
    if (countdown > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(countdown === 1 ? 'GO!' : countdown.toString(), width / 2, height / 2);
      return;
    }

    if (!game.player || !game.ball) return;

    // 플레이어 (파란색 2등신 캐릭터)
    // 몸통
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.ellipse(game.player.x, game.player.y + 5, PLAYER_RADIUS * 0.8, PLAYER_RADIUS, 0, 0, Math.PI * 2);
    ctx.fill();
    // 머리
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y - PLAYER_RADIUS * 0.6, PLAYER_RADIUS * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // 눈 (네트 방향을 바라봄)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(game.player.x + 5, game.player.y - PLAYER_RADIUS * 0.7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(game.player.x + 6, game.player.y - PLAYER_RADIUS * 0.7, 2, 0, Math.PI * 2);
    ctx.fill();

    // AI (빨간색 2등신 캐릭터)
    // 몸통
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.ellipse(game.ai.x, game.ai.y + 5, PLAYER_RADIUS * 0.8, PLAYER_RADIUS, 0, 0, Math.PI * 2);
    ctx.fill();
    // 머리
    ctx.beginPath();
    ctx.arc(game.ai.x, game.ai.y - PLAYER_RADIUS * 0.6, PLAYER_RADIUS * 0.7, 0, Math.PI * 2);
    ctx.fill();
    // 눈 (네트 방향을 바라봄 - 미러)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(game.ai.x - 5, game.ai.y - PLAYER_RADIUS * 0.7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(game.ai.x - 6, game.ai.y - PLAYER_RADIUS * 0.7, 2, 0, Math.PI * 2);
    ctx.fill();

    // 공 (배구공 스타일)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 공 무늬
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, BALL_RADIUS, 0, Math.PI, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(game.ball.x - BALL_RADIUS, game.ball.y);
    ctx.quadraticCurveTo(game.ball.x, game.ball.y - BALL_RADIUS * 0.5, game.ball.x + BALL_RADIUS, game.ball.y);
    ctx.stroke();

    // 점수판
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(width / 2 - 80, 8, 160, 45);

    ctx.fillStyle = '#3498db';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Player', width / 2 - 40, 25);

    ctx.fillStyle = '#e74c3c';
    ctx.fillText('AI', width / 2 + 40, 25);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${playerScore}  :  ${aiScore}`, width / 2, 48);

    // 서브 대기 메시지
    if (serving) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(width / 2 - 60, height / 2 - 15, 120, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText('다음 서브...', width / 2, height / 2 + 5);
    }

    // 최고 기록
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`최고: ${highScore}`, width - 10, 20);
  }, [countdown, playerScore, aiScore, serving, highScore]);

  // 터치 이벤트
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouch = (e) => {
      e.preventDefault();
      const game = gameRef.current;
      if (!game.input || gameState !== GAME_STATE.PLAYING || countdown > 0) return;

      const rect = canvas.getBoundingClientRect();
      const touches = e.touches;

      game.input.keys = {};

      if (touches.length >= 1) {
        const x = touches[0].clientX - rect.left;
        const w = rect.width;

        if (x < w / 3) game.input.keys['ArrowLeft'] = true;
        else if (x > (w * 2) / 3) game.input.keys['ArrowRight'] = true;
      }

      // 두 손가락 = 점프
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
  }, [gameState, countdown]);

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
            <div className="text-4xl mb-4">🏐 배구</div>
            <div className="text-sm mb-6 text-gray-300">
              ← → 이동 | ↑ 또는 스페이스 점프<br />
              (모바일: 좌우 터치 이동, 두 손가락 점프)<br />
              먼저 {WIN_SCORE}점 득점하면 승리!
            </div>
            <button
              onClick={startGame}
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
            {finalScore >= highScore && finalScore > 0 && (
              <div className="text-green-400 text-lg mb-2">🏆 새 기록!</div>
            )}
            <div className="text-sm text-gray-300">
              Player {playerScore} : {aiScore} AI
            </div>
          </div>
        </div>
      )}

      {gameState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">😢 패배</div>
            <div className="text-2xl mb-2">Player {playerScore} : {aiScore} AI</div>
            <div className="text-sm text-gray-300">
              다음에는 이길 수 있어요!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
