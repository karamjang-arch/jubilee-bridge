/**
 * Mini Game Engine - HTML5 Canvas 기반 게임 엔진
 */

// AABB 충돌 감지
export function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// 원형 충돌 감지
export function checkCircleCollision(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < a.radius + b.radius;
}

// 두 점 사이 거리
export function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// 랜덤 범위
export function random(min, max) {
  return Math.random() * (max - min) + min;
}

// 랜덤 정수
export function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

// 각도를 라디안으로
export function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// 라디안을 각도로
export function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

// 값을 범위 내로 제한
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// 키보드 입력 관리
export class InputManager {
  constructor() {
    this.keys = {};
    this.touches = [];
    this.setupListeners();
  }

  setupListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // 방향키 기본 동작 방지
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  isPressed(key) {
    return this.keys[key] || false;
  }

  reset() {
    this.keys = {};
    this.touches = [];
  }
}

// 게임 루프 관리
export class GameLoop {
  constructor(updateFn, renderFn, targetFps = 60) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.targetFps = targetFps;
    this.frameInterval = 1000 / targetFps;
    this.running = false;
    this.lastTime = 0;
    this.animationId = null;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  loop = () => {
    if (!this.running) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // 초 단위
    this.lastTime = currentTime;

    this.updateFn(deltaTime);
    this.renderFn();

    this.animationId = requestAnimationFrame(this.loop);
  };
}

// 파티클 시스템
export class Particle {
  constructor(x, y, vx, vy, color, life = 1) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = 4;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.size = Math.max(1, this.size * (this.life / this.maxLife));
  }

  render(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }

  isDead() {
    return this.life <= 0;
  }
}

export function createExplosion(x, y, count = 10, color = '#ff6600') {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = random(0, Math.PI * 2);
    const speed = random(50, 150);
    particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      color,
      random(0.3, 0.8)
    ));
  }
  return particles;
}

// 화면 크기에 맞게 캔버스 조정
export function fitCanvas(canvas, maxWidth = 600, maxHeight = 400) {
  const container = canvas.parentElement;
  if (!container) return { width: maxWidth, height: maxHeight };

  const containerWidth = container.clientWidth;
  const aspectRatio = maxWidth / maxHeight;

  let width = Math.min(containerWidth - 32, maxWidth);
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  canvas.width = width;
  canvas.height = height;

  return { width, height };
}

// 게임 상태 상수
export const GAME_STATE = {
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  WIN: 'win',
};

// 터치 영역 계산 (모바일용)
export function getTouchZone(touch, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const width = rect.width;

  if (x < width / 3) return 'left';
  if (x > (width * 2) / 3) return 'right';
  return 'center';
}
