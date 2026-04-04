'use client';

import { useState } from 'react';

// 샘플 단어 데이터 (실제로는 Word DB JSON에서 가져옴)
const SAMPLE_WORDS = {
  'abash': {
    word: 'abash',
    definition_en: 'to make ashamed; to embarrass',
    definition_ko: '부끄럽게 하다, 당황하게 하다',
    part_of_speech: 'verb',
    difficulty: 'sat_advanced',
    word_family: ['unabashedly'],
    example_sentence: 'Meredith felt abashed by her inability to remember her lines.',
    source: 'word_smart_1',
  },
  'aberration': {
    word: 'aberration',
    definition_en: 'something not typical; a deviation from the standard',
    definition_ko: '전형적이지 않은 것, 표준에서 벗어난 것',
    part_of_speech: 'noun',
    difficulty: 'sat_advanced',
    word_family: ['aberrant'],
    example_sentence: "Søren's bad behavior was an aberration.",
    source: 'word_smart_1',
  },
};

export default function WordPopup({ word, onClose, onAddToVocabulary }) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const wordData = SAMPLE_WORDS[word?.toLowerCase()] || {
    word: word,
    definition_en: 'Definition not found',
    definition_ko: '정의를 찾을 수 없습니다',
    part_of_speech: 'unknown',
    difficulty: 'unknown',
    word_family: [],
    example_sentence: '',
    source: 'unknown',
  };

  // Gemini 프롬프트 복사
  const copyGeminiPrompt = async () => {
    const prompt = `다음 영어 단어를 학습해주세요.

**단어:** ${wordData.word}
**품사:** ${wordData.part_of_speech}
**뜻:** ${wordData.definition_en} / ${wordData.definition_ko}

다음을 포함해서 설명해주세요:
1. 어원과 기억하기 좋은 방법
2. 비슷한 단어와 헷갈리는 단어
3. SAT/AP 시험에서 자주 나오는 용법
4. 예문 3개
5. 연습 문제 1개`;

    try {
      await navigator.clipboard.writeText(prompt);
      setToastMessage('Gemini 프롬프트 복사됨!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 내 단어장에 추가
  const handleAddToVocabulary = async () => {
    // TODO: Google Sheets에 저장
    onAddToVocabulary?.(wordData);
    setToastMessage('내 단어장에 추가됨!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // PlayPhrase.me 링크
  const playPhraseUrl = `https://www.playphrase.me/#/search?q=${encodeURIComponent(wordData.word)}`;

  // Youglish 링크
  const youglishUrl = `https://youglish.com/pronounce/${encodeURIComponent(wordData.word)}/english`;

  return (
    <>
      {/* 배경 */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* 팝업 */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-bg-card rounded-xl shadow-elevated z-50 overflow-hidden">
        {/* 상단 바 */}
        <div className="h-1 bg-subj-english" />

        <div className="p-6">
          {/* 헤더 */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-heading text-text-primary">
                {wordData.word}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-subj-english-light text-subj-english-dark text-caption rounded">
                  {wordData.part_of_speech}
                </span>
                <span className="text-caption text-text-tertiary">
                  {wordData.difficulty === 'sat_advanced' ? 'SAT 고급' : 'SAT 기본'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-bg-hover rounded-md transition-colors"
            >
              <svg className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 정의 */}
          <div className="mb-4">
            <div className="p-4 bg-bg-sidebar rounded-lg">
              <p className="text-body text-text-primary mb-2">
                {wordData.definition_en}
              </p>
              <p className="text-body text-text-secondary">
                {wordData.definition_ko}
              </p>
            </div>
          </div>

          {/* 예문 */}
          {wordData.example_sentence && (
            <div className="mb-4">
              <h4 className="text-caption text-text-tertiary mb-2">예문</h4>
              <p className="text-body text-text-secondary italic">
                "{wordData.example_sentence}"
              </p>
            </div>
          )}

          {/* Word Family */}
          {wordData.word_family?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-caption text-text-tertiary mb-2">관련 단어</h4>
              <div className="flex flex-wrap gap-2">
                {wordData.word_family.map((w) => (
                  <span
                    key={w}
                    className="px-3 py-1 bg-bg-hover text-text-secondary text-caption rounded-pill"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 외부 링크 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <a
              href={playPhraseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary text-center"
            >
              🎬 PlayPhrase
            </a>
            <a
              href={youglishUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary text-center"
            >
              🎧 Youglish
            </a>
          </div>

          {/* 액션 버튼 */}
          <div className="border-t border-border-subtle pt-4 space-y-2">
            <button
              onClick={copyGeminiPrompt}
              className="w-full btn btn-secondary justify-between"
            >
              <span>💡 Gemini에 연습하기</span>
              <span className="text-text-tertiary">복사</span>
            </button>
            <button
              onClick={handleAddToVocabulary}
              className="w-full btn text-white"
              style={{ backgroundColor: 'var(--subj-english)' }}
            >
              📚 내 단어장에 추가
            </button>
          </div>
        </div>
      </div>

      {/* 토스트 */}
      {showToast && (
        <div className="toast z-50">
          {toastMessage}
        </div>
      )}
    </>
  );
}
