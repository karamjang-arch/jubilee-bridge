'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  checkCollision,
  random,
  clamp,
  GAME_STATE,
} from '@/lib/gameEngine';

const PLAYER_SIZE = 32;
const PLAYER_SPEED = 280;
const OBSTACLE_SIZE = 28;
const LARGE_OBSTACLE_SIZE = 56;
const STAR_SIZE = 24;
const HEART_SIZE = 24;
const INITIAL_SPAWN_BATCH = 5;
const MAX_SPAWN_BATCH = 15;
const BATCH_SPAWN_INTERVAL = 1.5;
const MAX_LIVES = 3;
const INVINCIBLE_TIME = 1.5;
const LARGE_POOP_START = 30;
const WOBBLE_POOP_START = 60;

export default function DodgeGame({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);
  const keysRef = useRef({});

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
    spawnTimer: 0,
    starSpawnTimer: 0,
    heartSpawnTimer: 0,
    gameTime: 0,
    invincibleTimer: 0,
    canvasSize: { width: 600, height: 400 },
    isRunning: false,
    starsCollected: 0,
    currentLives: MAX_LIVES,
    walkPhase: 0,      // Walking animation phase
    facingDir: 0,      // -1 = left, 0 = front, 1 = right
  });

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('jb_dodge_highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  // Keyboard events
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

  // Initialize game
  const initGame = useCallback(() => {
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    game.player = {
      x: width / 2,
      y: height - 50,
    };

    game.obstacles = [];
    game.starItems = [];
    game.heartItems = [];
    game.spawnTimer = 0;
    game.starSpawnTimer = 2;
    game.heartSpawnTimer = random(15, 25);
    game.gameTime = 0;
    game.invincibleTimer = 0;
    game.starsCollected = 0;
    game.currentLives = MAX_LIVES;
    game.walkPhase = 0;
    game.facingDir = 0;

    setScore(0);
    setLives(MAX_LIVES);
    setStars(0);
  }, []);

  // Start game
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

  // Canvas initialization
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

  // Touch movement
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
      if (gameState !== GAME_STATE.PLAYING || countdown > 0) return;

      const currentX = e.touches[0].clientX;
      const diff = currentX - lastTouchX;
      lastTouchX = currentX;

      keysRef.current = {};
      if (diff < -3) keysRef.current['ArrowLeft'] = true;
      else if (diff > 3) keysRef.current['ArrowRight'] = true;
    };

    const handleTouchEnd = () => {
      keysRef.current = {};
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

  // Draw stick figure (Jollaman style)
  const drawStickFigure = (ctx, x, y, facingDir, walkPhase, isBlinking) => {
    if (isBlinking) return;

    ctx.save();
    ctx.translate(x, y);

    // Mirror if facing left
    if (facingDir === -1) {
      ctx.scale(-1, 1);
    }

    const walkOffset = Math.sin(walkPhase * 8) * 0.3;
    const isWalking = facingDir !== 0;

    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Head (circle)
    ctx.beginPath();
    ctx.arc(0, -20, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Eyes (simple dots)
    ctx.fillStyle = '#fff';
    if (facingDir === 0) {
      // Front facing - two eyes
      ctx.beginPath();
      ctx.arc(-3, -22, 2, 0, Math.PI * 2);
      ctx.arc(3, -22, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Side facing - one eye
      ctx.beginPath();
      ctx.arc(3, -22, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body (line)
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 8);
    ctx.stroke();

    // Arms
    if (isWalking) {
      // Walking animation - arms swing
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(-10 + walkOffset * 10, 0 + walkOffset * 5);
      ctx.moveTo(0, -5);
      ctx.lineTo(10 - walkOffset * 10, 0 - walkOffset * 5);
      ctx.stroke();
    } else {
      // Standing - arms down
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(-8, 5);
      ctx.moveTo(0, -5);
      ctx.lineTo(8, 5);
      ctx.stroke();
    }

    // Legs
    if (isWalking) {
      // Walking animation - legs move
      const legSwing = Math.sin(walkPhase * 8) * 8;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(-5 + legSwing, 22);
      ctx.moveTo(0, 8);
      ctx.lineTo(5 - legSwing, 22);
      ctx.stroke();
    } else {
      // Standing - legs apart
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(-6, 22);
      ctx.moveTo(0, 8);
      ctx.lineTo(6, 22);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Game loop
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

    const gameLoop = (currentTime) => {
      if (!game.isRunning) return;

      const dt = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = currentTime;

      // === UPDATE ===
      if (countdown <= 0 && game.player) {
        game.gameTime += dt;

        if (game.invincibleTimer > 0) {
          game.invincibleTimer -= dt;
        }

        // Player movement
        let dx = 0;
        if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) dx = -1;
        if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) dx = 1;

        // Update facing direction
        if (dx !== 0) {
          game.facingDir = dx;
          game.walkPhase += dt;
        } else {
          game.facingDir = 0;
        }

        game.player.x = clamp(
          game.player.x + dx * PLAYER_SPEED * dt,
          PLAYER_SIZE / 2,
          width - PLAYER_SIZE / 2
        );

        // Difficulty scaling
        const fallSpeed = 130 + game.gameTime * 3.75;

        // Spawn batch size
        const spawnBatch = Math.min(
          INITIAL_SPAWN_BATCH + Math.floor(game.gameTime / 10),
          MAX_SPAWN_BATCH
        );

        // Spawn obstacles
        game.spawnTimer -= dt;
        if (game.spawnTimer <= 0) {
          game.spawnTimer = BATCH_SPAWN_INTERVAL;

          for (let i = 0; i < spawnBatch; i++) {
            let obsType = 'normal';
            let size = OBSTACLE_SIZE;
            let obsSpeed = fallSpeed + random(-20, 20);
            let wobbleSpeed = 0;

            if (game.gameTime >= LARGE_POOP_START && Math.random() < 0.2) {
              obsType = 'large';
              size = LARGE_OBSTACLE_SIZE;
              obsSpeed = fallSpeed * 0.6;
            } else if (game.gameTime >= WOBBLE_POOP_START && Math.random() < 0.25) {
              obsType = 'wobble';
              wobbleSpeed = random(3, 6);
            }

            game.obstacles.push({
              x: random(size, width - size),
              y: -size - random(0, 100),
              speed: obsSpeed,
              rotation: 0,
              rotationSpeed: random(-5, 5),
              type: obsType,
              size: size,
              wobbleSpeed: wobbleSpeed,
              wobblePhase: random(0, Math.PI * 2),
            });
          }
        }

        // Spawn stars
        game.starSpawnTimer -= dt;
        if (game.starSpawnTimer <= 0) {
          game.starSpawnTimer = random(2.5, 5);
          game.starItems.push({
            x: random(STAR_SIZE, width - STAR_SIZE),
            y: -STAR_SIZE,
            speed: fallSpeed * 0.7,
          });
        }

        // Spawn hearts
        game.heartSpawnTimer -= dt;
        if (game.heartSpawnTimer <= 0) {
          game.heartSpawnTimer = random(20, 35);
          game.heartItems.push({
            x: random(HEART_SIZE, width - HEART_SIZE),
            y: -HEART_SIZE,
            speed: fallSpeed * 0.5,
          });
        }

        // Update obstacles
        game.obstacles = game.obstacles.filter(obs => {
          obs.y += obs.speed * dt;
          obs.rotation += obs.rotationSpeed * dt;

          if (obs.type === 'wobble') {
            obs.wobblePhase += obs.wobbleSpeed * dt;
            obs.x += Math.sin(obs.wobblePhase) * 80 * dt;
            obs.x = clamp(obs.x, obs.size, width - obs.size);
          }

          const obsSize = obs.size || OBSTACLE_SIZE;
          const hitboxShrink = obsSize * 0.2;

          if (game.invincibleTimer <= 0 && checkCollision(
            { x: game.player.x - PLAYER_SIZE / 2 + 6, y: game.player.y - PLAYER_SIZE / 2 + 6, width: PLAYER_SIZE - 12, height: PLAYER_SIZE - 12 },
            { x: obs.x - obsSize / 2 + hitboxShrink, y: obs.y - obsSize / 2 + hitboxShrink, width: obsSize - hitboxShrink * 2, height: obsSize - hitboxShrink * 2 }
          )) {
            game.invincibleTimer = INVINCIBLE_TIME;
            game.currentLives--;
            setLives(game.currentLives);

            if (game.currentLives <= 0) {
              const finalScore = Math.floor(game.gameTime * 10) + game.starsCollected * 50;
              setScore(finalScore);

              if (finalScore > highScore) {
                setHighScore(finalScore);
                localStorage.setItem('jb_dodge_highscore', String(finalScore));
              }

              setGameState(GAME_STATE.GAME_OVER);
              game.isRunning = false;
              onScore?.(finalScore);
              onGameOver?.(finalScore);
            }
            return false;
          }

          return obs.y < height + obsSize;
        });

        // Update stars
        game.starItems = game.starItems.filter(star => {
          star.y += star.speed * dt;

          if (checkCollision(
            { x: game.player.x - PLAYER_SIZE / 2, y: game.player.y - PLAYER_SIZE / 2, width: PLAYER_SIZE, height: PLAYER_SIZE },
            { x: star.x - STAR_SIZE / 2, y: star.y - STAR_SIZE / 2, width: STAR_SIZE, height: STAR_SIZE }
          )) {
            game.starsCollected++;
            setStars(game.starsCollected);
            return false;
          }

          return star.y < height + STAR_SIZE;
        });

        // Update hearts
        game.heartItems = game.heartItems.filter(heart => {
          heart.y += heart.speed * dt;

          if (checkCollision(
            { x: game.player.x - PLAYER_SIZE / 2, y: game.player.y - PLAYER_SIZE / 2, width: PLAYER_SIZE, height: PLAYER_SIZE },
            { x: heart.x - HEART_SIZE / 2, y: heart.y - HEART_SIZE / 2, width: HEART_SIZE, height: HEART_SIZE }
          )) {
            if (game.currentLives < MAX_LIVES) {
              game.currentLives++;
              setLives(game.currentLives);
            }
            return false;
          }

          return heart.y < height + HEART_SIZE;
        });

        setScore(Math.floor(game.gameTime * 10) + game.starsCollected * 50);
      }

      // === RENDER ===
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#1a202c');
      gradient.addColorStop(1, '#2d3748');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      if (countdown > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 72px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(countdown === 1 ? 'GO!' : countdown.toString(), width / 2, height / 2);
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (!game.player) {
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Obstacles
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      game.obstacles.forEach(obs => {
        const size = obs.size || OBSTACLE_SIZE;
        ctx.font = `${size}px sans-serif`;
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.rotation);
        if (obs.type === 'wobble') {
          ctx.globalAlpha = 0.7 + Math.sin(obs.wobblePhase * 2) * 0.3;
        }
        ctx.fillText('\uD83D\uDCA9', 0, 0);
        ctx.restore();
      });

      // Stars
      ctx.font = `${STAR_SIZE}px sans-serif`;
      game.starItems.forEach(star => ctx.fillText('\u2B50', star.x, star.y));

      // Hearts
      ctx.font = `${HEART_SIZE}px sans-serif`;
      game.heartItems.forEach(heart => ctx.fillText('\uD83D\uDC9A', heart.x, heart.y));

      // Player (stick figure)
      const isBlinking = game.invincibleTimer > 0 && Math.floor(game.invincibleTimer * 10) % 2 === 0;
      drawStickFigure(ctx, game.player.x, game.player.y, game.facingDir, game.walkPhase, isBlinking);

      // UI
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'left';
      let heartDisplay = '';
      for (let i = 0; i < MAX_LIVES; i++) {
        heartDisplay += i < game.currentLives ? '\u2764\uFE0F' : '\uD83D\uDDA4';
      }
      ctx.fillText(heartDisplay, 10, 30);

      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText(`\u2B50 x ${game.starsCollected}`, 10, 55);
      ctx.fillText(`${Math.floor(game.gameTime)}s`, 10, 80);

      ctx.textAlign = 'right';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`${Math.floor(game.gameTime * 10) + game.starsCollected * 50}`, width - 10, 30);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(`Best: ${highScore}`, width - 10, 50);

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, countdown, highScore, onScore, onGameOver]);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        className="border-2 border-gray-700 rounded-lg bg-gray-800 touch-none"
        style={{ width: '100%', maxWidth: 600, height: 'auto', aspectRatio: '3/2' }}
        width={600}
        height={400}
      />

      {gameState === GAME_STATE.READY && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">Dodge!</div>
            <div className="text-sm mb-6 text-gray-300">
              Arrow Keys to move (Mobile: Drag)<br />
              Dodge the obstacles and collect stars!<br />
              Hearts restore lives
            </div>
            <button onClick={startGame} className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold">
              Start Game
            </button>
          </div>
        </div>
      )}

      {gameState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">Game Over</div>
            <div className="text-2xl mb-2 text-yellow-400">{score} pts</div>
            {score >= highScore && score > 0 && (
              <div className="text-green-400 text-lg mb-2">New Record!</div>
            )}
            <div className="text-sm text-gray-300 mb-4">
              Survived: {Math.floor(gameRef.current.gameTime)}s | Stars: {stars}
            </div>
            <div className="text-xs text-gray-500">Best: {highScore}</div>
          </div>
        </div>
      )}
    </div>
  );
}
