'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { clamp, GAME_STATE } from '@/lib/gameEngine';

const PLAYER_RADIUS = 20;
const BALL_RADIUS = 18;       // 공 크기 1.5배 (12→18)
const GRAVITY = 700;          // 중력 감소 (더 높이 뜸)
const JUMP_FORCE = -504;      // 점프력 1.2배 (-420→-504)
const MOVE_SPEED = 364;       // 이동속도 1.3배 (280→364)
const NET_HEIGHT = 70;        // 네트 높이 감소 (90→70)
const NET_WIDTH = 8;
const COURT_MARGIN = 60;      // 코트 양쪽 마진 (80% 축소 효과)
const WIN_SCORE = 5;
const SERVE_DELAY = 1500;
const AI_SPEED_MULT = 0.55;   // AI 속도 배율 (0.75→0.55)

export default function PeanutVolleyball({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);
  const keysRef = useRef({});

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
    canvasSize: { width: 600, height: 400 },
    serveTimer: 0,
    lastScorer: 'none',
    isRunning: false,
    pScore: 0,
    aScore: 0,
  });

  // 최고 점수 로드
  useEffect(() => {
    const saved = localStorage.getItem('jb_volleyball_highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysRef.current[e.code] = true;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
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
    game.pScore = 0;
    game.aScore = 0;

    setPlayerScore(0);
    setAiScore(0);
    setServing(false);
  }, []);

  // 게임 시작
  const startGame = useCallback(() => {
    initGame();
    setGameState(GAME_STATE.PLAYING);
    setCountdown(3);
    gameRef.current.isRunning = true;

    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownInterval);
        setCountdown(0);
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [initGame]);

  // 공 리셋
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

  // 캔버스 초기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 600;
    canvas.height = 400;
    gameRef.current.canvasSize = { width: 600, height: 400 };

    const preventZoom = (e) => e.preventDefault();
    canvas.addEventListener('touchstart', preventZoom, { passive: false });
    canvas.addEventListener('touchmove', preventZoom, { passive: false });
    canvas.addEventListener('gesturestart', preventZoom);
    canvas.addEventListener('gesturechange', preventZoom);

    return () => {
      canvas.removeEventListener('touchstart', preventZoom);
      canvas.removeEventListener('touchmove', preventZoom);
      canvas.removeEventListener('gesturestart', preventZoom);
      canvas.removeEventListener('gesturechange', preventZoom);
    };
  }, []);

  // 터치 이벤트
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouch = (e) => {
      e.preventDefault();
      if (gameState !== GAME_STATE.PLAYING || countdown > 0) return;

      const rect = canvas.getBoundingClientRect();
      const touches = e.touches;

      keysRef.current = {};

      if (touches.length >= 1) {
        const x = touches[0].clientX - rect.left;
        const w = rect.width;

        if (x < w / 3) keysRef.current['ArrowLeft'] = true;
        else if (x > (w * 2) / 3) keysRef.current['ArrowRight'] = true;
      }

      if (touches.length >= 2) {
        keysRef.current['Space'] = true;
      }
    };

    const handleTouchEnd = () => {
      keysRef.current = {};
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

  // 게임 루프
  useEffect(() => {
    if (gameState !== GAME_STATE.PLAYING) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = gameRef.current;
    const { width, height } = game.canvasSize;
    const netX = width / 2;
    const groundY = height - 20;

    const gameLoop = (currentTime) => {
      if (!game.isRunning) return;

      const dt = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = currentTime;

      // === UPDATE ===
      if (countdown <= 0 && game.player && game.ball) {
        // 서브 대기
        if (serving) {
          game.serveTimer -= dt * 1000;
          if (game.serveTimer <= 0) {
            resetBall(game.lastScorer === 'ai');
          }
        } else {
          // 플레이어 이동
          let dx = 0;
          if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) dx = -1;
          if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) dx = 1;

          game.player.x = clamp(
            game.player.x + dx * MOVE_SPEED * dt,
            COURT_MARGIN + PLAYER_RADIUS,
            netX - NET_WIDTH / 2 - PLAYER_RADIUS
          );

          // 플레이어 점프
          if ((keysRef.current['ArrowUp'] || keysRef.current['KeyW'] || keysRef.current['Space']) && game.player.onGround) {
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

          // AI 이동 (느린 반응)
          const aiTargetX = game.ball.x > netX ? game.ball.x : (width * 3) / 4;
          const aiDiff = aiTargetX - game.ai.x;
          const aiSpeed = MOVE_SPEED * AI_SPEED_MULT;

          if (Math.abs(aiDiff) > 25) { // 반응 데드존 증가 (15→25)
            game.ai.x += Math.sign(aiDiff) * aiSpeed * dt;
          }

          game.ai.x = clamp(
            game.ai.x,
            netX + NET_WIDTH / 2 + PLAYER_RADIUS,
            width - COURT_MARGIN - PLAYER_RADIUS
          );

          // AI 점프 (더 늦게 반응)
          const ballDistToAi = Math.sqrt(
            (game.ball.x - game.ai.x) ** 2 + (game.ball.y - game.ai.y) ** 2
          );
          // 거리 70 이하로 줄이고, 공이 더 빠르게 내려올 때만 점프
          if (game.ball.x > netX && ballDistToAi < 70 && game.ball.vy > 100 && game.ai.onGround) {
            game.ai.vy = JUMP_FORCE * 0.85; // AI 점프력 약화
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

          // 공 벽 충돌 (코트 마진 적용, 바운스 계수 증가)
          if (game.ball.x - BALL_RADIUS < COURT_MARGIN) {
            game.ball.x = COURT_MARGIN + BALL_RADIUS;
            game.ball.vx = Math.abs(game.ball.vx) * 0.9;
          }
          if (game.ball.x + BALL_RADIUS > width - COURT_MARGIN) {
            game.ball.x = width - COURT_MARGIN - BALL_RADIUS;
            game.ball.vx = -Math.abs(game.ball.vx) * 0.9;
          }
          if (game.ball.y - BALL_RADIUS < 0) {
            game.ball.y = BALL_RADIUS;
            game.ball.vy = Math.abs(game.ball.vy) * 0.9;
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

          // 득점 체크 (코트 마진 내에서만)
          if (game.ball.y + BALL_RADIUS > groundY &&
              game.ball.x > COURT_MARGIN &&
              game.ball.x < width - COURT_MARGIN) {
            if (game.ball.x < netX) {
              // AI 득점
              game.lastScorer = 'ai';
              game.aScore++;
              setAiScore(game.aScore);

              if (game.aScore >= WIN_SCORE) {
                setFinalScore(0);
                setGameState(GAME_STATE.GAME_OVER);
                game.isRunning = false;
                onScore?.(0);
                onGameOver?.(0);
              } else {
                setServing(true);
                game.serveTimer = SERVE_DELAY;
              }
            } else {
              // 플레이어 득점
              game.lastScorer = 'player';
              game.pScore++;
              setPlayerScore(game.pScore);

              if (game.pScore >= WIN_SCORE) {
                const finalPts = 500 + (WIN_SCORE - game.aScore) * 100;
                setFinalScore(finalPts);

                if (finalPts > highScore) {
                  setHighScore(finalPts);
                  localStorage.setItem('jb_volleyball_highscore', String(finalPts));
                }

                setGameState(GAME_STATE.WIN);
                game.isRunning = false;
                onScore?.(finalPts);
                onGameOver?.(finalPts);
              } else {
                setServing(true);
                game.serveTimer = SERVE_DELAY;
              }
            }
          }
        }
      }

      // === RENDER ===
      // 하늘
      ctx.fillStyle = '#87ceeb';
      ctx.fillRect(0, 0, width, height);

      // 코트 경계 (아웃 영역)
      ctx.fillStyle = '#5a9bd4';
      ctx.fillRect(0, 0, COURT_MARGIN, height);
      ctx.fillRect(width - COURT_MARGIN, 0, COURT_MARGIN, height);

      // 바닥
      ctx.fillStyle = '#f4a460';
      ctx.fillRect(COURT_MARGIN, groundY, width - COURT_MARGIN * 2, 20);
      ctx.fillStyle = '#c49660'; // 아웃 영역 바닥
      ctx.fillRect(0, groundY, COURT_MARGIN, 20);
      ctx.fillRect(width - COURT_MARGIN, groundY, COURT_MARGIN, 20);

      // 코트 라인
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(COURT_MARGIN, 0);
      ctx.lineTo(COURT_MARGIN, groundY);
      ctx.moveTo(width - COURT_MARGIN, 0);
      ctx.lineTo(width - COURT_MARGIN, groundY);
      ctx.stroke();

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
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (!game.player || !game.ball) {
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // 플레이어 (파란색)
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.ellipse(game.player.x, game.player.y + 5, PLAYER_RADIUS * 0.8, PLAYER_RADIUS, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(game.player.x, game.player.y - PLAYER_RADIUS * 0.6, PLAYER_RADIUS * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(game.player.x + 5, game.player.y - PLAYER_RADIUS * 0.7, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(game.player.x + 6, game.player.y - PLAYER_RADIUS * 0.7, 2, 0, Math.PI * 2);
      ctx.fill();

      // AI (빨간색)
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.ellipse(game.ai.x, game.ai.y + 5, PLAYER_RADIUS * 0.8, PLAYER_RADIUS, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(game.ai.x, game.ai.y - PLAYER_RADIUS * 0.6, PLAYER_RADIUS * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(game.ai.x - 5, game.ai.y - PLAYER_RADIUS * 0.7, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(game.ai.x - 6, game.ai.y - PLAYER_RADIUS * 0.7, 2, 0, Math.PI * 2);
      ctx.fill();

      // 공
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(game.ball.x, game.ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(game.ball.x, game.ball.y, BALL_RADIUS, 0, Math.PI, false);
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
      ctx.fillText(`${game.pScore}  :  ${game.aScore}`, width / 2, 48);

      // 서브 대기
      if (serving) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(width / 2 - 60, height / 2 - 15, 120, 30);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.fillText('다음 서브...', width / 2, height / 2 + 5);
      }

      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`최고: ${highScore}`, width - 10, 20);

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, countdown, serving, highScore, resetBall, onScore, onGameOver]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        className="border-2 border-gray-700 rounded-lg touch-none"
        style={{ width: '100%', maxWidth: 600, height: 'auto', aspectRatio: '3/2' }}
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
            <button onClick={startGame} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold">
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
            <div className="text-sm text-gray-300">다음에는 이길 수 있어요!</div>
          </div>
        </div>
      )}
    </div>
  );
}
