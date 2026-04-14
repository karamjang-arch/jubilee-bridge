'use client';

import { useEffect, useState } from 'react';

/**
 * XP 획득 토스트 알림
 */
export default function XpToast({ xpGain, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (xpGain) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [xpGain, onClose]);

  if (!xpGain || !visible) return null;

  return (
    <div className="xp-toast">
      <span className="xp-toast-icon">+{xpGain}</span>
      <span className="xp-toast-text">XP</span>
    </div>
  );
}
