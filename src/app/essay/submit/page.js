'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';

const ESSAY_TRACKS = [
  {
    value: 'general',
    icon: '📝',
    label: '일반 에세이',
    labelEn: 'General Essay',
    desc: '자유 주제로 글쓰기',
    descEn: 'Express your thoughts freely'
  },
  {
    value: 'book_response',
    icon: '📚',
    label: '독서 에세이',
    labelEn: 'Book Response',
    desc: '책 읽고 생각 쓰기',
    descEn: 'Analyze and respond to a book'
  },
  {
    value: 'argumentative',
    icon: '📋',
    label: '입시 논술',
    labelEn: 'Argumentative',
    desc: '제시문 분석하기',
    descEn: 'Analyze given passages'
  },
];

const GRADE_BANDS = [
  { value: 'elementary', label: '초등 (K-5)', labelEn: 'Elementary' },
  { value: 'middle', label: '중등 (6-8)', labelEn: 'Middle School' },
  { value: 'high', label: '고등 (9-12)', labelEn: 'High School' },
];

const SAMPLE_PROMPTS = {
  general: {
    ko: '학교에서 휴대폰 사용을 허용해야 할까요? 당신의 의견을 논리적으로 서술하세요.',
    en: 'Should students be required to wear school uniforms? Explain your position.'
  },
  book_response: {
    ko: '최근 읽은 책에서 가장 인상 깊었던 장면을 선택하고, 그 장면이 당신에게 어떤 의미를 주었는지 서술하세요.',
    en: 'Choose the most memorable scene from a book you recently read and explain what it meant to you.'
  },
  argumentative: {
    ko: '제시문 (가)와 (나)의 관점을 비교·분석하고, 이를 바탕으로 자신의 견해를 논술하시오. (600자 안팎)',
    en: 'Compare and analyze the perspectives in passages (A) and (B), then develop your own argument.'
  }
};

