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
  getTouchZone,
} from '@/lib/gameEngine';

const PLAYER_SIZE = 32;
const PLAYER_SPEED = 250;
const OBSTACLE_SIZE = 28;
const STAR_SIZE = 24;
const INITIAL_SPAWN_RATE = 1.5; // 초당 장애물 생성 수
const MAX_SPAWN_RATE = 5;

export default function DodgeGame({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [score, setScore] = useState(0);
  const [survivalTime, setSurvivalTime] = useState(0);
  const [stars, setStars] = useState(0);

  const gameRef = useRef({
    player: null,
    obstacles: [],
    starItems: [],
    input: null,
    loop: null,
    spawnTimer: 0,
    starSpawnTimer: 0,
    gameTime: 0,
    canvasSize: { width: 600, height: 400 },
  });

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
    game.spawnTimer = 0;
    game.starSpawnTimer = 0;
    game.gameTime = 0;

    setScore(0);
    setSurvivalTime(0);
    setStars(0);
    setGameState(GAME_STATE.PLAYING);
  }, []);

  // 게임 업데이트
  const update = useCallback((dt) => {
    const game = gameRef.current;
    if (!game.player) return;

    const { width, height } = game.canvasSize;
    const input = game.input;

    // 게임 시간 업데이트
    game.gameTime += dt;
    setSurvivalTime(Math.floor(game.gameTime));

    // 플레이어 이동
    let dx = 0;
    if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) dx = -1;
    if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) dx = 1;

    game.player.x = clamp(
      game.player.x + dx * PLAYER_SPEED * dt,
      PLAYER_SIZE / 2,
      width - PLAYER_SIZE / 2
    );

    // 난이도 증가 (시간에 따라)
    const difficulty = Math.min(1 + game.gameTime / 30, 3); // 최대 3배
    const spawnRate = Math.min(INITIAL_SPAWN_RATE * difficulty, MAX_SPAWN_RATE);
    const fallSpeed = 150 + game.gameTime * 3;

    // 장애물 생성
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      game.spawnTimer = 1 / spawnRate;
      game.obstacles.push({
        x: random(OBSTACLE_SIZE, width - OBSTACLE_SIZE),
        y: -OBSTACLE_SIZE,
        width: OBSTACLE_SIZE,
        height: OBSTACLE_SIZE,
        speed: fallSpeed + random(-30, 30),
        rotation: 0,
        rotationSpeed: random(-5, 5),
      });
    }

    // 별 생성 (덜 자주)
    game.starSpawnTimer -= dt;
    if (game.starSpawnTimer <= 0) {
      game.starSpawnTimer = random(3, 6);
      game.starItems.push({
        x: random(STAR_SIZE, width - STAR_SIZE),
        y: -STAR_SIZE,
        width: STAR_SIZE,
        height: STAR_SIZE,
        speed: fallSpeed * 0.7,
      });
    }

    // 장애물 업데이트
    game.obstacles = game.obstacles.filter(obs => {
      obs.y += obs.speed * dt;
      obs.rotation += obs.rotationSpeed * dt;

      // 충돌 체크
      if (checkCollision(
        { x: game.player.x - PLAYER_SIZE / 2 + 4, y: game.player.y - PLAYER_SIZE / 2 + 4, width: PLAYER_SIZE - 8, height: PLAYER_SIZE - 8 },
        { x: obs.x - OBSTACLE_SIZE / 2 + 4, y: obs.y - OBSTACLE_SIZE / 2 + 4, width: OBSTACLE_SIZE - 8, height: OBSTACLE_SIZE - 8 }
      )) {
        const finalScore = Math.floor(game.gameTime * 10) + stars * 50;
        setScore(finalScore);
        setGameState(GAME_STATE.GAME_OVER);
        onScore?.(finalScore);
        onGameOver?.(finalScore);
        return false;
      }

      return obs.y < height + OBSTACLE_SIZE;
    });

    // 별 업데이트
    game.starItems = game.starItems.filter(star => {
      star.y += star.speed * dt;

      // 충돌 체크
      if (checkCollision(
        { x: game.player.x - PLAYER_SIZE / 2, y: game.player.y - PLAYER_SIZE / 2, width: PLAYER_SIZE, height: PLAYER_SIZE },
        { x: star.x - STAR_SIZE / 2, y: star.y - STAR_SIZE / 2, width: STAR_SIZE, height: STAR_SIZE }
      )) {
        setStars(s => s + 1);
        return false;
      }

      return star.y < height + STAR_SIZE;
    });

    // 실시간 점수 업데이트
    setScore(Math.floor(game.gameTime * 10) + stars * 50);
  }, [onGameOver, onScore, stars]);

  // 렌더링
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    // 배경 (그라데이션)
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a202c');
    gradient.addColorStop(1, '#2d3748');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

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

    // 플레이어 (🏃)
    ctx.font = `${PLAYER_SIZE}px sans-serif`;
    ctx.fillText('🏃', game.player.x, game.player.y);

    // UI
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`시간: ${Math.floor(game.gameTime)}초`, 10, 25);
    ctx.fillText(`⭐ × ${stars}`, 10, 50);
    ctx.textAlign = 'right';
    ctx.fillText(`점수: ${score}`, width - 10, 25);
  }, [score, stars]);

  // 터치 이벤트
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchX = null;

    const handleTouchStart = (e) => {
      e.preventDefault();
      touchX = e.touches[0].clientX;
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const game = gameRef.current;
      if (!game.input || gameState !== GAME_STATE.PLAYING) return;

      const currentX = e.touches[0].clientX;
      const diff = currentX - touchX;
      touchX = currentX;

      // 드래그 방향에 따라 이동
      game.input.keys = {};
      if (diff < -5) game.input.keys['ArrowLeft'] = true;
      else if (diff > 5) game.input.keys['ArrowRight'] = true;
    };

    const handleTouchEnd = () => {
      const game = gameRef.current;
      if (game.input) game.input.keys = {};
      touchX = null;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
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
        className="border-2 border-gray-700 rounded-lg bg-gray-800"
        width={600}
        height={400}
      />

      {gameState === GAME_STATE.READY && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">💩 똥피하기</div>
            <div className="text-sm mb-6 text-gray-300">
              ← → 방향키로 이동<br />
              💩를 피하고 ⭐를 모으세요!
            </div>
            <button
              onClick={initGame}
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
            <div className="text-sm text-gray-300">
              생존: {survivalTime}초 | ⭐ × {stars}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
