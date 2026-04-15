'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  checkCollision,
  random,
  randomInt,
  toRadians,
  clamp,
  InputManager,
  GameLoop,
  createExplosion,
  fitCanvas,
  GAME_STATE,
  getTouchZone,
} from '@/lib/gameEngine';

const TANK_SIZE = 30;
const BULLET_SIZE = 6;
const BULLET_SPEED = 300;
const TANK_SPEED = 120;
const ENEMY_COUNT = 5;
const PLAYER_MAX_HP = 3;

export default function TankBattle({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [score, setScore] = useState(0);
  const [playerHP, setPlayerHP] = useState(PLAYER_MAX_HP);
  const [enemiesLeft, setEnemiesLeft] = useState(ENEMY_COUNT);

  const gameRef = useRef({
    player: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    input: null,
    loop: null,
    lastShot: 0,
    canvasSize: { width: 600, height: 400 },
  });

  // 게임 초기화
  const initGame = useCallback(() => {
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    // 플레이어 탱크
    game.player = {
      x: width / 2,
      y: height - 50,
      width: TANK_SIZE,
      height: TANK_SIZE,
      angle: -90, // 위를 향함
      hp: PLAYER_MAX_HP,
    };

    // 적 탱크 생성
    game.enemies = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
      game.enemies.push({
        x: random(50, width - 50),
        y: random(50, height / 2 - 50),
        width: TANK_SIZE,
        height: TANK_SIZE,
        angle: random(0, 360),
        hp: 1,
        moveTimer: 0,
        shootTimer: random(1, 3),
        vx: random(-50, 50),
        vy: random(-50, 50),
      });
    }

    game.bullets = [];
    game.enemyBullets = [];
    game.particles = [];
    game.lastShot = 0;

    setScore(0);
    setPlayerHP(PLAYER_MAX_HP);
    setEnemiesLeft(ENEMY_COUNT);
    setGameState(GAME_STATE.PLAYING);
  }, []);

  // 게임 업데이트
  const update = useCallback((dt) => {
    const game = gameRef.current;
    if (!game.player) return;

    const { width, height } = game.canvasSize;
    const input = game.input;

    // 플레이어 이동
    let dx = 0, dy = 0;
    if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) dx = -1;
    if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) dx = 1;
    if (input.isPressed('ArrowUp') || input.isPressed('KeyW')) dy = -1;
    if (input.isPressed('ArrowDown') || input.isPressed('KeyS')) dy = 1;

    if (dx !== 0 || dy !== 0) {
      game.player.angle = Math.atan2(dy, dx) * (180 / Math.PI);
    }

    game.player.x = clamp(game.player.x + dx * TANK_SPEED * dt, TANK_SIZE / 2, width - TANK_SIZE / 2);
    game.player.y = clamp(game.player.y + dy * TANK_SPEED * dt, TANK_SIZE / 2, height - TANK_SIZE / 2);

    // 플레이어 발사
    const now = performance.now();
    if ((input.isPressed('Space') || input.isPressed('KeyZ')) && now - game.lastShot > 300) {
      game.lastShot = now;
      const rad = toRadians(game.player.angle);
      game.bullets.push({
        x: game.player.x,
        y: game.player.y,
        vx: Math.cos(rad) * BULLET_SPEED,
        vy: Math.sin(rad) * BULLET_SPEED,
        width: BULLET_SIZE,
        height: BULLET_SIZE,
      });
    }

    // 플레이어 총알 업데이트
    game.bullets = game.bullets.filter(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      return b.x > 0 && b.x < width && b.y > 0 && b.y < height;
    });

    // 적 탱크 AI
    game.enemies.forEach(enemy => {
      enemy.moveTimer -= dt;
      enemy.shootTimer -= dt;

      // 방향 변경
      if (enemy.moveTimer <= 0) {
        enemy.moveTimer = random(1, 3);
        enemy.vx = random(-50, 50);
        enemy.vy = random(-50, 50);
      }

      // 이동
      enemy.x = clamp(enemy.x + enemy.vx * dt, TANK_SIZE / 2, width - TANK_SIZE / 2);
      enemy.y = clamp(enemy.y + enemy.vy * dt, TANK_SIZE / 2, height / 2);

      // 발사
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = random(2, 4);
        // 플레이어 방향으로 발사
        const dx = game.player.x - enemy.x;
        const dy = game.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        game.enemyBullets.push({
          x: enemy.x,
          y: enemy.y,
          vx: (dx / dist) * BULLET_SPEED * 0.6,
          vy: (dy / dist) * BULLET_SPEED * 0.6,
          width: BULLET_SIZE,
          height: BULLET_SIZE,
        });
      }
    });

    // 적 총알 업데이트
    game.enemyBullets = game.enemyBullets.filter(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      return b.x > 0 && b.x < width && b.y > 0 && b.y < height;
    });

    // 충돌: 플레이어 총알 vs 적
    game.bullets = game.bullets.filter(bullet => {
      for (let i = game.enemies.length - 1; i >= 0; i--) {
        const enemy = game.enemies[i];
        if (checkCollision(
          { x: bullet.x - BULLET_SIZE / 2, y: bullet.y - BULLET_SIZE / 2, width: BULLET_SIZE, height: BULLET_SIZE },
          { x: enemy.x - TANK_SIZE / 2, y: enemy.y - TANK_SIZE / 2, width: TANK_SIZE, height: TANK_SIZE }
        )) {
          // 적 파괴
          game.particles.push(...createExplosion(enemy.x, enemy.y, 15, '#ff4400'));
          game.enemies.splice(i, 1);
          setScore(s => s + 100);
          setEnemiesLeft(game.enemies.length);

          // 승리 체크
          if (game.enemies.length === 0) {
            const finalScore = (ENEMY_COUNT * 100) + (game.player.hp * 50);
            setScore(finalScore);
            setGameState(GAME_STATE.WIN);
            onScore?.(finalScore);
            onGameOver?.(finalScore);
          }
          return false;
        }
      }
      return true;
    });

    // 충돌: 적 총알 vs 플레이어
    game.enemyBullets = game.enemyBullets.filter(bullet => {
      if (checkCollision(
        { x: bullet.x - BULLET_SIZE / 2, y: bullet.y - BULLET_SIZE / 2, width: BULLET_SIZE, height: BULLET_SIZE },
        { x: game.player.x - TANK_SIZE / 2, y: game.player.y - TANK_SIZE / 2, width: TANK_SIZE, height: TANK_SIZE }
      )) {
        game.player.hp--;
        setPlayerHP(game.player.hp);
        game.particles.push(...createExplosion(game.player.x, game.player.y, 8, '#ffcc00'));

        if (game.player.hp <= 0) {
          setGameState(GAME_STATE.GAME_OVER);
          onScore?.(score);
          onGameOver?.(score);
        }
        return false;
      }
      return true;
    });

    // 파티클 업데이트
    game.particles = game.particles.filter(p => {
      p.update(dt);
      return !p.isDead();
    });
  }, [onGameOver, onScore, score]);

  // 렌더링
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    // 배경
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, width, height);

    // 그리드 라인
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!game.player) return;

    // 플레이어 탱크
    ctx.save();
    ctx.translate(game.player.x, game.player.y);
    ctx.rotate(toRadians(game.player.angle));
    ctx.fillStyle = '#48bb78';
    ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2, TANK_SIZE, TANK_SIZE);
    ctx.fillStyle = '#2f855a';
    ctx.fillRect(0, -4, TANK_SIZE / 2 + 5, 8); // 포신
    ctx.restore();

    // 적 탱크
    game.enemies.forEach(enemy => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.fillStyle = '#e53e3e';
      ctx.fillRect(-TANK_SIZE / 2, -TANK_SIZE / 2, TANK_SIZE, TANK_SIZE);
      ctx.fillStyle = '#c53030';
      ctx.fillRect(0, -3, TANK_SIZE / 2, 6);
      ctx.restore();
    });

    // 플레이어 총알
    ctx.fillStyle = '#68d391';
    game.bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 적 총알
    ctx.fillStyle = '#fc8181';
    game.enemyBullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 파티클
    game.particles.forEach(p => p.render(ctx));

    // UI
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP: ${'❤️'.repeat(game.player.hp)}${'🖤'.repeat(PLAYER_MAX_HP - game.player.hp)}`, 10, 25);
    ctx.fillText(`적: ${game.enemies.length}/${ENEMY_COUNT}`, 10, 45);
    ctx.textAlign = 'right';
    ctx.fillText(`점수: ${score}`, width - 10, 25);
  }, [score]);

  // 터치 이벤트
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouch = (e) => {
      e.preventDefault();
      const game = gameRef.current;
      if (!game.input || gameState !== GAME_STATE.PLAYING) return;

      const touch = e.touches[0];
      const zone = getTouchZone(touch, canvas);

      // 터치 영역에 따라 키 시뮬레이션
      game.input.keys = {};
      if (zone === 'left') game.input.keys['ArrowLeft'] = true;
      else if (zone === 'right') game.input.keys['ArrowRight'] = true;
      else game.input.keys['Space'] = true;
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
        className="border-2 border-gray-700 rounded-lg bg-gray-800"
        width={600}
        height={400}
      />

      {gameState === GAME_STATE.READY && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">🎯 탱크 배틀</div>
            <div className="text-sm mb-6 text-gray-300">
              방향키: 이동 | 스페이스: 발사<br />
              적 탱크 5대를 격파하세요!
            </div>
            <button
              onClick={initGame}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold"
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
            <div className="text-2xl mb-2 text-green-400">{score} 점</div>
            <div className="text-sm text-gray-300 mb-6">
              체력 보너스: +{playerHP * 50}
            </div>
          </div>
        </div>
      )}

      {gameState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">💥 게임 오버</div>
            <div className="text-2xl mb-2">{score} 점</div>
            <div className="text-sm text-gray-300">
              격파: {ENEMY_COUNT - enemiesLeft}/{ENEMY_COUNT}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