export default function EssaySubmitPage() {
  const router = useRouter();
  const [language, setLanguage] = useState('ko');
  const [gradeBand, setGradeBand] = useState('high');
  const [essayType, setEssayType] = useState('general');
  const [promptText, setPromptText] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [essayText, setEssayText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wordCount = essayText.trim().split(/\s+/).filter(w => w).length;
  const charCount = essayText.length;
  const minWords = language === 'en' ? 50 : 0;
  const minChars = language === 'ko' ? 50 : 0;

  const isValid = (language === 'en' && wordCount >= minWords) ||
                  (language === 'ko' && charCount >= minChars);

  const handleSubmit = async () => {
    if (!isValid) {
      setError(language === 'en' ? `최소 ${minWords}단어 이상 작성하세요` : `최소 ${minChars}자 이상 작성하세요`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/essay-scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade_band: gradeBand,
          language: language,
          essay_type: essayType,
          prompt_text: promptText,
          book_title: essayType === 'book_response' ? bookTitle : undefined,
          essay_text: essayText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '채점 중 오류가 발생했습니다');
      }

      sessionStorage.setItem('essayResult', JSON.stringify(data));
      sessionStorage.setItem('essayText', essayText);
      router.push('/essay/result');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const useSamplePrompt = () => {
    const sample = SAMPLE_PROMPTS[essayType];
    setPromptText(language === 'ko' ? sample.ko : sample.en);
  };

  const selectedTrack = ESSAY_TRACKS.find(t => t.value === essayType);

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard" className="text-caption text-text-tertiary hover:text-text-secondary mb-2 inline-block">
            ← 대시보드
          </Link>
          <h1 className="text-display text-text-primary">에세이 제출</h1>
          <p className="text-body text-text-secondary mt-1">
            AI가 5가지 기준으로 에세이를 채점합니다
          </p>
        </div>

        {/* Track Selection */}
        <div className="mb-6">
          <label className="text-subheading text-text-primary mb-3 block">에세이 유형</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ESSAY_TRACKS.map(track => (
              <button
                key={track.value}
                onClick={() => setEssayType(track.value)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  essayType === track.value
                    ? 'border-info bg-info-light'
                    : 'border-border-subtle hover:border-text-tertiary'
                }`}
              >
                <div className="text-2xl mb-2">{track.icon}</div>
                <div className="text-subheading text-text-primary">
                  {language === 'ko' ? track.label : track.labelEn}
                </div>
                <div className="text-caption text-text-tertiary">
                  {language === 'ko' ? track.desc : track.descEn}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="card p-5 mb-6">
          <h2 className="text-subheading text-text-primary mb-4">설정</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Language */}
            <div>
              <label className="text-caption text-text-secondary mb-2 block">언어</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLanguage('ko')}
                  className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                    language === 'ko'
                      ? 'bg-text-primary text-bg-card border-text-primary'
                      : 'border-border-subtle text-text-secondary hover:bg-bg-sidebar'
                  }`}
                >
                  한국어
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                    language === 'en'
                      ? 'bg-text-primary text-bg-card border-text-primary'
                      : 'border-border-subtle text-text-secondary hover:bg-bg-sidebar'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Grade Band */}
            <div>
              <label className="text-caption text-text-secondary mb-2 block">학년 수준</label>
              <select
                value={gradeBand}
                onChange={(e) => setGradeBand(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-border-subtle bg-bg-card text-text-primary"
              >
                {GRADE_BANDS.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Book Title (for book_response) */}
        {essayType === 'book_response' && (
          <div className="card p-5 mb-6">
            <label className="text-subheading text-text-primary mb-3 block">
              책 제목 <span className="text-caption text-text-tertiary">(필수)</span>
            </label>
            <input
              type="text"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="읽은 책의 제목을 입력하세요"
              className="w-full py-2 px-3 rounded-lg border border-border-subtle bg-bg-card text-text-primary focus:outline-none focus:ring-2 focus:ring-info"
            />
          </div>
        )}

        {/* Prompt */}
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-subheading text-text-primary">
              {essayType === 'argumentative' ? '제시문' : '프롬프트'}{' '}
              <span className="text-caption text-text-tertiary">(선택)</span>
            </label>
            <button
              onClick={useSamplePrompt}
              className="text-caption text-info hover:underline"
            >
              예시 사용
            </button>
          </div>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder={
              essayType === 'argumentative'
                ? '제시문 (가), (나) 등을 입력하세요...'
                : essayType === 'book_response'
                ? '독후감 주제나 질문을 입력하세요...'
                : '주제를 입력하세요...'
            }
            className="w-full h-24 p-3 rounded-lg border border-border-subtle bg-bg-card text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-info"
          />
        </div>

        {/* Essay Input */}
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-subheading text-text-primary">에세이</label>
            <span className={`text-caption ${isValid ? 'text-success' : 'text-text-tertiary'}`}>
              {language === 'en' ? `${wordCount} 단어` : `${charCount} 자`}
              {!isValid && (language === 'en' ? ` (최소 ${minWords})` : ` (최소 ${minChars})`)}
            </span>
          </div>
          <textarea
            value={essayText}
            onChange={(e) => setEssayText(e.target.value)}
            placeholder="여기에 에세이를 작성하세요..."
            className="w-full h-64 p-4 rounded-lg border border-border-subtle bg-bg-card text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-info font-mono text-sm leading-relaxed"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-caption">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !isValid || (essayType === 'book_response' && !bookTitle.trim())}
          className={`w-full py-4 rounded-lg text-subheading font-medium transition-colors ${
            loading || !isValid || (essayType === 'book_response' && !bookTitle.trim())
              ? 'bg-bg-sidebar text-text-tertiary cursor-not-allowed'
              : 'bg-text-primary text-bg-card hover:opacity-90'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-bg-card border-t-transparent" />
              채점 중...
            </span>
          ) : (
            '제출하고 채점받기'
          )}
        </button>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-info-light rounded-lg">
          <div className="flex gap-3">
            <span className="text-xl">{selectedTrack?.icon}</span>
            <div>
              <h3 className="text-subheading text-info mb-1">
                {language === 'ko' ? selectedTrack?.label : selectedTrack?.labelEn} 채점 기준
              </h3>
              <ul className="text-caption text-text-secondary space-y-1">
                {essayType === 'general' && (
                  <>
                    <li>• 주제 충실도 (20점) - 명확한 주제문과 일관된 논증</li>
                    <li>• 독자 인식 (15점) - 적절한 어조와 표현</li>
                    <li>• 표현력 (20점) - 개성 있는 문체, 정확한 문법</li>
                    <li>• 구조 (25점) - 서론/본론/결론, 문단, 전환</li>
                    <li>• 근거 활용 (20점) - 구체적 예시와 근거</li>
                  </>
                )}
                {essayType === 'book_response' && (
                  <>
                    <li>• 텍스트 이해도 (20점) - 책 내용과 작가 의도 파악</li>
                    <li>• 비평적 관점 (15점) - 독창적 해석과 분석</li>
                    <li>• 개인 연결 (20점) - 자신의 삶과 연결</li>
                    <li>• 구조 (25점) - 서론/본론/결론 구성</li>
                    <li>• 텍스트 근거 (20점) - 인용과 구체적 장면 활용</li>
                  </>
                )}
                {essayType === 'argumentative' && (
                  <>
                    <li>• 독해력 (20점) - 제시문 핵심 내용 파악</li>
                    <li>• 비판적 사고 (15점) - 다양한 관점 비교·분석</li>
                    <li>• 종합적 재구성 (20점) - 제시문 통합 및 새 관점 도출</li>
                    <li>• 논리력 (25점) - 논증 구조와 타당성</li>
                    <li>• 표현력 (20점) - 문장력, 문법, 맞춤법</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
