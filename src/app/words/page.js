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

// 스페이스 리피티션 인터벌 (일)
const INTERVALS = {
  wrong: [1, 3, 7, 14, 30],    // 틀렸을 때 복습 주기
  correct: [7, 30, 90],         // 맞았을 때 복습 주기
};
const REVIEW_DEBT_CAP = 20;     // 밀린 복습 최대 개수

// 외부 링크 생성
const getExternalLinks = (word) => [
  { name: 'PlayPhrase.me', icon: '▶️', url: `https://www.playphrase.me/#/search?q=${encodeURIComponent(word)}`, desc: '영화/드라마에서 듣기' },
  { name: 'Youglish', icon: '🎙️', url: `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`, desc: '원어민 발음' },
  { name: 'NYT', icon: '📰', url: `https://www.nytimes.com/search?query=${encodeURIComponent(word)}`, desc: '뉴스에서 보기' },
  { name: 'Merriam-Webster', icon: '📖', url: `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`, desc: '사전' },
];

// 브라우저 TTS로 발음 재생
const speakWord = (word) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // 기존 발음 중지
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9; // 약간 느리게

  // 미국 영어 음성 찾기
  const voices = window.speechSynthesis.getVoices();
  const usVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Female'))
    || voices.find(v => v.lang === 'en-US')
    || voices.find(v => v.lang.startsWith('en'));
  if (usVoice) utterance.voice = usVoice;

  window.speechSynthesis.speak(utterance);
};

