'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  random,
  clamp,
  GameLoop,
  fitCanvas,
  GAME_STATE,
} from '@/lib/gameEngine';

const GRAVITY = 200;
const TANK_WIDTH = 40;
const TANK_HEIGHT = 20;
const CANNON_LENGTH = 25;
const PROJECTILE_RADIUS = 5;
const EXPLOSION_RADIUS = 30;
const MAX_HP = 100;
const ROUNDS_TO_WIN = 2; // Best of 3

export default function TankBattle({ onGameOver, onScore }) {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [countdown, setCountdown] = useState(0);
  const [playerHP, setPlayerHP] = useState(MAX_HP);
  const [aiHP, setAiHP] = useState(MAX_HP);
  const [playerWins, setPlayerWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [currentTurn, setCurrentTurn] = useState('player'); // 'player' or 'ai'
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
    loop: null,
    canvasSize: { width: 600, height: 400 },
    turnPhase: 'aiming', // 'aiming', 'firing', 'waiting'
    aiThinkTimer: 0,
  });

  // 지형 생성
  const generateTerrain = useCallback((width, height) => {
    const terrain = [];
    const groundLevel = height * 0.7;
    const segments = 60;
    const segmentWidth = width / segments;

    // 랜덤 언덕 생성
    let y = groundLevel;
    for (let i = 0; i <= segments; i++) {
      terrain.push({ x: i * segmentWidth, y });
      // 부드러운 지형 변화
      y += random(-15, 15);
      y = clamp(y, height * 0.4, height * 0.85);
    }
    return terrain;
  }, []);

  // 지형 높이 구하기
  const getTerrainHeight = useCallback((x) => {
    const game = gameRef.current;
    if (!game.terrain.length) return game.canvasSize.height * 0.7;

    for (let i = 0; i < game.terrain.length - 1; i++) {
      if (x >= game.terrain[i].x && x <= game.terrain[i + 1].x) {
        const t = (x - game.terrain[i].x) / (game.terrain[i + 1].x - game.terrain[i].x);
        return game.terrain[i].y + t * (game.terrain[i + 1].y - game.terrain[i].y);
      }
    }
    return game.canvasSize.height * 0.7;
  }, []);

  // 지형 파괴
  const destroyTerrain = useCallback((x, radius) => {
    const game = gameRef.current;
    game.terrain = game.terrain.map(point => {
      const dist = Math.abs(point.x - x);
      if (dist < radius) {
        const depth = Math.sqrt(radius * radius - dist * dist);
        return { ...point, y: Math.min(point.y + depth, game.canvasSize.height) };
      }
      return point;
    });
  }, []);

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
  }, [generateTerrain, getTerrainHeight]);

  // 게임 시작 (카운트다운)
  const startGame = useCallback(() => {
    setGameState(GAME_STATE.PLAYING);
    setPlayerWins(0);
    setAiWins(0);
    setCountdown(3);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          initRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [initRound]);

  // 발사
  const fire = useCallback(() => {
    const game = gameRef.current;
    if (game.turnPhase !== 'aiming' || currentTurn !== 'player') return;

    const rad = (angle * Math.PI) / 180;
    const velocity = power * 5;

    game.projectile = {
      x: game.player.x + Math.cos(rad) * CANNON_LENGTH,
      y: game.player.y - TANK_HEIGHT / 2 - Math.sin(rad) * CANNON_LENGTH,
      vx: Math.cos(rad) * velocity,
      vy: -Math.sin(rad) * velocity,
    };

    game.turnPhase = 'firing';
  }, [angle, power, currentTurn]);

  // AI 발사
  const aiFire = useCallback(() => {
    const game = gameRef.current;
    if (!game.player || !game.ai) return;

    // AI가 플레이어를 향해 발사 (약간의 랜덤 오차)
    const dx = game.player.x - game.ai.x;
    const dy = game.ai.y - game.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 각도와 파워 계산 (간단한 AI)
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
  }, []);

  // 폭발 처리
  const handleExplosion = useCallback((x, y) => {
    const game = gameRef.current;

    // 지형 파괴
    destroyTerrain(x, EXPLOSION_RADIUS);

    // 파티클 생성
    for (let i = 0; i < 20; i++) {
      const ang = random(0, Math.PI * 2);
      const spd = random(50, 150);
      game.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: random(0.3, 0.8),
        color: ['#ff4400', '#ff8800', '#ffcc00'][Math.floor(random(0, 3))],
      });
    }

    // 데미지 계산
    const playerDist = Math.sqrt((x - game.player.x) ** 2 + (y - game.player.y) ** 2);
    const aiDist = Math.sqrt((x - game.ai.x) ** 2 + (y - game.ai.y) ** 2);

    if (playerDist < EXPLOSION_RADIUS * 2) {
      const damage = Math.round(50 * (1 - playerDist / (EXPLOSION_RADIUS * 2)));
      game.player.hp = Math.max(0, game.player.hp - damage);
      setPlayerHP(game.player.hp);
      setMessage(`플레이어 -${damage} 데미지!`);
    }

    if (aiDist < EXPLOSION_RADIUS * 2) {
      const damage = Math.round(50 * (1 - aiDist / (EXPLOSION_RADIUS * 2)));
      game.ai.hp = Math.max(0, game.ai.hp - damage);
      setAiHP(game.ai.hp);
      setMessage(`AI -${damage} 데미지!`);
    }

    // 라운드 승패 체크
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
              onScore?.(score);
              onGameOver?.(score);
            } else {
              setMessage('라운드 승리! 다음 라운드...');
              setTimeout(() => initRound(), 2000);
            }
            return newWins;
          });
        } else {
          setAiWins(prev => {
            const newWins = prev + 1;
            if (newWins >= ROUNDS_TO_WIN) {
              setFinalScore(0);
              setGameState(GAME_STATE.GAME_OVER);
              onScore?.(0);
              onGameOver?.(0);
            } else {
              setMessage('라운드 패배! 다음 라운드...');
              setTimeout(() => initRound(), 2000);
            }
            return newWins;
          });
        }
      } else {
        // 턴 교대
        game.turnPhase = 'aiming';
        game.aiThinkTimer = random(1, 2);
        setCurrentTurn(prev => prev === 'player' ? 'ai' : 'player');
        setWind(Math.round(random(-30, 30)));
        setMessage('');
      }
    }, 500);
  }, [destroyTerrain, initRound, onScore, onGameOver]);

  // 게임 업데이트
  const update = useCallback((dt) => {
    const game = gameRef.current;
    if (!game.player || !game.ai || countdown > 0) return;

    const { width, height } = game.canvasSize;

    // AI 턴 처리
    if (currentTurn === 'ai' && game.turnPhase === 'aiming') {
      game.aiThinkTimer -= dt;
      if (game.aiThinkTimer <= 0) {
        aiFire();
      }
    }

    // 포탄 업데이트
    if (game.projectile) {
      const p = game.projectile;

      // 바람 영향
      p.vx += wind * 0.5 * dt;

      // 중력
      p.vy += GRAVITY * dt;

      // 이동
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 지형 충돌
      const terrainY = getTerrainHeight(p.x);
      if (p.y >= terrainY || p.x < 0 || p.x > width) {
        handleExplosion(p.x, Math.min(p.y, terrainY));
        game.projectile = null;
      }
    }

    // 파티클 업데이트
    game.particles = game.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 100 * dt;
      p.life -= dt;
      return p.life > 0;
    });
  }, [countdown, currentTurn, wind, aiFire, getTerrainHeight, handleExplosion]);

  // 렌더링
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    const { width, height } = game.canvasSize;

    // 하늘 그라데이션
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
      ctx.fillText(countdown.toString(), width / 2, height / 2);
      return;
    }

    if (!game.terrain.length) return;

    // 지형
    ctx.fillStyle = '#4a7c59';
    ctx.beginPath();
    ctx.moveTo(0, height);
    game.terrain.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 플레이어 탱크
    if (game.player) {
      ctx.save();
      ctx.translate(game.player.x, game.player.y);

      // 몸체
      ctx.fillStyle = '#3498db';
      ctx.fillRect(-TANK_WIDTH / 2, -TANK_HEIGHT / 2, TANK_WIDTH, TANK_HEIGHT);

      // 포탑
      ctx.fillStyle = '#2980b9';
      ctx.beginPath();
      ctx.arc(0, -TANK_HEIGHT / 2, 12, 0, Math.PI * 2);
      ctx.fill();

      // 포신
      const rad = (angle * Math.PI) / 180;
      ctx.strokeStyle = '#2980b9';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -TANK_HEIGHT / 2);
      ctx.lineTo(Math.cos(rad) * CANNON_LENGTH, -TANK_HEIGHT / 2 - Math.sin(rad) * CANNON_LENGTH);
      ctx.stroke();

      ctx.restore();
    }

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

      // AI 포신 (플레이어 방향)
      const aiAngle = Math.PI - Math.atan2(game.player?.y - game.ai.y, game.player?.x - game.ai.x);
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -TANK_HEIGHT / 2);
      ctx.lineTo(-Math.cos(aiAngle) * CANNON_LENGTH, -TANK_HEIGHT / 2 - Math.sin(aiAngle) * CANNON_LENGTH);
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

    // UI - 바람
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(width / 2 - 80, 5, 160, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`바람: ${wind > 0 ? '→' : '←'} ${Math.abs(wind)}`, width / 2, 25);

    // UI - HP 바
    // Player HP
    ctx.fillStyle = '#333';
    ctx.fillRect(10, 10, 104, 20);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(12, 12, playerHP, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Player: ${playerHP}`, 14, 24);

    // AI HP
    ctx.fillStyle = '#333';
    ctx.fillRect(width - 114, 10, 104, 20);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(width - 112, 12, aiHP, 16);
    ctx.textAlign = 'right';
    ctx.fillText(`AI: ${aiHP}`, width - 14, 24);

    // 라운드 점수
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${playerWins} - ${aiWins}`, width / 2, 60);

    // 메시지
    if (message) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(width / 2 - 120, height / 2 - 20, 240, 40);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText(message, width / 2, height / 2 + 5);
    }
  }, [countdown, angle, playerHP, aiHP, playerWins, aiWins, wind, message]);

  // 게임 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = gameRef.current;
    game.canvasSize = fitCanvas(canvas);
    game.loop = new GameLoop(update, render);

    if (gameState === GAME_STATE.PLAYING) {
      game.loop.start();
    }

    return () => game.loop?.stop();
  }, [update, render, gameState]);

  // 터치/마우스 각도 조절
  const handleCanvasInteraction = (e) => {
    if (gameState !== GAME_STATE.PLAYING || currentTurn !== 'player') return;
    if (gameRef.current.turnPhase !== 'aiming') return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const game = gameRef.current;
    if (!game.player) return;

    // 플레이어 탱크 기준으로 각도 계산
    const dx = x - game.player.x;
    const dy = game.player.y - y;
    const newAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    setAngle(clamp(Math.round(newAngle), 10, 80));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        className="border-2 border-gray-700 rounded-lg cursor-crosshair"
        width={600}
        height={400}
        onMouseMove={handleCanvasInteraction}
        onTouchMove={(e) => { e.preventDefault(); handleCanvasInteraction(e); }}
      />

      {/* 컨트롤 패널 */}
      {gameState === GAME_STATE.PLAYING && countdown === 0 && currentTurn === 'player' && gameRef.current.turnPhase === 'aiming' && (
        <div className="flex flex-col items-center gap-3 w-full max-w-md px-4">
          <div className="flex items-center gap-4 w-full">
            <span className="text-white w-16">각도: {angle}°</span>
            <input
              type="range"
              min="10"
              max="80"
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-4 w-full">
            <span className="text-white w-16">파워: {power}%</span>
            <input
              type="range"
              min="10"
              max="100"
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
              className="flex-1"
            />
          </div>
          <button
            onClick={fire}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white text-lg"
          >
            발사!
          </button>
        </div>
      )}

      {currentTurn === 'ai' && gameState === GAME_STATE.PLAYING && countdown === 0 && (
        <div className="text-yellow-400 text-lg">AI 차례...</div>
      )}

      {/* 시작 화면 */}
      {gameState === GAME_STATE.READY && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">Scorched Earth</div>
            <div className="text-sm mb-6 text-gray-300">
              턴제 포격 게임!<br />
              각도와 파워를 조절해서 적 탱크를 파괴하세요<br />
              바람의 영향을 고려하세요 (Best of 3)
            </div>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold"
            >
              게임 시작
            </button>
          </div>
        </div>
      )}

      {/* 승리 화면 */}
      {gameState === GAME_STATE.WIN && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">승리!</div>
            <div className="text-2xl mb-2 text-green-400">{finalScore} 점</div>
            <div className="text-sm text-gray-300 mb-4">
              {playerWins} - {aiWins}
            </div>
          </div>
        </div>
      )}

      {/* 게임 오버 화면 */}
      {gameState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">패배</div>
            <div className="text-sm text-gray-300 mb-4">
              {playerWins} - {aiWins}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
