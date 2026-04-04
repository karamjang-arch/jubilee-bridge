'use client';

import { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { useProfile } from '@/hooks/useProfile';

// 학년별 추천 레벨
const GRADE_LEVEL_RECOMMENDATIONS = {
  6: { maxLevel: 1, totalWords: 493, label: 'Level 1 (Oxford Essential)' },
  7: { maxLevel: 1, totalWords: 493, label: 'Level 1 (Oxford Essential)' },
  8: { maxLevel: 2, totalWords: 917, label: 'Level 1+2' },
  9: { maxLevel: 2, totalWords: 917, label: 'Level 1+2' },
  10: { maxLevel: 4, totalWords: 1967, label: 'Level 1~4' },
  11: { maxLevel: 4, totalWords: 1967, label: 'Level 1~4' },
  12: { maxLevel: 5, totalWords: 2130, label: '전체 (2,130)' },
};

// 목표 기간 옵션
const TARGET_PERIODS = [
  { days: 100, label: '100일' },
  { days: 60, label: '2달' },
  { days: 180, label: '6개월' },
  { days: 365, label: '1년' },
  { days: 730, label: '2년' },
  { days: 1095, label: '3년' },
];

// 외부 링크 생성
const getExternalLinks = (word) => [
  { name: 'PlayPhrase.me', icon: '▶️', url: `https://www.playphrase.me/#/search?q=${encodeURIComponent(word)}`, desc: '영화/드라마에서 듣기' },
  { name: 'Youglish', icon: '🎙️', url: `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`, desc: '원어민 발음' },
  { name: 'NYT', icon: '📰', url: `https://www.nytimes.com/search?query=${encodeURIComponent(word)}`, desc: '뉴스에서 보기' },
  { name: 'Merriam-Webster', icon: '📖', url: `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`, desc: '사전' },
];

export default function WordsPage() {
  const { profile, studentId, isLoading: profileLoading } = useProfile();
  const [mode, setMode] = useState('loading'); // loading, setup, cards, learn, search
  const [wordSettings, setWordSettings] = useState(null);
  const [words, setWords] = useState([]);
  const [todayWords, setTodayWords] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardPhase, setCardPhase] = useState('question'); // question, quiz, result, learn
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [myVocabulary, setMyVocabulary] = useState({});

  // 설정 로드
  useEffect(() => {
    if (profileLoading || !studentId) return;

    // localStorage에서 설정 로드
    const savedSettings = localStorage.getItem(`jb_word_settings_${studentId}`);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setWordSettings(settings);
      setMode('loading');
      loadWords(settings.maxLevel);
    } else {
      setMode('setup');
    }
  }, [profileLoading, studentId]);

  // 단어 로드
  const loadWords = useCallback(async (maxLevel) => {
    try {
      const res = await fetch('/api/words');
      const data = await res.json();

      // 레벨 필터링
      const filtered = data.words.filter(w => w.level <= maxLevel);
      setWords(filtered);

      // 오늘의 단어 선택
      selectTodayWords(filtered);
      setMode('cards');
    } catch (error) {
      console.error('Failed to load words:', error);
    }
  }, []);

  // 오늘의 단어 선택 (간단 버전: 랜덤)
  const selectTodayWords = useCallback((allWords) => {
    // TODO: 스페이스 리피티션 적용
    const shuffled = [...allWords].sort(() => Math.random() - 0.5);
    const dailyCount = wordSettings?.dailyCount || 6;
    setTodayWords(shuffled.slice(0, dailyCount));
    setCurrentCardIndex(0);
    setCardPhase('question');
  }, [wordSettings]);

  // 설정 저장
  const saveSettings = (settings) => {
    localStorage.setItem(`jb_word_settings_${studentId}`, JSON.stringify(settings));
    setWordSettings(settings);
    setMode('loading');
    loadWords(settings.maxLevel);
  };

  // 검색
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const q = query.toLowerCase();
    const results = words.filter(w =>
      w.word.toLowerCase().includes(q) ||
      w.definition_en?.toLowerCase().includes(q) ||
      w.definition_ko?.includes(q)
    ).slice(0, 20);
    setSearchResults(results);
  }, [words]);

  // 카드 응답 처리
  const handleCardResponse = (knowsIt) => {
    if (knowsIt) {
      // "알아요" → 퀴즈 출제
      setCardPhase('quiz');
    } else {
      // "모르겠어요" → 학습 페이지
      setSelectedWord(todayWords[currentCardIndex]);
      setCardPhase('learn');
    }
  };

  // 퀴즈 답안 제출
  const submitQuizAnswer = () => {
    const word = todayWords[currentCardIndex];
    const correct = selectedAnswer === word.definition_en;

    if (correct) {
      // 정답 → 마스터
      setCardPhase('result');
    } else {
      // 오답 → 학습
      setSelectedWord(word);
      setCardPhase('learn');
    }
  };

  // 다음 카드
  const nextCard = () => {
    if (currentCardIndex < todayWords.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setCardPhase('question');
      setSelectedAnswer(null);
    } else {
      // 모든 카드 완료
      setMode('complete');
    }
  };

  // 학습 완료
  const completeLearn = () => {
    setCardPhase('quiz');
    setSelectedAnswer(null);
  };

  // 퀴즈 선택지 생성
  const generateQuizChoices = (correctWord) => {
    const otherWords = words.filter(w => w.word !== correctWord.word);
    const shuffled = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [...shuffled.map(w => w.definition_en), correctWord.definition_en];
    return choices.sort(() => Math.random() - 0.5);
  };

  const currentWord = todayWords[currentCardIndex];
  const quizChoices = currentWord ? generateQuizChoices(currentWord) : [];
  const grade = profile?.grade || 10;
  const recommendation = GRADE_LEVEL_RECOMMENDATIONS[grade] || GRADE_LEVEL_RECOMMENDATIONS[10];

  return (
    <div className="min-h-screen bg-bg-page">
      <Navigation />

      {/* 로딩 */}
      {mode === 'loading' && (
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <div className="text-text-tertiary">단어 로딩 중...</div>
        </div>
      )}

      {/* 설정 (온보딩) */}
      {mode === 'setup' && (
        <div className="max-w-lg mx-auto p-6 pt-12">
          <div className="text-center mb-8">
            <h1 className="text-display text-text-primary mb-2">📖 단어 학습</h1>
            <p className="text-body text-text-secondary">
              몇 개의 단어를 어떤 속도로 외울까요?
            </p>
          </div>

          <SetupWizard
            grade={grade}
            recommendation={recommendation}
            onComplete={saveSettings}
          />
        </div>
      )}

      {/* 카드 모드 */}
      {mode === 'cards' && currentWord && (
        <div className="max-w-md mx-auto p-6 pt-8">
          {/* 진행 상황 */}
          <div className="mb-6">
            <div className="flex justify-between text-caption text-text-tertiary mb-2">
              <span>오늘의 단어 Day {wordSettings?.startDay || 1}</span>
              <span>{currentCardIndex + 1} / {todayWords.length}</span>
            </div>
            <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-subj-english transition-all"
                style={{ width: `${((currentCardIndex + 1) / todayWords.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 카드 */}
          <div className="card p-8 text-center">
            {cardPhase === 'question' && (
              <>
                <div className="text-4xl font-serif font-bold text-text-primary mb-6">
                  {currentWord.word}
                </div>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => handleCardResponse(true)}
                    className="flex-1 btn bg-success text-white"
                  >
                    알아요
                  </button>
                  <button
                    onClick={() => handleCardResponse(false)}
                    className="flex-1 btn bg-warning text-white"
                  >
                    모르겠어요
                  </button>
                </div>
              </>
            )}

            {cardPhase === 'quiz' && (
              <>
                <div className="text-2xl font-serif font-bold text-text-primary mb-2">
                  {currentWord.word}
                </div>
                <p className="text-body text-text-tertiary mb-6">뜻을 선택하세요</p>

                <div className="space-y-3 text-left mb-6">
                  {quizChoices.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedAnswer(choice)}
                      className={`w-full p-3 rounded-lg transition-all text-left ${
                        selectedAnswer === choice
                          ? 'bg-subj-english-light border-2 border-subj-english'
                          : 'bg-bg-sidebar hover:bg-bg-hover border-2 border-transparent'
                      }`}
                    >
                      <span className="text-body text-text-primary">{choice}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={submitQuizAnswer}
                  disabled={!selectedAnswer}
                  className="w-full btn bg-subj-english text-white disabled:opacity-50"
                >
                  확인
                </button>
              </>
            )}

            {cardPhase === 'result' && (
              <>
                <div className="text-5xl mb-4">✅</div>
                <div className="text-2xl font-serif font-bold text-success mb-2">
                  마스터!
                </div>
                <p className="text-body text-text-secondary mb-6">
                  {currentWord.word} - {currentWord.definition_ko}
                </p>
                <button
                  onClick={nextCard}
                  className="w-full btn bg-subj-english text-white"
                >
                  다음 단어
                </button>
              </>
            )}

            {cardPhase === 'learn' && selectedWord && (
              <WordLearningCard
                word={selectedWord}
                onComplete={completeLearn}
              />
            )}
          </div>

          {/* 검색 바로가기 */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setMode('search')}
              className="text-caption text-text-tertiary hover:text-text-primary"
            >
              🔍 단어 검색
            </button>
          </div>
        </div>
      )}

      {/* 완료 */}
      {mode === 'complete' && (
        <div className="max-w-md mx-auto p-6 pt-12 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-heading text-text-primary mb-2">오늘의 학습 완료!</h2>
          <p className="text-body text-text-secondary mb-8">
            {todayWords.length}개의 단어를 학습했습니다.
          </p>
          <button
            onClick={() => {
              selectTodayWords(words);
              setMode('cards');
            }}
            className="btn bg-subj-english text-white"
          >
            더 학습하기
          </button>
        </div>
      )}

      {/* 검색 모드 */}
      {mode === 'search' && (
        <div className="max-w-lg mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setMode('cards')}
              className="text-text-tertiary hover:text-text-primary"
            >
              ←
            </button>
            <h2 className="text-heading text-text-primary">단어 검색</h2>
          </div>

          <div className="relative mb-6">
            <input
              type="text"
              placeholder="읽다가 모르는 단어를 검색해보세요"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-3 bg-bg-card border border-border-subtle rounded-lg text-body focus:border-subj-english focus:outline-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary">🔍</span>
          </div>

          <div className="space-y-2">
            {searchResults.map((word, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedWord(word);
                  setCardPhase('learn');
                  setMode('cards');
                }}
                className="w-full p-4 bg-bg-card rounded-lg text-left hover:bg-bg-hover transition-colors"
              >
                <div className="font-bold text-text-primary">{word.word}</div>
                <div className="text-caption text-text-secondary">{word.definition_ko}</div>
              </button>
            ))}

            {searchQuery && searchResults.length === 0 && (
              <div className="text-center py-8 text-text-tertiary">
                <p className="mb-2">이 단어는 아직 DB에 없어요</p>
                <a
                  href={`https://www.merriam-webster.com/dictionary/${encodeURIComponent(searchQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-subj-english hover:underline"
                >
                  Merriam-Webster에서 검색
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 설정 위자드 컴포넌트
function SetupWizard({ grade, recommendation, onComplete }) {
  const [step, setStep] = useState(1);
  const [maxLevel, setMaxLevel] = useState(recommendation.maxLevel);
  const [targetDays, setTargetDays] = useState(365);

  const levelOptions = [
    { level: 1, label: 'Level 1 (Oxford Essential)', count: 493 },
    { level: 2, label: 'Level 1+2', count: 917 },
    { level: 3, label: 'Level 1+2+3', count: 1133 },
    { level: 4, label: 'Level 1~4 (SAT 준비)', count: 1967 },
    { level: 5, label: '전체 (고급)', count: 2130 },
  ];

  const selectedLevel = levelOptions.find(l => l.level === maxLevel);
  const dailyNew = Math.ceil(selectedLevel.count / targetDays);
  const dailyTotal = Math.ceil(dailyNew * 1.5); // 새 단어 + 복습

  const handleComplete = () => {
    onComplete({
      maxLevel,
      targetDays,
      dailyCount: dailyTotal,
      totalWords: selectedLevel.count,
      startDay: 1,
      startDate: new Date().toISOString(),
    });
  };

  return (
    <div className="card p-6">
      {step === 1 && (
        <>
          <h3 className="text-subheading text-text-primary mb-4">목표 단어 범위</h3>
          <p className="text-caption text-text-tertiary mb-4">
            {grade}학년 추천: {recommendation.label}
          </p>

          <div className="space-y-2 mb-6">
            {levelOptions.map(opt => (
              <button
                key={opt.level}
                onClick={() => setMaxLevel(opt.level)}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  maxLevel === opt.level
                    ? 'bg-subj-english-light border-2 border-subj-english'
                    : 'bg-bg-sidebar hover:bg-bg-hover border-2 border-transparent'
                }`}
              >
                <div className="text-body text-text-primary">{opt.label}</div>
                <div className="text-caption text-text-tertiary">{opt.count}단어</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full btn bg-subj-english text-white"
          >
            다음
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h3 className="text-subheading text-text-primary mb-4">목표 기간</h3>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {TARGET_PERIODS.map(period => (
              <button
                key={period.days}
                onClick={() => setTargetDays(period.days)}
                className={`p-3 rounded-lg text-center transition-all ${
                  targetDays === period.days
                    ? 'bg-subj-english text-white'
                    : 'bg-bg-sidebar text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className="p-4 bg-bg-sidebar rounded-lg mb-6 text-center">
            <div className="text-stat text-subj-english">{dailyTotal}단어/일</div>
            <div className="text-caption text-text-tertiary">
              새 단어 {dailyNew} + 복습 {dailyTotal - dailyNew}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 btn btn-secondary"
            >
              이전
            </button>
            <button
              onClick={handleComplete}
              className="flex-1 btn bg-subj-english text-white"
            >
              시작하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// 단어 학습 카드 컴포넌트
function WordLearningCard({ word, onComplete }) {
  const links = getExternalLinks(word.word);

  return (
    <div className="text-left">
      <div className="text-3xl font-serif font-bold text-text-primary mb-1">
        {word.word}
      </div>
      <div className="text-caption text-text-tertiary mb-4">
        ({word.part_of_speech})
      </div>

      <div className="mb-4">
        <div className="text-caption text-subj-english font-medium mb-1">📖 뜻</div>
        <p className="text-body text-text-primary mb-1">{word.definition_en}</p>
        <p className="text-body text-text-secondary">{word.definition_ko}</p>
      </div>

      {word.example_sentence && (
        <div className="mb-4">
          <div className="text-caption text-subj-english font-medium mb-1">📝 예문</div>
          <p className="text-body text-text-secondary italic">"{word.example_sentence}"</p>
        </div>
      )}

      {word.word_family?.length > 0 && (
        <div className="mb-4">
          <div className="text-caption text-subj-english font-medium mb-1">👪 Word Family</div>
          <div className="flex flex-wrap gap-2">
            {word.word_family.map((w, i) => (
              <span key={i} className="px-2 py-1 bg-bg-sidebar rounded text-caption text-text-secondary">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="text-caption text-subj-english font-medium mb-2">🔗 살아있는 영어</div>
        <div className="grid grid-cols-2 gap-2">
          {links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-bg-sidebar rounded-lg hover:bg-bg-hover transition-colors"
            >
              <div className="text-caption font-medium">{link.icon} {link.name}</div>
              <div className="text-xs text-text-tertiary">{link.desc}</div>
            </a>
          ))}
        </div>
      </div>

      <button
        onClick={onComplete}
        className="w-full btn bg-subj-english text-white"
      >
        학습 완료 → 퀴즈
      </button>
    </div>
  );
}