// 다음 복습 날짜 계산
const getNextReviewDate = (isCorrect, currentStreak = 0) => {
  const intervals = isCorrect ? INTERVALS.correct : INTERVALS.wrong;
  const idx = Math.min(currentStreak, intervals.length - 1);
  const days = intervals[idx];
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export default function WordsPage() {
  const { profile, studentId, isLoading: profileLoading } = useProfile();
  const [mode, setMode] = useState('loading'); // loading, setup, cards, learn, search, complete, review
  const [wordSettings, setWordSettings] = useState(null);
  const [words, setWords] = useState([]);
  const [todayWords, setTodayWords] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardPhase, setCardPhase] = useState('question'); // question, quiz1, quiz2, quiz3, result, learn
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [myVocabulary, setMyVocabulary] = useState({});

  // 날짜 네비게이션 상태
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 3단계 퀴즈 상태
  const [quizStageResults, setQuizStageResults] = useState([]); // [true/false, true/false, true/false]
  const [currentQuizChoices, setCurrentQuizChoices] = useState([]);

  // 복습 퀴즈 상태 (빈칸 채우기)
  const [reviewWords, setReviewWords] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewResults, setReviewResults] = useState([]);

  // 토스트 상태
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 토스트 표시 함수
  const toast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // 발음 코칭 프롬프트 복사
  const copyPronunciationPrompt = async (word) => {
    const prompt = `너는 PLT Coach야. Module 3 (Pronunciation Drill) 모드.

단어: "${word}"

이 단어의 발음을 가르쳐줘:
1. IPA 발음 기호와 음절 분리
2. 각 음소의 물리적 교정 (혀 위치, 입 모양, 호흡)
3. 한국인이 자주 틀리는 포인트
4. 비슷한 발음 단어와 비교 (minimal pairs)
5. 문장에서 연음/강세 패턴

Gemini Live에서 음성으로 연습하세요.`;

    try {
      await navigator.clipboard.writeText(prompt);
      toast('프롬프트 복사됨! Gemini Live에서 음성 연습하세요.');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // 설정 및 어휘 진행 로드
  useEffect(() => {
    if (profileLoading || !studentId) return;

    // localStorage에서 설정 로드
    const savedSettings = localStorage.getItem(`jb_word_settings_${studentId}`);
    const savedVocabulary = localStorage.getItem(`jb_vocabulary_${studentId}`);

    if (savedVocabulary) {
      setMyVocabulary(JSON.parse(savedVocabulary));
    }

    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setWordSettings(settings);
      setMode('loading');
      loadWords(settings.maxLevel);
    } else {
      setMode('setup');
    }
  }, [profileLoading, studentId]);

  // 날짜 헬퍼
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const getDayNumber = (dateStr) => {
    if (!wordSettings?.startDate) return 1;
    const start = new Date(wordSettings.startDate);
    const current = new Date(dateStr);
    return Math.floor((current - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  const isToday = (dateStr) => dateStr === new Date().toISOString().split('T')[0];
  const isFuture = (dateStr) => dateStr > new Date().toISOString().split('T')[0];
  const isPast = (dateStr) => dateStr < new Date().toISOString().split('T')[0];

  // 날짜 네비게이션
  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const newDate = d.toISOString().split('T')[0];
    setSelectedDate(newDate);
    selectWordsForDate(newDate);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const newDate = d.toISOString().split('T')[0];
    setSelectedDate(newDate);
    selectWordsForDate(newDate);
  };

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    selectWordsForDate(today);
  };

  // 특정 날짜의 단어 선택
  const selectWordsForDate = (dateStr, allWords = words, vocab = myVocabulary) => {
    const dailyCount = wordSettings?.dailyCount || 6;
    const today = new Date().toISOString().split('T')[0];

    if (dateStr === today) {
      // 오늘: 복습 + 새 단어
      const selected = doSelectTodayWords(allWords, vocab, dailyCount);
      setTodayWords(selected);
    } else if (dateStr > today) {
      // 미래: 새 단어만 미리보기 (레벨 순서)
      const newWords = allWords.filter(w => !vocab[w.word]);
      const dayOffset = Math.floor((new Date(dateStr) - new Date(today)) / (1000 * 60 * 60 * 24));
      const startIdx = dayOffset * dailyCount;
      const selected = newWords.slice(startIdx, startIdx + dailyCount);
      setTodayWords(selected);
    } else {
      // 과거: 해당 날짜에 학습한 단어 (last_reviewed 기준)
      const learnedOnDate = allWords.filter(w => {
        const v = vocab[w.word];
        return v && v.last_reviewed && v.last_reviewed.startsWith(dateStr);
      });
      setTodayWords(learnedOnDate.length > 0 ? learnedOnDate : []);
    }

    setCurrentCardIndex(0);
    setCardPhase('question');
    setQuizStageResults([]);
    setSelectedAnswer(null);
  };

  // 오늘의 단어 선택 헬퍼 (순수 함수로 분리)
  const doSelectTodayWords = (allWords, vocab, dailyCount) => {
    const today = new Date().toISOString().split('T')[0];

    // 1. 복습이 필요한 단어 (next_review <= 오늘)
    const dueForReview = allWords.filter(w => {
      const v = vocab[w.word];
      return v && v.next_review && v.next_review <= today && v.status !== 'mastered';
    }).sort((a, b) => {
      return (vocab[a.word]?.next_review || '').localeCompare(vocab[b.word]?.next_review || '');
    });

    // 복습 부채 캡 적용
    const reviewWords = dueForReview.slice(0, REVIEW_DEBT_CAP);

    // 2. 새 단어 (아직 본 적 없는 단어)
    const newWords = allWords.filter(w => !vocab[w.word]);

    // 3. 60% 새 단어 + 40% 복습 (또는 가용량에 따라 조정)
    const targetNew = Math.ceil(dailyCount * 0.6);
    const targetReview = dailyCount - targetNew;

    const selectedNew = newWords.slice(0, Math.min(targetNew, dailyCount - reviewWords.length));
    const selectedReview = reviewWords.slice(0, Math.min(targetReview, dailyCount - selectedNew.length));

    let combined = [...selectedReview, ...selectedNew];
    if (combined.length < dailyCount && reviewWords.length > selectedReview.length) {
      const moreReview = reviewWords.slice(selectedReview.length, selectedReview.length + (dailyCount - combined.length));
      combined = [...combined, ...moreReview];
    }
    if (combined.length < dailyCount && newWords.length > selectedNew.length) {
      const moreNew = newWords.slice(selectedNew.length, selectedNew.length + (dailyCount - combined.length));
      combined = [...combined, ...moreNew];
    }

    return combined;
  };

  // 단어 로드
  const loadWords = useCallback(async (maxLevel) => {
    try {
      const res = await fetch('/api/words?all=true');
      const data = await res.json();

      // 레벨 필터링
      const filtered = data.words.filter(w => w.level <= maxLevel);
      setWords(filtered);

      // localStorage에서 저장된 어휘 로드
      const savedVocab = localStorage.getItem(`jb_vocabulary_${studentId}`);
      const vocab = savedVocab ? JSON.parse(savedVocab) : {};
      const savedSettings = localStorage.getItem(`jb_word_settings_${studentId}`);
      const settings = savedSettings ? JSON.parse(savedSettings) : { dailyCount: 6 };

      // 오늘의 단어 선택
      const selected = doSelectTodayWords(filtered, vocab, settings.dailyCount);
      setTodayWords(selected);
      setCurrentCardIndex(0);
      setCardPhase('question');
      setMode('cards');
    } catch (error) {
      console.error('Failed to load words:', error);
    }
  }, [studentId]);

  // 오늘의 단어 선택 (UI에서 호출용)
  const selectTodayWords = useCallback((allWords, vocab = myVocabulary) => {
    const dailyCount = wordSettings?.dailyCount || 6;
    const selected = doSelectTodayWords(allWords, vocab, dailyCount);
    setTodayWords(selected);
    setCurrentCardIndex(0);
    setCardPhase('question');
  }, [wordSettings, myVocabulary]);

  // 어휘 진행 저장
  const saveVocabularyProgress = useCallback((word, isCorrect) => {
    if (!studentId) return;

    const current = myVocabulary[word] || { streak: 0, status: 'new' };
    const newStreak = isCorrect ? current.streak + 1 : 0;

    // 마스터 조건: 연속 3회 정답
    const isMastered = isCorrect && newStreak >= 3;

    const updated = {
      ...myVocabulary,
      [word]: {
        streak: newStreak,
        next_review: isMastered ? null : getNextReviewDate(isCorrect, newStreak),
        status: isMastered ? 'mastered' : 'learning',
        last_reviewed: new Date().toISOString(),
      },
    };

    setMyVocabulary(updated);
    localStorage.setItem(`jb_vocabulary_${studentId}`, JSON.stringify(updated));
  }, [myVocabulary, studentId]);

  // 설정 저장
  const saveSettings = (settings) => {
    localStorage.setItem(`jb_word_settings_${studentId}`, JSON.stringify(settings));
    setWordSettings(settings);
    setMode('loading');
    loadWords(settings.maxLevel);
  };

  // 검색 (전체 DB에서 검색)
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`/api/words?search=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();
      setSearchResults(data.words || []);
    } catch (error) {
      console.error('Search failed:', error);
      // fallback: 로컬 검색
      const q = query.toLowerCase();
      const results = words.filter(w =>
        w.word.toLowerCase().includes(q) ||
        w.definition_en?.toLowerCase().includes(q) ||
        w.definition_ko?.includes(q)
      ).slice(0, 20);
      setSearchResults(results);
    }
  }, [words]);

  // 카드 응답 처리
  const handleCardResponse = (knowsIt) => {
    if (knowsIt) {
      // "알아요" → 3단계 퀴즈 시작
      setQuizStageResults([]);
      startQuizStage(1);
    } else {
      // "모르겠어요" → 학습 페이지
      setSelectedWord(todayWords[currentCardIndex]);
      setCardPhase('learn');
    }
  };

  // 3단계 퀴즈 시작
  const startQuizStage = (stage) => {
    const word = todayWords[currentCardIndex];
    setSelectedAnswer(null);

    if (stage === 1) {
      // 1차: 영어 정의 4지선다 — "abash means:"
      setCurrentQuizChoices(generateDefinitionChoices(word));
      setCardPhase('quiz1');
    } else if (stage === 2) {
      // 2차: 역방향 (한국어→영어) — "당황하게 하다" → 4지선다
      setCurrentQuizChoices(generateReverseChoices(word));
      setCardPhase('quiz2');
    } else if (stage === 3) {
      // 3차: 예문 속 의미 파악 — 예문 + "이 문장에서 abash의 의미는?" 4지선다
      setCurrentQuizChoices(generateContextMeaningChoices(word));
      setCardPhase('quiz3');
    }
  };

  // 정의 선택지 생성 (1차 퀴즈)
  const generateDefinitionChoices = (word) => {
    if (word.quiz_choices?.correct && word.quiz_choices?.wrong?.length >= 3) {
      const choices = [
        { text: word.quiz_choices.correct, isCorrect: true },
        ...word.quiz_choices.wrong.slice(0, 3).map(w => ({ text: w, isCorrect: false })),
      ];
      return choices.sort(() => Math.random() - 0.5);
    }

    const pool = words.filter(w => w.word !== word.word && Math.abs(w.level - word.level) <= 1);
    const wrong = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [
      { text: word.definition_en, isCorrect: true },
      ...wrong.map(w => ({ text: w.definition_en, isCorrect: false })),
    ];
    return choices.sort(() => Math.random() - 0.5);
  };

  // 역방향 선택지 생성 (2차 퀴즈: 한국어→영어)
  const generateReverseChoices = (word) => {
    const similar = words.filter(w =>
      w.word !== word.word &&
      w.part_of_speech === word.part_of_speech
    ).slice(0, 10);

    const wrong = similar.sort(() => Math.random() - 0.5).slice(0, 3);
    if (wrong.length < 3) {
      const more = words.filter(w => w.word !== word.word).sort(() => Math.random() - 0.5).slice(0, 3 - wrong.length);
      wrong.push(...more);
    }

    const choices = [
      { text: word.word, isCorrect: true },
      ...wrong.map(w => ({ text: w.word, isCorrect: false })),
    ];
    return choices.sort(() => Math.random() - 0.5);
  };

  // 예문 속 의미 파악 선택지 생성 (3차 퀴즈)
  const generateContextMeaningChoices = (word) => {
    // 비슷한 품사의 다른 단어들에서 오답 정의 가져오기
    const similar = words.filter(w =>
      w.word !== word.word &&
      w.part_of_speech === word.part_of_speech
    ).slice(0, 10);

    const wrong = similar.sort(() => Math.random() - 0.5).slice(0, 3);
    if (wrong.length < 3) {
      const more = words.filter(w => w.word !== word.word).sort(() => Math.random() - 0.5).slice(0, 3 - wrong.length);
      wrong.push(...more);
    }

    const choices = [
      { text: word.definition_ko, isCorrect: true },
      ...wrong.map(w => ({ text: w.definition_ko, isCorrect: false })),
    ];
    return choices.sort(() => Math.random() - 0.5);
  };

  // 빈칸 채우기 선택지 생성 (복습 퀴즈용)
  const generateFillBlankChoices = (word) => {
    const similar = words.filter(w =>
      w.word !== word.word &&
      (w.word.slice(0, 3) === word.word.slice(0, 3) || w.part_of_speech === word.part_of_speech)
    ).slice(0, 10);

    const wrong = similar.sort(() => Math.random() - 0.5).slice(0, 3);
    if (wrong.length < 3) {
      const more = words.filter(w => w.word !== word.word).sort(() => Math.random() - 0.5).slice(0, 3 - wrong.length);
      wrong.push(...more);
    }

    const choices = [
      { text: word.word, isCorrect: true },
      ...wrong.map(w => ({ text: w.word, isCorrect: false })),
    ];
    return choices.sort(() => Math.random() - 0.5);
  };

  // 퀴즈 답안 제출 (3단계 공통)
  const submitQuizAnswer = () => {
    const isCorrect = currentQuizChoices.find(c => c.text === selectedAnswer)?.isCorrect || false;
    const newResults = [...quizStageResults, isCorrect];
    setQuizStageResults(newResults);

    const stage = cardPhase === 'quiz1' ? 1 : cardPhase === 'quiz2' ? 2 : 3;

    if (stage < 3) {
      // 다음 단계로
      setTimeout(() => startQuizStage(stage + 1), 500);
    } else {
      // 3단계 완료 → 결과 처리
      const correctCount = newResults.filter(r => r).length;
      const word = todayWords[currentCardIndex];

      // 마스터 로직
      let nextReviewDays;
      let status;
      if (correctCount === 3) {
        // 3/3 → 마스터
        nextReviewDays = 30;
        status = 'mastered';
      } else if (correctCount === 2) {
        // 2/3 → 거의
        nextReviewDays = 3;
        status = 'learning';
      } else {
        // 1/3 이하 → 내일 다시
        nextReviewDays = 1;
        status = 'struggling';
      }

      // 저장
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + nextReviewDays);
      const updated = {
        ...myVocabulary,
        [word.word]: {
          ...(myVocabulary[word.word] || {}),
          streak: correctCount,
          next_review: status === 'mastered' ? null : nextDate.toISOString().split('T')[0],
          status,
          last_reviewed: new Date().toISOString(),
          last_score: correctCount,
        },
      };
      setMyVocabulary(updated);
      localStorage.setItem(`jb_vocabulary_${studentId}`, JSON.stringify(updated));

      setCardPhase('result');
    }
  };

  // 다음 카드
  const nextCard = () => {
    if (currentCardIndex < todayWords.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setCardPhase('question');
      setSelectedAnswer(null);
      setQuizStageResults([]);
    } else {
      // 모든 카드 완료
      setMode('complete');
    }
  };

  // 현재 단어 재도전 (2/3 이하일 때)
  const retryCurrentWord = () => {
    setSelectedWord(todayWords[currentCardIndex]);
    setCardPhase('learn');
  };

  // 학습 완료 → 3단계 퀴즈 재도전
  const completeLearn = () => {
    setQuizStageResults([]);
    startQuizStage(1);
  };

  // 복습 퀴즈 시작 (빈칸 채우기)
  const startReviewQuiz = () => {
    // 오늘 학습한 단어 중 랜덤 10개 선택
    const shuffled = [...todayWords].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(10, shuffled.length));
    setReviewWords(selected);
    setReviewIndex(0);
    setReviewResults([]);
    if (selected.length > 0) {
      setCurrentQuizChoices(generateFillBlankChoices(selected[0]));
    }
    setSelectedAnswer(null);
    setMode('review');
  };

  // 복습 퀴즈 답안 제출
  const submitReviewAnswer = () => {
    const word = reviewWords[reviewIndex];
    const isCorrect = currentQuizChoices.find(c => c.text === selectedAnswer)?.isCorrect || false;
    const newResults = [...reviewResults, { word: word.word, correct: isCorrect }];
    setReviewResults(newResults);

    if (reviewIndex < reviewWords.length - 1) {
      // 다음 문제
      const nextWord = reviewWords[reviewIndex + 1];
      setReviewIndex(reviewIndex + 1);
      setCurrentQuizChoices(generateFillBlankChoices(nextWord));
      setSelectedAnswer(null);
    } else {
      // 복습 완료 - 결과 표시
      setCardPhase('review_result');
    }
  };

  // 퀴즈 선택지 생성 (DB 우선, 없으면 자동 생성)
  const generateQuizChoices = (correctWord) => {
    // 1. DB에 quiz_choices가 있으면 사용
    if (correctWord.quiz_choices?.correct && correctWord.quiz_choices?.wrong?.length >= 3) {
      const choices = [
        correctWord.quiz_choices.correct,
        ...correctWord.quiz_choices.wrong.slice(0, 3),
      ];
      return choices.sort(() => Math.random() - 0.5);
    }

    // 2. 없으면 자동 생성: 비슷한 레벨/품사의 단어에서 선택
    const sameLevelWords = words.filter(w =>
      w.word !== correctWord.word &&
      Math.abs(w.level - correctWord.level) <= 1
    );

    // 같은 품사 우선
    const samePos = sameLevelWords.filter(w => w.part_of_speech === correctWord.part_of_speech);
    const pool = samePos.length >= 3 ? samePos : sameLevelWords;

    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
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

      {/* 카드 모드 - 단어 없음 */}
      {mode === 'cards' && !currentWord && todayWords.length === 0 && (
        <div className="max-w-md mx-auto p-6 pt-12 text-center">
          <div className="text-5xl mb-4">📖</div>
          <h2 className="text-heading text-text-primary mb-2">오늘의 단어가 없습니다</h2>
          <p className="text-body text-text-secondary mb-6">
            모든 단어를 마스터했거나 설정에 문제가 있습니다.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                localStorage.removeItem(`jb_word_settings_${studentId}`);
                setMode('setup');
              }}
              className="w-full btn bg-subj-english text-white"
            >
              다시 설정하기
            </button>
            <button
              onClick={() => setMode('search')}
              className="w-full btn btn-secondary"
            >
              🔍 단어 검색
            </button>
          </div>
        </div>
      )}

      {/* 카드 모드 */}
      {mode === 'cards' && currentWord && (
        <div className="max-w-md mx-auto p-6 pt-4">
          {/* 날짜 네비게이션 */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevDay}
              className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded"
            >
              ◀ 어제
            </button>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`px-4 py-2 rounded-lg text-center ${
                isToday(selectedDate)
                  ? 'bg-subj-english text-white'
                  : isPast(selectedDate)
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-blue-50 text-blue-600'
              }`}
            >
              <div className="text-sm font-medium">
                {isToday(selectedDate) ? '오늘' : formatDate(selectedDate)}
              </div>
              <div className="text-xs opacity-80">Day {getDayNumber(selectedDate)}</div>
            </button>
            <button
              onClick={goToNextDay}
              className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded"
            >
              내일 ▶
            </button>
          </div>

          {/* 날짜 선택 팝업 */}
          {showDatePicker && (
            <div className="mb-4 p-3 bg-bg-sidebar rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">날짜 선택</span>
                <button
                  onClick={goToToday}
                  className="text-xs text-subj-english hover:underline"
                >
                  오늘로
                </button>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  selectWordsForDate(e.target.value);
                  setShowDatePicker(false);
                }}
                className="w-full px-3 py-2 bg-bg-card border border-border-subtle rounded text-sm"
              />
            </div>
          )}

          {/* 과거/미래 날짜 안내 */}
          {!isToday(selectedDate) && (
            <div className={`mb-4 p-3 rounded-lg text-center text-sm ${
              isPast(selectedDate) ? 'bg-gray-50 text-gray-600' : 'bg-blue-50 text-blue-600'
            }`}>
              {isPast(selectedDate)
                ? '📚 이 날 학습한 단어들입니다'
                : '👀 미리보기 모드 (새 단어만)'}
            </div>
          )}

          {/* 진행 상황 */}
          <div className="mb-6">
            <div className="flex justify-between text-caption text-text-tertiary mb-2">
              <span>{currentCardIndex + 1} / {todayWords.length}</span>
              <span>
                {!myVocabulary[currentWord.word]
                  ? '🆕 새 단어'
                  : `🔄 복습 (${myVocabulary[currentWord.word]?.last_score || 0}/3)`}
              </span>
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
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="text-4xl font-serif font-bold text-text-primary">
                    {currentWord.word}
                  </span>
                  <button
                    onClick={() => speakWord(currentWord.word)}
                    className="w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-xl transition-colors"
                    title="발음 듣기"
                  >
                    🔊
                  </button>
                </div>
                <div className="text-sm text-text-tertiary mb-2">
                  ({currentWord.part_of_speech})
                </div>
                {currentWord.ipa ? (
                  <div className="text-lg text-blue-600 font-mono mb-6">
                    {currentWord.ipa}
                  </div>
                ) : (
                  <a
                    href={`https://www.merriam-webster.com/dictionary/${encodeURIComponent(currentWord.word)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline mb-6 inline-block"
                  >
                    발음 기호 보기 →
                  </a>
                )}
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => handleCardResponse(true)}
                    className="flex-1 btn bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                  >
                    알아요
                  </button>
                  <button
                    onClick={() => handleCardResponse(false)}
                    className="flex-1 btn bg-orange-100 text-orange-700 border border-orange-300 hover:bg-orange-200"
                  >
                    모르겠어요
                  </button>
                </div>
              </>
            )}

            {/* 3단계 퀴즈 공통 UI */}
            {(cardPhase === 'quiz1' || cardPhase === 'quiz2' || cardPhase === 'quiz3') && (
              <>
                {/* 진행 표시 */}
                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3].map(stage => {
                    const currentStage = cardPhase === 'quiz1' ? 1 : cardPhase === 'quiz2' ? 2 : 3;
                    const result = quizStageResults[stage - 1];
                    return (
                      <div
                        key={stage}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          stage < currentStage
                            ? result ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            : stage === currentStage
                              ? 'bg-subj-english text-white'
                              : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {stage < currentStage ? (result ? '✓' : '✗') : stage}
                      </div>
                    );
                  })}
                </div>

                {/* 퀴즈 유형별 질문 */}
                {cardPhase === 'quiz1' && (
                  <>
                    {/* 1차: 영어 정의 — 단어 표시 */}
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="text-2xl font-serif font-bold text-text-primary">
                        {currentWord.word}
                      </span>
                      <button
                        onClick={() => speakWord(currentWord.word)}
                        className="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-lg transition-colors"
                        title="발음 듣기"
                      >
                        🔊
                      </button>
                    </div>
                    {currentWord.ipa && (
                      <div className="text-sm text-blue-600 font-mono mb-2">
                        {currentWord.ipa}
                      </div>
                    )}
                    <p className="text-body text-text-tertiary mb-4">1/3: 뜻을 선택하세요</p>
                  </>
                )}
                {cardPhase === 'quiz2' && (
                  <div className="mb-4">
                    {/* 2차: 역방향 — 한국어 뜻만 표시, 단어 숨김 */}
                    <p className="text-xs text-text-tertiary mb-2">2/3: 이 뜻의 영단어는?</p>
                    <p className="text-xl text-text-primary font-medium mb-2">
                      "{currentWord.definition_ko}"
                    </p>
                    <p className="text-caption text-text-tertiary">({currentWord.part_of_speech})</p>
                  </div>
                )}
                {cardPhase === 'quiz3' && (
                  <div className="mb-4">
                    {/* 3차: 예문 속 의미 — 예문과 단어 표시 */}
                    <p className="text-xs text-text-tertiary mb-2">3/3: 이 문장에서 <span className="font-bold text-subj-english">{currentWord.word}</span>의 의미는?</p>
                    {currentWord.example_sentence ? (
                      <p className="text-body text-text-secondary italic bg-bg-sidebar p-3 rounded-lg">
                        "{currentWord.example_sentence}"
                      </p>
                    ) : (
                      <p className="text-body text-text-secondary italic bg-bg-sidebar p-3 rounded-lg">
                        (예문 없음 - 위 단어의 뜻을 선택하세요)
                      </p>
                    )}
                  </div>
                )}

                {/* 선택지 */}
                <div className="space-y-3 text-left mb-6">
                  {currentQuizChoices.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedAnswer(choice.text)}
                      className={`w-full p-3 rounded-lg transition-all text-left ${
                        selectedAnswer === choice.text
                          ? 'bg-subj-english-light border-2 border-subj-english'
                          : 'bg-bg-sidebar hover:bg-bg-hover border-2 border-transparent'
                      }`}
                    >
                      <span className="text-body text-text-primary">{choice.text}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={submitQuizAnswer}
                  disabled={!selectedAnswer}
                  className="w-full btn bg-green-600 text-white font-semibold rounded-lg py-3 disabled:opacity-50 hover:bg-green-700"
                >
                  확인
                </button>
              </>
            )}

            {/* 결과 */}
            {cardPhase === 'result' && (
              <>
                {(() => {
                  const correctCount = quizStageResults.filter(r => r).length;
                  const isMastered = correctCount === 3;
                  const isClose = correctCount === 2;

                  return (
                    <>
                      <div className="text-5xl mb-4">
                        {isMastered ? '🏆' : isClose ? '👍' : '📚'}
                      </div>
                      <div className={`text-2xl font-serif font-bold mb-2 ${
                        isMastered ? 'text-success' : isClose ? 'text-warning' : 'text-info'
                      }`}>
                        {isMastered
                          ? '마스터!'
                          : isClose
                            ? '거의 다 왔어요!'
                            : '학습이 필요해요'}
                      </div>
                      <div className="flex justify-center gap-2 mb-4">
                        {quizStageResults.map((result, i) => (
                          <span key={i} className={`text-2xl ${result ? 'text-green-500' : 'text-red-500'}`}>
                            {result ? '✓' : '✗'}
                          </span>
                        ))}
                      </div>
                      <p className="text-body text-text-secondary mb-2">
                        {currentWord.word} - {currentWord.definition_ko}
                      </p>
                      {!isMastered && (
                        <p className="text-caption text-text-tertiary mb-4">
                          다음 복습: {correctCount === 2 ? '3일 후' : '내일'}
                        </p>
                      )}
                    </>
                  );
                })()}
                <div className="space-y-2">
                  {quizStageResults.filter(r => r).length < 3 ? (
                    <>
                      <button
                        onClick={retryCurrentWord}
                        className="w-full btn bg-blue-600 text-white font-semibold rounded-lg py-3 hover:bg-blue-700"
                      >
                        학습하고 재도전
                      </button>
                      <button
                        onClick={nextCard}
                        className="w-full btn btn-secondary"
                      >
                        다음 단어로
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={nextCard}
                      className="w-full btn bg-green-600 text-white font-semibold rounded-lg py-3 hover:bg-green-700"
                    >
                      다음 단어
                    </button>
                  )}
                  <button
                    onClick={() => copyPronunciationPrompt(currentWord.word)}
                    className="w-full btn btn-secondary justify-between text-sm"
                  >
                    <span>🗣️ 발음 코칭</span>
                    <span className="text-text-tertiary">Gemini Live</span>
                  </button>
                </div>
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
          <h2 className="text-heading text-text-primary mb-2">
            {isToday(selectedDate) ? '오늘의 학습 완료!' : `Day ${getDayNumber(selectedDate)} 학습 완료!`}
          </h2>

          <p className="text-body text-text-secondary mb-4">
            {todayWords.length}개의 단어를 학습했습니다.
          </p>

          {/* 진행 통계 */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-bg-sidebar rounded-lg">
              <div className="text-stat text-info">
                {Object.values(myVocabulary).filter(v => v.status === 'learning' || v.status === 'struggling').length}
              </div>
              <div className="text-xs text-text-tertiary">학습 중</div>
            </div>
            <div className="p-3 bg-bg-sidebar rounded-lg">
              <div className="text-stat text-success">
                {Object.values(myVocabulary).filter(v => v.status === 'mastered').length}
              </div>
              <div className="text-xs text-text-tertiary">마스터</div>
            </div>
            <div className="p-3 bg-bg-sidebar rounded-lg">
              <div className="text-stat text-warning">
                {Object.values(myVocabulary).filter(v =>
                  v.next_review && v.next_review <= new Date().toISOString().split('T')[0]
                ).length}
              </div>
              <div className="text-xs text-text-tertiary">복습 대기</div>
            </div>
          </div>

          {/* 복습 퀴즈 섹션 */}
          {todayWords.length >= 3 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-lg mb-2">📝 오늘의 복습 퀴즈</div>
              <p className="text-caption text-text-secondary mb-3">
                방금 학습한 단어 중 {Math.min(10, todayWords.length)}개를 빈칸 채우기로 복습하세요!
              </p>
              <button
                onClick={startReviewQuiz}
                className="w-full btn bg-blue-600 text-white font-semibold rounded-lg py-3 hover:bg-blue-700"
              >
                복습 퀴즈 시작
              </button>
            </div>
          )}

          <button
            onClick={() => {
              goToToday();
              setMode('cards');
            }}
            className="btn btn-secondary w-full"
          >
            더 학습하기
          </button>
        </div>
      )}

      {/* 복습 퀴즈 모드 */}
      {mode === 'review' && reviewWords.length > 0 && (
        <div className="max-w-md mx-auto p-6 pt-8">
          {cardPhase !== 'review_result' ? (
            <>
              {/* 진행 표시 */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setMode('complete')}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  ← 돌아가기
                </button>
                <span className="text-caption text-text-tertiary">
                  {reviewIndex + 1} / {reviewWords.length}
                </span>
              </div>

              <div className="h-2 bg-bg-hover rounded-full overflow-hidden mb-6">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${((reviewIndex + 1) / reviewWords.length) * 100}%` }}
                />
              </div>

              {/* 빈칸 채우기 카드 */}
              <div className="card p-8 text-center">
                <div className="mb-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-caption font-medium">
                    빈칸 채우기
                  </span>
                </div>

                {/* 예문 (단어를 _____로 치환) */}
                <p className="text-body text-text-secondary italic bg-bg-sidebar p-4 rounded-lg mb-4">
                  "{reviewWords[reviewIndex].example_sentence?.replace(
                    new RegExp(`\\b${reviewWords[reviewIndex].word}\\b`, 'gi'),
                    '_____'
                  ) || '_____ was the key concept.'}"
                </p>

                <p className="text-caption text-text-tertiary mb-4">
                  빈칸에 들어갈 단어를 선택하세요
                </p>

                {/* 선택지 */}
                <div className="space-y-3 text-left mb-6">
                  {currentQuizChoices.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedAnswer(choice.text)}
                      className={`w-full p-3 rounded-lg transition-all text-left ${
                        selectedAnswer === choice.text
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-bg-sidebar hover:bg-bg-hover border-2 border-transparent'
                      }`}
                    >
                      <span className="text-body text-text-primary font-medium">{choice.text}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={submitReviewAnswer}
                  disabled={!selectedAnswer}
                  className="w-full btn bg-blue-600 text-white font-semibold rounded-lg py-3 disabled:opacity-50 hover:bg-blue-700"
                >
                  확인
                </button>
              </div>
            </>
          ) : (
            /* 복습 결과 */
            <div className="text-center">
              <div className="text-6xl mb-6">📝</div>
              <h2 className="text-heading text-text-primary mb-2">복습 퀴즈 완료!</h2>

              {(() => {
                const correctCount = reviewResults.filter(r => r.correct).length;
                const total = reviewResults.length;
                const percentage = Math.round((correctCount / total) * 100);

                return (
                  <>
                    <div className="text-stat text-blue-600 mb-2">
                      {correctCount} / {total}
                    </div>
                    <p className="text-body text-text-secondary mb-6">
                      {percentage >= 80 ? '훌륭해요! 단어가 잘 기억되고 있어요.' :
                       percentage >= 60 ? '좋아요! 조금 더 연습하면 완벽해질 거예요.' :
                       '더 연습이 필요해요. 틀린 단어를 다시 학습해보세요.'}
                    </p>

                    {/* 틀린 단어 목록 */}
                    {reviewResults.filter(r => !r.correct).length > 0 && (
                      <div className="mb-6 p-4 bg-red-50 rounded-lg text-left">
                        <p className="text-caption text-red-600 font-medium mb-2">다시 학습할 단어:</p>
                        <div className="flex flex-wrap gap-2">
                          {reviewResults.filter(r => !r.correct).map((r, i) => (
                            <span key={i} className="px-2 py-1 bg-white rounded text-caption text-red-700 border border-red-200">
                              {r.word}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setCardPhase('question');
                    startReviewQuiz();
                  }}
                  className="w-full btn bg-blue-600 text-white font-semibold rounded-lg py-3 hover:bg-blue-700"
                >
                  다시 복습하기
                </button>
                <button
                  onClick={() => {
                    setCardPhase('question');
                    setMode('complete');
                  }}
                  className="w-full btn btn-secondary"
                >
                  완료
                </button>
              </div>
            </div>
          )}
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
              <div key={idx}>
                {word.level > 0 ? (
                  // 학습 DB 단어 (level 1-5)
                  <div className="w-full p-4 bg-bg-card rounded-lg hover:bg-bg-hover transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => {
                          setSelectedWord(word);
                          setCardPhase('learn');
                          setMode('cards');
                        }}
                        className="font-bold text-text-primary hover:text-subj-english"
                      >
                        {word.word}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakWord(word.word);
                        }}
                        className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-sm"
                        title="발음 듣기"
                      >
                        🔊
                      </button>
                      <span className="text-xs px-1.5 py-0.5 bg-subj-english-light text-subj-english rounded">
                        Lv.{word.level}
                      </span>
                      <span className="text-xs text-text-tertiary">({word.part_of_speech})</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedWord(word);
                        setCardPhase('learn');
                        setMode('cards');
                      }}
                      className="text-caption text-text-secondary text-left"
                    >
                      {word.definition_ko || word.definition_en}
                    </button>
                  </div>
                ) : (
                  // 검색 전용 단어 (level 0)
                  <div className="p-4 bg-bg-card rounded-lg border border-border-subtle">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-text-primary">{word.word}</span>
                      <button
                        onClick={() => speakWord(word.word)}
                        className="w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-sm"
                        title="발음 듣기"
                      >
                        🔊
                      </button>
                      <span className="text-xs px-1.5 py-0.5 bg-bg-hover text-text-tertiary rounded">
                        검색 전용
                      </span>
                    </div>
                    <p className="text-caption text-text-tertiary mb-3">
                      이 단어는 학습 DB에 없습니다
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {getExternalLinks(word.word).map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 bg-bg-sidebar rounded hover:bg-bg-hover transition-colors"
                        >
                          {link.icon} {link.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {searchQuery && searchResults.length === 0 && (
              <div className="text-center py-8 text-text-tertiary">
                <p className="mb-2">이 단어는 DB에 없어요</p>
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

      {/* 토스트 */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-text-primary text-bg-card rounded-lg shadow-elevated z-50 text-sm">
          {toastMessage}
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
            className="w-full btn bg-green-600 text-white font-semibold rounded-lg py-3 hover:bg-green-700"
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
              className="flex-1 btn bg-green-600 text-white font-semibold rounded-lg py-3 hover:bg-green-700"
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
      <div className="flex items-center gap-3 mb-1">
        <span className="text-3xl font-serif font-bold text-text-primary">
          {word.word}
        </span>
        <button
          onClick={() => speakWord(word.word)}
          className="w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-xl transition-colors"
          title="발음 듣기"
        >
          🔊
        </button>
      </div>
      <div className="text-caption text-text-tertiary mb-4">
        ({word.part_of_speech})
        <a
          href={`https://www.merriam-webster.com/dictionary/${encodeURIComponent(word.word)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-blue-500 hover:underline"
        >
          발음 기호 보기 →
        </a>
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
        className="w-full btn bg-green-600 text-white font-semibold rounded-lg py-3 hover:bg-green-700"
      >
        학습 완료 → 퀴즈
      </button>
    </div>
  );
}
