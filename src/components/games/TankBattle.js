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
const MAX_HP = 100;
const ROUNDS_TO_WIN = 2;

export default function TankBattle({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(0);

  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [countdown, setCountdown] = useState(0);
  const [playerHP, setPlayerHP] = useState(MAX_HP);
  const [aiHP, setAiHP] = useState(MAX_HP);
  const [playerWins, setPlayerWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(50);
  const [wind, setWind] = useState(0);
  const [message, setMessage] = useState('');
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
  });

  // 지형 생성
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

  // 지형 높이
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

  // 라운드 초기화
  const initRound = useCallback(() => {
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    game.terrain = generateTerrain(width, height);

    const playerX = width * 0.15;
    const aiX = width * 0.85;

    game.player = {
      x: playerX,
      y: getTerrainHeight(playerX) - TANK_HEIGHT / 2,
      hp: MAX_HP,
    };

    game.ai = {
      x: aiX,
      y: getTerrainHeight(aiX) - TANK_HEIGHT / 2,
      hp: MAX_HP,
    };

    game.projectile = null;
    game.particles = [];
    game.turnPhase = 'aiming';
    game.aiThinkTimer = 0;

    setPlayerHP(MAX_HP);
    setAiHP(MAX_HP);
    setWind(Math.round(random(-30, 30)));
    setCurrentTurn('player');
    setAngle(45);
    setPower(50);
    setMessage('');
  }, []);

  // 게임 시작
  const startGame = useCallback(() => {
    setGameState(GAME_STATE.PLAYING);
    setPlayerWins(0);
    setAiWins(0);
    setCountdown(3);
    gameRef.current.isRunning = true;

    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownInterval);
        setCountdown(0);
        initRound();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [initRound]);

  // 지형 파괴
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

  // 발사
  const fire = () => {
    const game = gameRef.current;
    if (game.turnPhase !== 'aiming' || currentTurn !== 'player' || !game.player) return;

    const rad = (angle * Math.PI) / 180;
    const velocity = power * 5;

    game.projectile = {
      x: game.player.x + Math.cos(rad) * CANNON_LENGTH,
      y: game.player.y - TANK_HEIGHT / 2 - Math.sin(rad) * CANNON_LENGTH,
      vx: Math.cos(rad) * velocity,
      vy: -Math.sin(rad) * velocity,
    };

    game.turnPhase = 'firing';
  };

  // AI 발사
  const aiFire = () => {
    const game = gameRef.current;
    if (!game.player || !game.ai) return;

    const dx = game.player.x - game.ai.x;
    const dy = game.ai.y - game.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const aiAngle = Math.atan2(dy, -dx) * 180 / Math.PI + random(-15, 15);
    const aiPower = clamp(dist / 8 + random(-10, 10), 30, 80);

    const rad = (aiAngle * Math.PI) / 180;
    const velocity = aiPower * 5;

    game.projectile = {
      x: game.ai.x - Math.cos(rad) * CANNON_LENGTH,
      y: game.ai.y - TANK_HEIGHT / 2 - Math.sin(rad) * CANNON_LENGTH,
      vx: -Math.cos(rad) * velocity,
      vy: -Math.sin(rad) * velocity,
    };

    game.turnPhase = 'firing';
  };

  // 캔버스 초기화 (한 번만)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.min(rect.width || 600, 600);
    const height = Math.min(rect.height || 400, 400);

    canvas.width = width;
    canvas.height = height;
    gameRef.current.canvasSize = { width, height };

    // 터치 이벤트로 줌 방지
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

  // 키보드 조작
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== GAME_STATE.PLAYING || countdown > 0) return;
      if (currentTurn !== 'player' || gameRef.current.turnPhase !== 'aiming') return;

      switch (e.code) {
        case 'ArrowUp':
          e.preventDefault();
          setAngle(prev => clamp(prev + 1, 10, 80));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setAngle(prev => clamp(prev - 1, 10, 80));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setPower(prev => clamp(prev - 5, 10, 100));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setPower(prev => clamp(prev + 5, 10, 100));
          break;
        case 'Space':
          e.preventDefault();
          fire();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, countdown, currentTurn]);

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

    const gameLoop = (currentTime) => {
      if (!game.isRunning) return;

      const dt = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = currentTime;

      // === UPDATE ===
      if (countdown <= 0 && game.player && game.ai) {
        // AI 턴
        if (currentTurn === 'ai' && game.turnPhase === 'aiming') {
          game.aiThinkTimer -= dt;
          if (game.aiThinkTimer <= 0) {
            aiFire();
          }
        }

        // 포탄 업데이트
        if (game.projectile) {
          const p = game.projectile;
          p.vx += wind * 0.5 * dt;
          p.vy += GRAVITY * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          const terrainY = getTerrainHeight(p.x);
          if (p.y >= terrainY || p.x < 0 || p.x > width) {
            // 폭발
            destroyTerrain(p.x, EXPLOSION_RADIUS);

            // 파티클
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

            // 데미지
            const playerDist = Math.sqrt((p.x - game.player.x) ** 2 + (p.y - game.player.y) ** 2);
            const aiDist = Math.sqrt((p.x - game.ai.x) ** 2 + (p.y - game.ai.y) ** 2);

            if (playerDist < EXPLOSION_RADIUS * 2) {
              const damage = Math.round(50 * (1 - playerDist / (EXPLOSION_RADIUS * 2)));
              game.player.hp = Math.max(0, game.player.hp - damage);
              setPlayerHP(game.player.hp);
            }
            if (aiDist < EXPLOSION_RADIUS * 2) {
              const damage = Math.round(50 * (1 - aiDist / (EXPLOSION_RADIUS * 2)));
              game.ai.hp = Math.max(0, game.ai.hp - damage);
              setAiHP(game.ai.hp);
            }

            game.projectile = null;

            // 승패 체크
            setTimeout(() => {
              if (game.player.hp <= 0 || game.ai.hp <= 0) {
                const playerWon = game.ai.hp <= 0;
                if (playerWon) {
                  setPlayerWins(prev => {
                    const newWins = prev + 1;
                    if (newWins >= ROUNDS_TO_WIN) {
                      const score = 500 + (game.player.hp * 5);
                      setFinalScore(score);
                      setGameState(GAME_STATE.WIN);
                      game.isRunning = false;
                      onScore?.(score);
                      onGameOver?.(score);
                    } else {
                      setTimeout(() => initRound(), 1500);
                    }
                    return newWins;
                  });
                } else {
                  setAiWins(prev => {
                    const newWins = prev + 1;
                    if (newWins >= ROUNDS_TO_WIN) {
                      setFinalScore(0);
                      setGameState(GAME_STATE.GAME_OVER);
                      game.isRunning = false;
                      onScore?.(0);
                      onGameOver?.(0);
                    } else {
                      setTimeout(() => initRound(), 1500);
                    }
                    return newWins;
                  });
                }
              } else {
                game.turnPhase = 'aiming';
                game.aiThinkTimer = random(1, 2);
                setCurrentTurn(prev => prev === 'player' ? 'ai' : 'player');
                setWind(Math.round(random(-30, 30)));
              }
            }, 300);
          }
        }

        // 파티클
        game.particles = game.particles.filter(p => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 100 * dt;
          p.life -= dt;
          return p.life > 0;
        });
      }

      // === RENDER ===
      // 하늘
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#1e3a5f');
      skyGrad.addColorStop(1, '#87ceeb');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // 카운트다운
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

      // 지형
      ctx.fillStyle = '#4a7c59';
      ctx.beginPath();
      ctx.moveTo(0, height);
      game.terrain.forEach(pt => ctx.lineTo(pt.x, pt.y));
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // 플레이어 탱크
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

      // AI 탱크
      if (game.ai) {
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

      // 포탄
      if (game.projectile) {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(game.projectile.x, game.projectile.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // 파티클
      game.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // UI
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(width / 2 - 80, 5, 160, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`바람: ${wind > 0 ? '→' : '←'} ${Math.abs(wind)}`, width / 2, 25);

      // HP 바
      ctx.fillStyle = '#333';
      ctx.fillRect(10, 10, 104, 20);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(12, 12, game.player.hp, 16);
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Player: ${game.player.hp}`, 14, 24);

      ctx.fillStyle = '#333';
      ctx.fillRect(width - 114, 10, 104, 20);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(width - 112, 12, game.ai?.hp || 0, 16);
      ctx.textAlign = 'right';
      ctx.fillText(`AI: ${game.ai?.hp || 0}`, width - 14, 24);

      // 라운드
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${playerWins} - ${aiWins}`, width / 2, 60);

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, countdown, currentTurn, angle, wind, playerWins, aiWins, initRound, onScore, onGameOver]);

  // 터치/마우스 각도 조절
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
            <span className="text-white w-16">각도: {angle}°</span>
            <input type="range" min="10" max="80" value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="flex-1" />
          </div>
          <div className="flex items-center gap-4 w-full">
            <span className="text-white w-16">파워: {power}%</span>
            <input type="range" min="10" max="100" value={power} onChange={(e) => setPower(Number(e.target.value))} className="flex-1" />
          </div>
          <button onClick={fire} className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white text-lg">
            발사!
          </button>
          <div className="text-xs text-gray-400 mt-1">
            ⌨️ ↑↓: 각도 | ←→: 파워 | Space: 발사
          </div>
        </div>
      )}

      {currentTurn === 'ai' && gameState === GAME_STATE.PLAYING && countdown === 0 && (
        <div className="text-yellow-400 text-lg">AI 차례...</div>
      )}

      {gameState === GAME_STATE.READY && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">💣 Scorched Earth</div>
            <div className="text-sm mb-6 text-gray-300">
              턴제 포격 게임!<br />각도와 파워를 조절해서 적 탱크를 파괴하세요<br />(Best of 3)
            </div>
            <button onClick={startGame} className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold">
              게임 시작
            </button>
          </div>
        </div>
      )}

      {gameState === GAME_STATE.WIN && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">🎉 승리!</div>
            <div className="text-2xl mb-2 text-green-400">{finalScore} 점</div>
            <div className="text-sm text-gray-300">{playerWins} - {aiWins}</div>
          </div>
        </div>
      )}

      {gameState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">💥 패배</div>
            <div className="text-sm text-gray-300">{playerWins} - {aiWins}</div>
          </div>
        </div>
      )}
    </div>
  );
}
