'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function DevotionCard() {
  const [todayDate, setTodayDate] = useState('');
  const [devotion, setDevotion] = useState(null);
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setTodayDate(today);

    // API에서 묵상 데이터 가져오기
    const fetchDevotion = async () => {
      try {
        const res = await fetch(`/api/devotion?date=${today}`);
        const data = await res.json();
        setDevotion(data);
      } catch (error) {
        console.error('Failed to fetch devotion:', error);
        // 폴백 데이터
        setDevotion({
          title_text: '다 이루었다',
          scripture: '요19:28-30',
          hymn_text: ['143 웬 말인가 날 위하여', '147 거기 너 있었는가'],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDevotion();
  }, []);

  const handleSaveMemo = async () => {
    if (!memo.trim()) return;

    setIsSaving(true);
    // TODO: Google Sheets API로 저장
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSaving(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  if (!devotion) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-bg-hover rounded w-1/3 mb-4" />
          <div className="h-4 bg-bg-hover rounded w-2/3 mb-2" />
          <div className="h-4 bg-bg-hover rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* 상단 컬러 바 */}
      <div className="h-1 bg-subj-history" />

      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-caption text-text-tertiary mb-1">
              오늘의 묵상 · {format(new Date(), 'M월 d일', { locale: ko })}
            </div>
            <h3 className="text-heading text-text-primary">
              {devotion.title_text}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-subj-history-light flex items-center justify-center">
            <span className="text-xl">📖</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="mb-4 p-4 bg-bg-sidebar rounded-lg">
          <div className="text-subheading text-subj-history mb-2">
            {devotion.scripture}
          </div>
          <p className="text-body text-text-secondary">
            예수께서 신포도주를 받으신 후에 "다 이루었다" 하시고 머리를 숙이니 영혼이 떠나가시니라.
          </p>
          <p className="text-body text-text-tertiary italic mt-2">
            When Jesus had received the sour wine, he said, "It is finished," and he bowed his head and gave up his spirit.
          </p>
        </div>

        {/* 찬송 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {devotion.hymn_text.map((hymn, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-subj-history-light text-subj-history-dark text-caption rounded-pill"
            >
              {hymn}
            </span>
          ))}
        </div>

        {/* 묵상 메모 */}
        <div className="border-t border-border-subtle pt-4">
          <label className="text-caption text-text-tertiary mb-2 block">
            오늘의 묵상 메모
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="오늘 말씀을 통해 깨달은 점을 적어보세요..."
            className="w-full p-3 bg-bg-page border border-border-medium rounded-md text-body text-text-primary placeholder:text-text-disabled resize-none focus:outline-none focus:ring-2 focus:ring-subj-history/30 focus:border-subj-history"
            rows={3}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveMemo}
              disabled={!memo.trim() || isSaving}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--subj-history)' }}
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>

      {/* 토스트 */}
      {showToast && (
        <div className="toast">
          묵상 메모가 저장되었습니다!
        </div>
      )}
    </div>
  );
}
