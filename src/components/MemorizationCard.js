'use client';

import { useState, useEffect } from 'react';

const FALLBACK_VERSE = {
  reference: "로마서 8:28",
  verse_ko: "우리가 알거니와 하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는 모든 것이 합력하여 선을 이루느니라",
  verse_en: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.",
  week: "2026년 4월 첫째 주"
};

export default function MemorizationCard() {
  const [verse, setVerse] = useState(FALLBACK_VERSE);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVerse = async () => {
      try {
        const res = await fetch('/api/memorization');
        const data = await res.json();
        if (data.verse) {
          setVerse(data.verse);
        }
      } catch (error) {
        console.error('Failed to fetch memorization verse:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVerse();
  }, []);

  const handleComplete = async () => {
    setIsCompleted(!isCompleted);
    if (!isCompleted) {
      // Google Sheets에 완료 기록
      try {
        await fetch('/api/sheets?tab=memorization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verse_ref: verse.reference,
            status: 'completed',
            completed_at: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error('Failed to save completion:', error);
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  };

  return (
    <div className="card overflow-hidden">
      {/* 상단 컬러 바 */}
      <div className="h-1 bg-subj-english" />

      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-caption text-text-tertiary mb-1">
              이번 주 암송 · {verse.week}
            </div>
            <h3 className="text-heading text-text-primary">
              {verse.reference}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-subj-english-light flex items-center justify-center">
            <span className="text-xl">🙏</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="mb-4 space-y-4">
          {/* 한글 */}
          <div className="p-4 bg-bg-sidebar rounded-lg">
            <div className="text-caption text-subj-english mb-2 font-medium">개역개정</div>
            <p className="text-body text-text-primary leading-relaxed">
              {verse.verse_ko}
            </p>
          </div>

          {/* 영어 */}
          <div className="p-4 bg-subj-english-light rounded-lg">
            <div className="text-caption text-subj-english-dark mb-2 font-medium">NKJV</div>
            <p className="text-body text-subj-english-dark leading-relaxed italic">
              {verse.verse_en}
            </p>
          </div>
        </div>

        {/* 완료 체크 */}
        <div className="border-t border-border-subtle pt-4">
          <button
            onClick={handleComplete}
            className={`
              w-full flex items-center justify-center gap-3 py-3 rounded-lg text-ui font-medium transition-all
              ${isCompleted
                ? 'bg-success-light text-success border border-success/30'
                : 'bg-bg-hover text-text-secondary hover:bg-bg-selected'
              }
            `}
          >
            <span className={`
              w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
              ${isCompleted
                ? 'bg-success border-success text-white'
                : 'border-border-strong'
              }
            `}>
              {isCompleted && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            {isCompleted ? '암송 완료!' : '암송 완료하기'}
          </button>

          {isCompleted && (
            <p className="text-center text-caption text-success mt-2">
              잘 하셨습니다! 암송 스트릭이 이어지고 있어요.
            </p>
          )}
        </div>
      </div>

      {/* 토스트 */}
      {showToast && (
        <div className="toast">
          암송 완료가 기록되었습니다!
        </div>
      )}
    </div>
  );
}
