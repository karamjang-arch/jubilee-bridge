'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  random,
  clamp,
  GAME_STATE,
} from '@/lib/gameEngine';

const GRAVITY = 200;
const TANK_WIDTH = 40;
const TANK_HEIGHT = 20;
const CANNON_LENGTH = 25;
const PROJECTILE_RADIUS = 5;
const EXPLOSION_RADIUS = 30;
const MAX_VELOCITY = 400;
const DIRECT_HIT_RADIUS = 25;

export default function TankBattle({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [countdown, setCountdown] = useState(0);
  const [round, setRound] = useState(1);
  const [hits, setHits] = useState(0);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(50);
  const [wind, setWind] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  const gameRef = useRef({
    terrain: [],
    player: null,
    ai: null,
    projectile: null,
    particles: [],
    canvasSize: { width: 600, height: 400 },
    turnPhase: 'aiming',
    aiThinkTimer: 0,
    isRunning: false,
    currentRound: 1,
    totalHits: 0,
  });

  // Generate terrain
  const generateTerrain = (width, height) => {
    const terrain = [];
    const groundLevel = height * 0.7;
    const segments = 60;
    const segmentWidth = width / segments;
    let y = groundLevel;

    for (let i = 0; i <= segments; i++) {
      terrain.push({ x: i * segmentWidth, y });
      y += random(-15, 15);
      y = clamp(y, height * 0.4, height * 0.85);
    }
    return terrain;
  };

  // Get terrain height at x position
  const getTerrainHeight = (x) => {
    const game = gameRef.current;
    if (!game.terrain || !game.terrain.length) return game.canvasSize.height * 0.7;

    for (let i = 0; i < game.terrain.length - 1; i++) {
      if (x >= game.terrain[i].x && x <= game.terrain[i + 1].x) {
        const t = (x - game.terrain[i].x) / (game.terrain[i + 1].x - game.terrain[i].x);
        return game.terrain[i].y + t * (game.terrain[i + 1].y - game.terrain[i].y);
      }
    }
    return game.canvasSize.height * 0.7;
  };

  // Initialize round with difficulty scaling
  const initRound = useCallback((roundNum = 1) => {
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    game.terrain = generateTerrain(width, height);
    game.currentRound = roundNum;

    const playerX = width * 0.15;
    const aiX = width * 0.85;

    game.player = {
      x: playerX,
      y: getTerrainHeight(playerX) - TANK_HEIGHT / 2,
      alive: true,
    };

    game.ai = {
      x: aiX,
      y: getTerrainHeight(aiX) - TANK_HEIGHT / 2,
      alive: true,
    };

    game.projectile = null;
    game.particles = [];
    game.turnPhase = 'aiming';
    game.aiThinkTimer = 0;

    // Wind increases with round (base ±30, +5 per round, max ±60)
    const maxWind = Math.min(30 + roundNum * 5, 60);
    setWind(Math.round(random(-maxWind, maxWind)));
    setCurrentTurn('player');
    setAngle(45);
    setPower(50);
  }, []);

  // Start game
  const startGame = useCallback(() => {
    setGameState(GAME_STATE.PLAYING);
    setRound(1);
    setHits(0);
    setCountdown(3);
    gameRef.current.isRunning = true;
    gameRef.current.currentRound = 1;
    gameRef.current.totalHits = 0;

    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownInterval);
        setCountdown(0);
        initRound(1);
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [initRound]);

  // Destroy terrain
  const destroyTerrain = (x, radius) => {
    const game = gameRef.current;
    game.terrain = game.terrain.map(point => {
      const dist = Math.abs(point.x - x);
      if (dist < radius) {
        const depth = Math.sqrt(radius * radius - dist * dist);
        return { ...point, y: Math.min(point.y + depth, game.canvasSize.height) };
      }
      return point;
    });
  };

  // Check if tank has fallen
  const checkTankFall = (tank) => {
    const game = gameRef.current;
    const terrainY = getTerrainHeight(tank.x);
    return tank.y > terrainY + TANK_HEIGHT || tank.y > game.canvasSize.height - 10;
  };

  // Store angle/power in refs
  const angleRef = useRef(angle);
  const powerRef = useRef(power);
  useEffect(() => { angleRef.current = angle; }, [angle]);
  useEffect(() => { powerRef.current = power; }, [power]);

  // Fire projectile
  const fire = useCallback(() => {
    const game = gameRef.current;
    if (game.turnPhase !== 'aiming' || !game.player) return;

    const currentAngle = angleRef.current;
    const currentPower = powerRef.current;

    const rad = (currentAngle * Math.PI) / 180;
    const MIN_SPEED = 80;
    const MAX_SPEED = 400;
    const velocity = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * ((currentPower - 10) / 90);

    console.log('발사:', { angle: currentAngle, power: currentPower, velocity, wind, round: game.currentRound });

    game.projectile = {
      x: game.player.x + Math.cos(rad) * CANNON_LENGTH,
      y: game.player.y - TANK_HEIGHT / 2 - Math.sin(rad) * CANNON_LENGTH,
      vx: Math.cos(rad) * velocity,
      vy: -Math.sin(rad) * velocity,
    };

    game.turnPhase = 'firing';
  }, [wind]);

  // AI fire with difficulty scaling
  const aiFire = useCallback(() => {
    const game = gameRef.current;
    if (!game.player || !game.ai) return;

    const dx = game.player.x - game.ai.x;
    const dy = game.ai.y - game.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // AI accuracy improves with round (error decreases)
    const baseError = 15;
    const errorReduction = Math.min(game.currentRound * 1.5, 12); // Max reduction of 12
    const aiError = baseError - errorReduction;

    const aiAngle = Math.atan2(dy, -dx) * 180 / Math.PI + random(-aiError, aiError);
    const aiPower = clamp(dist / 5 + random(-8, 8), 35, 95);

    const rad = (aiAngle * Math.PI) / 180;
    const velocity = MAX_VELOCITY * (aiPower / 100);

    game.projectile = {
      x: game.ai.x - Math.cos(rad) * CANNON_LENGTH,
      y: game.ai.y - TANK_HEIGHT / 2 - Math.sin(rad) * CANNON_LENGTH,
      vx: -Math.cos(rad) * velocity,
      vy: -Math.sin(rad) * velocity,
    };

    game.turnPhase = 'firing';
  }, []);

  // Canvas initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.min(rect.width || 600, 600);
    const height = Math.min(rect.height || 400, 400);

    canvas.width = width;
    canvas.height = height;
    gameRef.current.canvasSize = { width, height };

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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== GAME_STATE.PLAYING || countdown > 0) return;
      if (currentTurn !== 'player' || gameRef.current.turnPhase !== 'aiming') return;

      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          setAngle(prev => clamp(prev + 2, 10, 80));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setAngle(prev => clamp(prev - 2, 10, 80));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setPower(prev => clamp(prev + 5, 10, 100));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setPower(prev => clamp(prev - 5, 10, 100));
          break;
        case 'Space':
          e.preventDefault();
          fire();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, countdown, currentTurn, fire]);

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
      if (countdown <= 0 && game.player && game.ai) {
        // AI turn
        if (currentTurn === 'ai' && game.turnPhase === 'aiming') {
          game.aiThinkTimer -= dt;
          if (game.aiThinkTimer <= 0) {
            aiFire();
          }
        }

        // Update projectile
        if (game.projectile) {
          const p = game.projectile;
          p.vx += wind * 0.5 * dt;
          p.vy += GRAVITY * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          const terrainY = getTerrainHeight(p.x);
          let hitDetected = false;
          let playerDied = false;
          let aiDied = false;

          // Check direct hit on player
          const playerDist = Math.sqrt((p.x - game.player.x) ** 2 + (p.y - game.player.y) ** 2);
          if (playerDist < DIRECT_HIT_RADIUS) {
            hitDetected = true;
            playerDied = true;
          }

          // Check direct hit on AI
          const aiDist = Math.sqrt((p.x - game.ai.x) ** 2 + (p.y - game.ai.y) ** 2);
          if (aiDist < DIRECT_HIT_RADIUS) {
            hitDetected = true;
            aiDied = true;
            // Track hit
            game.totalHits++;
            setHits(game.totalHits);
          }

          // Check terrain/boundary collision
          if (p.y >= terrainY || p.x < 0 || p.x > width) {
            hitDetected = true;

            destroyTerrain(p.x, EXPLOSION_RADIUS);

            for (let i = 0; i < 20; i++) {
              const ang = random(0, Math.PI * 2);
              const spd = random(50, 150);
              game.particles.push({
                x: p.x, y: Math.min(p.y, terrainY),
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                life: random(0.3, 0.8),
                color: ['#ff4400', '#ff8800', '#ffcc00'][Math.floor(random(0, 3))],
              });
            }
          }

          if (hitDetected) {
            game.projectile = null;

            setTimeout(() => {
              if (game.player.alive) {
                const newTerrainY = getTerrainHeight(game.player.x);
                if (game.player.y < newTerrainY - TANK_HEIGHT / 2) {
                  game.player.y = newTerrainY - TANK_HEIGHT / 2;
                }
                if (checkTankFall(game.player)) {
                  playerDied = true;
                  game.player.alive = false;
                }
              }

              if (game.ai.alive) {
                const newTerrainY = getTerrainHeight(game.ai.x);
                if (game.ai.y < newTerrainY - TANK_HEIGHT / 2) {
                  game.ai.y = newTerrainY - TANK_HEIGHT / 2;
                }
                if (checkTankFall(game.ai)) {
                  aiDied = true;
                  game.ai.alive = false;
                }
              }

              // Survival mode logic
              if (playerDied) {
                // Player lost - Game Over
                const score = game.currentRound * 100 + game.totalHits * 50;
                setFinalScore(score);
                setGameState(GAME_STATE.GAME_OVER);
                game.isRunning = false;
                onScore?.(score);
                onGameOver?.(score);
              } else if (aiDied) {
                // Player won round - Next round!
                const nextRound = game.currentRound + 1;
                setRound(nextRound);
                setTimeout(() => initRound(nextRound), 1500);
              } else {
                // No death - switch turns
                game.turnPhase = 'aiming';
                game.aiThinkTimer = random(1, 2);
                setCurrentTurn(prev => prev === 'player' ? 'ai' : 'player');
                const maxWind = Math.min(30 + game.currentRound * 5, 60);
                setWind(Math.round(random(-maxWind, maxWind)));
              }
            }, 300);
          }
        }

        // Update particles
        game.particles = game.particles.filter(p => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 100 * dt;
          p.life -= dt;
          return p.life > 0;
        });

        // Apply gravity to tanks
        if (game.player.alive && game.turnPhase !== 'firing') {
          const terrainY = getTerrainHeight(game.player.x);
          if (game.player.y < terrainY - TANK_HEIGHT / 2) {
            game.player.y = Math.min(game.player.y + 50 * dt, terrainY - TANK_HEIGHT / 2);
          }
        }
        if (game.ai.alive && game.turnPhase !== 'firing') {
          const terrainY = getTerrainHeight(game.ai.x);
          if (game.ai.y < terrainY - TANK_HEIGHT / 2) {
            game.ai.y = Math.min(game.ai.y + 50 * dt, terrainY - TANK_HEIGHT / 2);
          }
        }
      }

      // === RENDER ===
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#1e3a5f');
      skyGrad.addColorStop(1, '#87ceeb');
      ctx.fillStyle = skyGrad;
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

      if (!game.terrain || !game.terrain.length || !game.player) {
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Terrain
      ctx.fillStyle = '#4a7c59';
      ctx.beginPath();
      ctx.moveTo(0, height);
      game.terrain.forEach(pt => ctx.lineTo(pt.x, pt.y));
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Player tank
      if (game.player.alive) {
        ctx.save();
        ctx.translate(game.player.x, game.player.y);
        ctx.fillStyle = '#3498db';
        ctx.fillRect(-TANK_WIDTH / 2, -TANK_HEIGHT / 2, TANK_WIDTH, TANK_HEIGHT);
        ctx.fillStyle = '#2980b9';
        ctx.beginPath();
        ctx.arc(0, -TANK_HEIGHT / 2, 12, 0, Math.PI * 2);
        ctx.fill();
        const rad = (angle * Math.PI) / 180;
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, -TANK_HEIGHT / 2);
        ctx.lineTo(Math.cos(rad) * CANNON_LENGTH, -TANK_HEIGHT / 2 - Math.sin(rad) * CANNON_LENGTH);
        ctx.stroke();
        ctx.restore();
      }

      // AI tank
      if (game.ai && game.ai.alive) {
        ctx.save();
        ctx.translate(game.ai.x, game.ai.y);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-TANK_WIDTH / 2, -TANK_HEIGHT / 2, TANK_WIDTH, TANK_HEIGHT);
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(0, -TANK_HEIGHT / 2, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, -TANK_HEIGHT / 2);
        ctx.lineTo(-CANNON_LENGTH, -TANK_HEIGHT / 2);
        ctx.stroke();
        ctx.restore();
      }

      // Projectile
      if (game.projectile) {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(game.projectile.x, game.projectile.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // Particles
      game.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // UI - Round indicator
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(width / 2 - 70, 5, 140, 55);

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`라운드 ${game.currentRound}`, width / 2, 25);

      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Wind: ${wind > 0 ? '→' : '←'} ${Math.abs(wind)}`, width / 2, 45);

      // Hits counter (top left)
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`명중: ${game.totalHits}`, 10, 25);

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, countdown, currentTurn, angle, wind, round, aiFire, initRound, onScore, onGameOver]);

  // Touch/mouse angle control
  const handleCanvasInteraction = (e) => {
    e.preventDefault();
    if (gameState !== GAME_STATE.PLAYING || currentTurn !== 'player') return;
    if (gameRef.current.turnPhase !== 'aiming') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const game = gameRef.current;
    if (!game.player) return;

    const dx = x - game.player.x;
    const dy = game.player.y - y;
    const newAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    setAngle(clamp(Math.round(newAngle), 10, 80));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        className="border-2 border-gray-700 rounded-lg cursor-crosshair touch-none"
        style={{ width: '100%', maxWidth: 600, height: 'auto', aspectRatio: '3/2' }}
        width={600}
        height={400}
        onMouseMove={handleCanvasInteraction}
        onTouchMove={handleCanvasInteraction}
        onTouchStart={(e) => e.preventDefault()}
      />

      {gameState === GAME_STATE.PLAYING && countdown === 0 && currentTurn === 'player' && gameRef.current.turnPhase === 'aiming' && (
        <div className="flex flex-col items-center gap-3 w-full max-w-md px-4">
          <div className="flex items-center gap-4 w-full">
            <span className="text-white w-16">Angle: {angle}</span>
            <input type="range" min="10" max="80" value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="flex-1" />
          </div>
          <div className="flex items-center gap-4 w-full">
            <span className="text-white w-16">Power: {power}%</span>
            <input type="range" min="10" max="100" value={power} onChange={(e) => setPower(Number(e.target.value))} className="flex-1" />
          </div>
          <button onClick={fire} className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white text-lg">
            Fire!
          </button>
          <div className="text-xs text-gray-400 mt-1">
            ←/→: 각도 | ↑/↓: 파워 | Space: 발사
          </div>
        </div>
      )}

      {currentTurn === 'ai' && gameState === GAME_STATE.PLAYING && countdown === 0 && (
        <div className="text-yellow-400 text-lg">AI 턴...</div>
      )}

      {gameState === GAME_STATE.READY && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">💣 Scorched Earth</div>
            <div className="text-sm mb-2 text-gray-300">
              서바이벌 모드!<br />
              적 탱크를 파괴하고 다음 라운드로!<br />
              질 때까지 무한 도전
            </div>
            <div className="text-xs text-yellow-400 mb-6">
              라운드마다 AI 정확도 ↑, 바람 세기 ↑
            </div>
            <button onClick={startGame} className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold">
              게임 시작
            </button>
          </div>
        </div>
      )}

      {gameState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">💥 게임 오버</div>
            <div className="text-yellow-400 text-lg mb-2">
              라운드 {round}까지 생존!
            </div>
            <div className="text-2xl mb-2 text-green-400">{finalScore} 점</div>
            <div className="text-sm text-gray-400 mb-4">
              라운드 × 100 + 명중 {hits}회 × 50
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
