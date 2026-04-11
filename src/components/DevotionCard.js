'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const TABS = [
  { id: 'daily', label: '매일성경' },
  { id: 'youth', label: '청소년 매일성경' },
  { id: 'english', label: '영어성경' },
];

const SU_LINK = 'https://sum.su.or.kr:8888/bible/today';

export default function DevotionCard({ studentCode = 'JH' }) {
  const [activeTab, setActiveTab] = useState('youth');
  const [devotion, setDevotion] = useState(null);
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);

  // 히스토리 상태
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 저장된 탭 선택 불러오기
  useEffect(() => {
    const savedTab = localStorage.getItem('devotion_tab');
    if (savedTab && TABS.find(t => t.id === savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  // 탭 변경 시 저장 및 데이터 새로고침
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('devotion_tab', tabId);
    setIsLoading(true);
    setError(null);
  };

  // 묵상 데이터 가져오기
  useEffect(() => {
    const fetchDevotion = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      try {
        const res = await fetch(`/api/devotion?date=${today}&type=${activeTab}`);
        const result = await res.json();

        if (result.success) {
          setDevotion(result.data);
          setError(null);
        } else {
          setError(result.error);
          setDevotion(null);
        }
      } catch (err) {
        console.error('Failed to fetch devotion:', err);
        setError('묵상 데이터를 불러올 수 없습니다.');
        setDevotion(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDevotion();
  }, [activeTab]);

  // 히스토리 펼칠 때 로드
  useEffect(() => {
    if (showHistory && history.length === 0) {
      setHistoryLoading(true);
      fetch(`/api/devotion/history?student=${studentCode}&limit=7`)
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setHistory(result.data);
          }
        })
        .catch(err => console.error('Failed to fetch history:', err))
        .finally(() => setHistoryLoading(false));
    }
  }, [showHistory, studentCode, history.length]);

  const handleSaveMemo = async () => {
    if (!memo.trim()) return;

    setIsSaving(true);
    // TODO: Google Sheets API로 저장
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSaving(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // 로딩 상태
  if (isLoading) {
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

  // 에러 상태 (폴백 UI)
  if (error) {
    return (
      <div className="card overflow-hidden">
        <div className="h-1 bg-subj-history" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-caption text-text-tertiary mb-1">
                오늘의 묵상 · {format(new Date(), 'M월 d일', { locale: ko })}
              </div>
              <h3 className="text-heading text-text-primary">
                묵상 불러오기 실패
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-xl">⚠️</span>
            </div>
          </div>

          <div className="mb-4 p-4 bg-bg-sidebar rounded-lg text-center">
            <p className="text-body text-text-secondary mb-4">
              {error}
            </p>
            <a
              href={SU_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-subj-history text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              📖 성서유니온에서 직접 확인하기
            </a>
          </div>

          <p className="text-caption text-text-tertiary text-center">
            출처: 성서유니온선교회 매일성경 · © Scripture Union Korea
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-hidden">
        {/* 상단 컬러 바 */}
        <div className="h-1 bg-subj-history" />

        <div className="p-6">
          {/* 탭 선택 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3 py-1.5 text-caption rounded-pill transition-colors ${
                  activeTab === tab.id
                    ? 'bg-subj-history text-white'
                    : 'bg-bg-sidebar text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 헤더 */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-caption text-text-tertiary mb-1">
                오늘의 묵상 · {format(new Date(), 'M월 d일', { locale: ko })}
              </div>
              <h3 className="text-heading text-text-primary">
                {devotion?.title || '오늘의 묵상'}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-subj-history-light flex items-center justify-center">
              <span className="text-xl">📖</span>
            </div>
          </div>

          {/* 본문 - 스크롤 가능 영역 */}
          <div className="mb-2 p-4 bg-bg-sidebar rounded-lg">
            <div className="text-subheading text-subj-history mb-2">
              {devotion?.scripture || '본문'}
            </div>
            {devotion?.verses && devotion.verses.length > 0 && (
              <div className="relative">
                <div className="max-h-[200px] overflow-y-auto text-body text-text-secondary pr-2 scrollbar-thin">
                  {devotion.verses.map((v, idx) => (
                    <span key={idx}>
                      <sup className="text-subj-history font-medium mr-1">{v.verse}</sup>
                      {v.text}{' '}
                    </span>
                  ))}
                </div>
                {/* 그라데이션 힌트 */}
                {devotion.verses.length > 3 && (
                  <div className="absolute bottom-0 left-0 right-2 h-8 bg-gradient-to-t from-bg-sidebar to-transparent pointer-events-none" />
                )}
              </div>
            )}
          </div>

          {/* 전체 보기 버튼 */}
          {devotion?.verses && devotion.verses.length > 3 && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full mb-4 py-2 text-caption text-subj-history hover:bg-subj-history-light rounded-lg transition-colors"
            >
              전체 보기 ({devotion.verses.length}절)
            </button>
          )}

          {/* 해설 링크 */}
          <a
            href={SU_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 mb-4 bg-bg-sidebar rounded-lg text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <span>📖</span>
            <span className="text-body">해설 읽기 → 성서유니온 매일성경</span>
          </a>

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

          {/* 이전 묵상 메모 아코디언 */}
          <div className="mt-4 border-t border-border-subtle pt-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-caption text-text-tertiary flex items-center gap-2">
                📝 이전 묵상 메모
              </span>
              <span className={`text-text-tertiary transition-transform ${showHistory ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {showHistory && (
              <div className="mt-3 space-y-3">
                {historyLoading ? (
                  <div className="text-caption text-text-tertiary text-center py-4">
                    불러오는 중...
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-caption text-text-tertiary text-center py-4">
                    아직 저장된 묵상 메모가 없습니다.
                  </div>
                ) : (
                  history.map((item, idx) => (
                    <div key={idx} className="p-3 bg-bg-sidebar rounded-lg">
                      <div className="text-caption text-subj-history mb-1">
                        {item.date} · {item.passage}
                      </div>
                      <p className="text-body text-text-secondary">
                        {item.memo}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 출처 */}
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <p className="text-caption text-text-tertiary text-center">
              출처: 성서유니온선교회 매일성경 · © Scripture Union Korea
            </p>
          </div>
        </div>

        {/* 토스트 */}
        {showToast && (
          <div className="toast">
            묵상 메모가 저장되었습니다!
          </div>
        )}
      </div>

      {/* 본문 전체 보기 모달 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-bg-page rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <div>
                <h3 className="text-heading text-text-primary">
                  {devotion?.title}
                </h3>
                <p className="text-caption text-subj-history">
                  {devotion?.scripture}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-hover"
              >
                ✕
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="text-lg leading-relaxed text-text-primary">
                {devotion?.verses?.map((v, idx) => (
                  <p key={idx} className="mb-3">
                    <sup className="text-subj-history font-semibold mr-1">{v.verse}</sup>
                    {v.text}
                  </p>
                ))}
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="p-4 border-t border-border-subtle text-center">
              <a
                href={SU_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="text-caption text-subj-history hover:underline"
              >
                📖 해설 읽기 → 성서유니온
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
