'use client';

import { useEffect, useRef } from 'react';

/**
 * 뱃지 획득 축하 모달 (confetti 효과 포함)
 */
export default function BadgeCelebration({ badge, onClose }) {
  const confettiRef = useRef(null);

  useEffect(() => {
    if (!badge) return;

    // confetti 효과
    const loadConfetti = async () => {
      try {
        const confetti = (await import('canvas-confetti')).default;

        // 첫 번째 confetti 발사
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: [badge.color, '#ffc107', '#ff9800', '#4caf50'],
        });

        // 두 번째 confetti 발사 (양쪽에서)
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: [badge.color, '#ffc107'],
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: [badge.color, '#ff9800'],
          });
        }, 200);
      } catch (error) {
        console.error('Failed to load confetti:', error);
      }
    };

    loadConfetti();

    // 자동 닫기
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [badge, onClose]);

  if (!badge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
      <div
        className="bg-bg-card rounded-xl p-8 shadow-elevated max-w-sm mx-4 text-center animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        {/* 뱃지 아이콘 */}
        <div
          className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-5xl mb-4 animate-bounce"
          style={{ backgroundColor: badge.color + '20', border: `3px solid ${badge.color}` }}
        >
          {badge.icon}
        </div>

        {/* 축하 메시지 */}
        <h2 className="text-heading text-text-primary mb-2">
          뱃지 획득!
        </h2>
        <p className="text-subheading mb-1" style={{ color: badge.color }}>
          {badge.nameKo}
        </p>
        <p className="text-caption text-text-tertiary mb-4">
          {badge.description}
        </p>

        <button
          onClick={onClose}
          className="btn btn-primary w-full"
        >
          확인
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
        .animate-bounce {
          animation: bounce 0.5s ease-out;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
