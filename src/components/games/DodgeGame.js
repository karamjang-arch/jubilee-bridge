'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  checkCollision,
  random,
  clamp,
  InputManager,
  GameLoop,
  fitCanvas,
  GAME_STATE,
} from '@/lib/gameEngine';

const PLAYER_SIZE = 32;
const PLAYER_SPEED = 280;
const OBSTACLE_SIZE = 28;
const STAR_SIZE = 24;
const HEART_SIZE = 24;
const INITIAL_SPAWN_RATE = 1.2;
const MAX_SPAWN_RATE = 4;
const MAX_LIVES = 3;
const INVINCIBLE_TIME = 1.5;

export default function DodgeGame({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [countdown, setCountdown] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [stars, setStars] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const gameRef = useRef({
    player: null,
    obstacles: [],
    starItems: [],
    heartItems: [],
    input: null,
    loop: null,
    spawnTimer: 0,
    starSpawnTimer: 0,
    heartSpawnTimer: 0,
    gameTime: 0,
    invincibleTimer: 0,
    canvasSize: { width: 600, height: 400 },
  });

  // 최고 점수 로드
  useEffect(() => {
    const saved = localStorage.getItem('jb_dodge_highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  // 게임 초기화
  const initGame = useCallback(() => {
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    game.player = {
      x: width / 2,
      y: height - 50,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
    };

    game.obstacles = [];
    game.starItems = [];
    game.heartItems = [];
    game.spawnTimer = 0;
    game.starSpawnTimer = 2;
    game.heartSpawnTimer = random(15, 25);
    game.gameTime = 0;
    game.invincibleTimer = 0;

    setScore(0);
    setLives(MAX_LIVES);
    setStars(0);
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

  // 피격 처리
  const handleHit = useCallback(() => {
    const game = gameRef.current;
    if (game.invincibleTimer > 0) return false;

    game.invincibleTimer = INVINCIBLE_TIME;
    setLives(prev => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        const finalScore = Math.floor(game.gameTime * 10) + stars * 50;
        setScore(finalScore);

        // 최고 점수 업데이트
        if (finalScore > highScore) {
          setHighScore(finalScore);
          localStorage.setItem('jb_dodge_highscore', String(finalScore));
        }

        setGameState(GAME_STATE.GAME_OVER);
        onScore?.(finalScore);
        onGameOver?.(finalScore);
      }
      return newLives;
    });
    return true;
  }, [stars, highScore, onScore, onGameOver]);

  // 게임 업데이트
  const update = useCallback((dt) => {
    const game = gameRef.current;
    if (!game.player || countdown > 0) return;

    const { width, height } = game.canvasSize;
    const input = game.input;

    // 게임 시간 업데이트
    game.gameTime += dt;

    // 무적 시간 감소
    if (game.invincibleTimer > 0) {
      game.invincibleTimer -= dt;
    }

    // 플레이어 이동
    let dx = 0;
    if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) dx = -1;
    if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) dx = 1;

    game.player.x = clamp(
      game.player.x + dx * PLAYER_SPEED * dt,
      PLAYER_SIZE / 2,
      width - PLAYER_SIZE / 2
    );

    // 난이도 증가
    const difficulty = Math.min(1 + game.gameTime / 40, 2.5);
    const spawnRate = Math.min(INITIAL_SPAWN_RATE * difficulty, MAX_SPAWN_RATE);
    const fallSpeed = 130 + game.gameTime * 2.5;

    // 장애물 생성
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      game.spawnTimer = 1 / spawnRate;
      game.obstacles.push({
        x: random(OBSTACLE_SIZE, width - OBSTACLE_SIZE),
        y: -OBSTACLE_SIZE,
        width: OBSTACLE_SIZE,
        height: OBSTACLE_SIZE,
        speed: fallSpeed + random(-20, 20),
        rotation: 0,
        rotationSpeed: random(-5, 5),
      });
    }

    // 별 생성
    game.starSpawnTimer -= dt;
    if (game.starSpawnTimer <= 0) {
      game.starSpawnTimer = random(2.5, 5);
      game.starItems.push({
        x: random(STAR_SIZE, width - STAR_SIZE),
        y: -STAR_SIZE,
        speed: fallSpeed * 0.7,
      });
    }

    // 하트 생성 (드물게)
    game.heartSpawnTimer -= dt;
    if (game.heartSpawnTimer <= 0) {
      game.heartSpawnTimer = random(20, 35);
      game.heartItems.push({
        x: random(HEART_SIZE, width - HEART_SIZE),
        y: -HEART_SIZE,
        speed: fallSpeed * 0.5,
      });
    }

    // 장애물 업데이트
    game.obstacles = game.obstacles.filter(obs => {
      obs.y += obs.speed * dt;
      obs.rotation += obs.rotationSpeed * dt;

      // 충돌 체크 (무적 아닐 때만)
      if (game.invincibleTimer <= 0 && checkCollision(
        { x: game.player.x - PLAYER_SIZE / 2 + 6, y: game.player.y - PLAYER_SIZE / 2 + 6, width: PLAYER_SIZE - 12, height: PLAYER_SIZE - 12 },
        { x: obs.x - OBSTACLE_SIZE / 2 + 6, y: obs.y - OBSTACLE_SIZE / 2 + 6, width: OBSTACLE_SIZE - 12, height: OBSTACLE_SIZE - 12 }
      )) {
        handleHit();
        return false;
      }

      return obs.y < height + OBSTACLE_SIZE;
    });

    // 별 업데이트
    game.starItems = game.starItems.filter(star => {
      star.y += star.speed * dt;

      if (checkCollision(
        { x: game.player.x - PLAYER_SIZE / 2, y: game.player.y - PLAYER_SIZE / 2, width: PLAYER_SIZE, height: PLAYER_SIZE },
        { x: star.x - STAR_SIZE / 2, y: star.y - STAR_SIZE / 2, width: STAR_SIZE, height: STAR_SIZE }
      )) {
        setStars(s => s + 1);
        return false;
      }

      return star.y < height + STAR_SIZE;
    });

    // 하트 업데이트
    game.heartItems = game.heartItems.filter(heart => {
      heart.y += heart.speed * dt;

      if (checkCollision(
        { x: game.player.x - PLAYER_SIZE / 2, y: game.player.y - PLAYER_SIZE / 2, width: PLAYER_SIZE, height: PLAYER_SIZE },
        { x: heart.x - HEART_SIZE / 2, y: heart.y - HEART_SIZE / 2, width: HEART_SIZE, height: HEART_SIZE }
      )) {
        setLives(l => Math.min(l + 1, MAX_LIVES));
        return false;
      }

      return heart.y < height + HEART_SIZE;
    });

    // 실시간 점수
    setScore(Math.floor(game.gameTime * 10) + stars * 50);
  }, [countdown, stars, handleHit]);

  // 렌더링
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    // 배경
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a202c');
    gradient.addColorStop(1, '#2d3748');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 카운트다운
    if (countdown > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(countdown === 1 ? 'GO!' : countdown.toString(), width / 2, height / 2);
      return;
    }

    if (!game.player) return;

    // 장애물 (💩)
    ctx.font = `${OBSTACLE_SIZE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    game.obstacles.forEach(obs => {
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.rotation);
      ctx.fillText('💩', 0, 0);
      ctx.restore();
    });

    // 별 (⭐)
    ctx.font = `${STAR_SIZE}px sans-serif`;
    game.starItems.forEach(star => {
      ctx.fillText('⭐', star.x, star.y);
    });

    // 하트 (💚)
    ctx.font = `${HEART_SIZE}px sans-serif`;
    game.heartItems.forEach(heart => {
      ctx.fillText('💚', heart.x, heart.y);
    });

    // 플레이어 (🏃) - 무적 시 깜빡임
    const isBlinking = game.invincibleTimer > 0 && Math.floor(game.invincibleTimer * 10) % 2 === 0;
    if (!isBlinking) {
      ctx.font = `${PLAYER_SIZE}px sans-serif`;
      ctx.fillText('🏃', game.player.x, game.player.y);
    }

    // UI - 하트 (목숨)
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'left';
    let heartDisplay = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      heartDisplay += i < lives ? '❤️' : '🖤';
    }
    ctx.fillText(heartDisplay, 10, 30);

    // UI - 별 카운트
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`⭐ × ${stars}`, 10, 55);

    // UI - 시간
    ctx.fillText(`${Math.floor(game.gameTime)}초`, 10, 80);

    // UI - 점수
    ctx.textAlign = 'right';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${score}`, width - 10, 30);

    // 최고 기록
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`최고: ${highScore}`, width - 10, 50);
  }, [countdown, lives, stars, score, highScore]);

  // 터치 이벤트
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastTouchX = null;

    const handleTouchStart = (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        lastTouchX = e.touches[0].clientX;
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const game = gameRef.current;
      if (!game.input || gameState !== GAME_STATE.PLAYING || countdown > 0) return;

      const currentX = e.touches[0].clientX;
      const diff = currentX - lastTouchX;
      lastTouchX = currentX;

      game.input.keys = {};
      if (diff < -3) game.input.keys['ArrowLeft'] = true;
      else if (diff > 3) game.input.keys['ArrowRight'] = true;
    };

    const handleTouchEnd = () => {
      const game = gameRef.current;
      if (game.input) game.input.keys = {};
      lastTouchX = null;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
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
        className="border-2 border-gray-700 rounded-lg bg-gray-800"
        width={600}
        height={400}
      />

      {gameState === GAME_STATE.READY && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">💩 똥피하기</div>
            <div className="text-sm mb-6 text-gray-300">
              ← → 방향키로 이동 (모바일: 드래그)<br />
              💩를 피하고 ⭐를 모으세요!<br />
              💚 하트로 목숨 회복
            </div>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold"
            >
              게임 시작
            </button>
          </div>
        </div>
      )}

      {gameState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">💥 게임 오버</div>
            <div className="text-2xl mb-2 text-yellow-400">{score} 점</div>
            {score >= highScore && score > 0 && (
              <div className="text-green-400 text-lg mb-2">🏆 새 기록!</div>
            )}
            <div className="text-sm text-gray-300 mb-4">
              생존: {Math.floor(gameRef.current.gameTime)}초 | ⭐ × {stars}
            </div>
            <div className="text-xs text-gray-500">
              최고 기록: {highScore}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
