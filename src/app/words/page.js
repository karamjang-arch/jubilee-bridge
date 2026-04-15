'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
];

// 브라우저 TTS로 발음 재생
const speakWord = (word) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const usVoice = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en'));
  if (usVoice) utterance.voice = usVoice;
  window.speechSynthesis.speak(utterance);
};

// 통과 기준
const PASS_THRESHOLD = 0.8;

export default function WordsPage() {
  const { profile, studentId, isLoading: profileLoading } = useProfile();

  // 모드: loading, setup, sorting, learning, quiz, result
  const [mode, setMode] = useState('loading');
  const [wordSettings, setWordSettings] = useState(null);
  const [words, setWords] = useState([]);
  const [todayWords, setTodayWords] = useState([]);
  const [synonymsData, setSynonymsData] = useState({});

  // Phase 1: 분류 상태
  const [sortingIndex, setSortingIndex] = useState(0);
  const [knownWords, setKnownWords] = useState([]);
  const [unknownWords, setUnknownWords] = useState([]);
  const [swipeDirection, setSwipeDirection] = useState(null);

  // Phase 2: 학습 상태
  const [learningIndex, setLearningIndex] = useState(0);

  // Phase 3: 퀴즈 상태
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [quizResults, setQuizResults] = useState([]);

  // Phase 4: 결과 상태
  const [isPassed, setIsPassed] = useState(false);

  // 스와이프 상태
  const cardRef = useRef(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);

  // 토스트
  const [toast, setToast] = useState(null);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 설정 및 단어 로드
  useEffect(() => {
    if (profileLoading || !studentId) return;

    const savedSettings = localStorage.getItem(`jb_word_settings_${studentId}`);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setWordSettings(settings);
      loadWords(settings.maxLevel, settings.dailyCount);
    } else {
      setMode('setup');
    }
  }, [profileLoading, studentId]);

  // 유사어 데이터 로드
  useEffect(() => {
    fetch('/data/word_synonyms.json')
      .then(res => res.json())
      .then(data => setSynonymsData(data))
      .catch(err => console.error('Failed to load synonyms:', err));
  }, []);

  // 단어 로드
  const loadWords = async (maxLevel, dailyCount = 10) => {
    try {
      const res = await fetch('/api/words?all=true');
      const data = await res.json();
      const filtered = data.words.filter(w => w.level <= maxLevel);
      setWords(filtered);

      // 오늘의 단어 선택 (새 단어 우선)
      const vocab = JSON.parse(localStorage.getItem(`jb_vocabulary_${studentId}`) || '{}');
      const newWords = filtered.filter(w => !vocab[w.word]);
      const selected = newWords.slice(0, dailyCount);

      setTodayWords(selected);
      setMode('sorting');
      setSortingIndex(0);
      setKnownWords([]);
      setUnknownWords([]);
    } catch (error) {
      console.error('Failed to load words:', error);
      showToast('단어 로드 실패');
    }
  };

  // 설정 저장
  const saveSettings = (settings) => {
    localStorage.setItem(`jb_word_settings_${studentId}`, JSON.stringify(settings));
    setWordSettings(settings);
    loadWords(settings.maxLevel, settings.dailyCount);
  };

  // ============ Phase 1: 분류 ============
  const handleSort = (knows) => {
    const currentWord = todayWords[sortingIndex];
    setSwipeDirection(knows ? 'right' : 'left');

    setTimeout(() => {
      if (knows) {
        setKnownWords(prev => [...prev, currentWord]);
      } else {
        setUnknownWords(prev => [...prev, currentWord]);
      }

      setSwipeDirection(null);
      setDragOffset(0);

      if (sortingIndex + 1 >= todayWords.length) {
        // 분류 완료 → XP 지급
        recordXP(5, 'word_sort');

        // unknown이 있으면 학습, 없으면 바로 퀴즈
        const hasUnknown = unknownWords.length > 0 || !knows;
        if (hasUnknown || unknownWords.length > 0) {
          setLearningIndex(0);
          setMode('learning');
        } else {
          startQuiz([...knownWords, currentWord], []);
        }
      } else {
        setSortingIndex(sortingIndex + 1);
      }
    }, 200);
  };

  // 스와이프 핸들러
  const handleDragStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setDragStart(clientX);
  };

  const handleDragMove = (e) => {
    if (dragStart === null) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const offset = clientX - dragStart;
    setDragOffset(offset);
  };

  const handleDragEnd = () => {
    if (Math.abs(dragOffset) > 100) {
      handleSort(dragOffset > 0);
    } else {
      setDragOffset(0);
    }
    setDragStart(null);
  };

  // ============ Phase 2: 학습 ============
  const handleNextLearning = () => {
    if (learningIndex + 1 >= unknownWords.length) {
      // 학습 완료 → 퀴즈 시작
      startQuiz(knownWords, unknownWords);
    } else {
      setLearningIndex(learningIndex + 1);
    }
  };

  // ============ Phase 3: 퀴즈 ============
  const startQuiz = (known, unknown) => {
    const allWords = [...known, ...unknown];
    if (allWords.length === 0) {
      setMode('result');
      setIsPassed(true);
      return;
    }

    // 퀴즈 문제 생성
    const questions = generateQuizQuestions(allWords);
    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizResults([]);
    setSelectedAnswer(null);
    setShowAnswer(false);
    setMode('quiz');
  };

  // 퀴즈 문제 생성
  const generateQuizQuestions = (wordList) => {
    const questions = [];
    const shuffledWords = [...wordList].sort(() => Math.random() - 0.5);

    shuffledWords.forEach((word, idx) => {
      // 문제 유형 랜덤 선택 (A, B, C, D 중)
      const types = ['A', 'B', 'C'];
      // 유사어 데이터가 있으면 Type D 추가
      if (synonymsData[word.word]) {
        types.push('D');
      }
      const type = types[Math.floor(Math.random() * types.length)];

      const question = createQuestion(word, type, wordList);
      if (question) questions.push(question);
    });

    return questions;
  };

  // 문제 생성
  const createQuestion = (word, type, wordList) => {
    const otherWords = wordList.filter(w => w.word !== word.word);

    switch (type) {
      case 'A': // 정의 → 단어 고르기
        return {
          type: 'A',
          word: word,
          question: `"${word.definition_ko}"의 영단어는?`,
          choices: shuffleArray([
            { text: word.word, isCorrect: true },
            ...getRandomItems(otherWords, 3).map(w => ({ text: w.word, isCorrect: false }))
          ]),
        };

      case 'B': // 단어 → 정의 고르기
        return {
          type: 'B',
          word: word,
          question: `"${word.word}"의 뜻은?`,
          choices: shuffleArray([
            { text: word.definition_ko, isCorrect: true },
            ...getRandomItems(otherWords, 3).map(w => ({ text: w.definition_ko, isCorrect: false }))
          ]),
        };

      case 'C': // 빈칸 채우기
        const sentence = word.example_sentence || `Use ${word.word} in context.`;
        const blankedSentence = sentence.replace(
          new RegExp(word.word, 'gi'),
          '_____'
        );
        return {
          type: 'C',
          word: word,
          question: blankedSentence,
          choices: shuffleArray([
            { text: word.word, isCorrect: true },
            ...getRandomItems(otherWords, 3).map(w => ({ text: w.word, isCorrect: false }))
          ]),
        };

      case 'D': // 유사어 구분
        const synData = synonymsData[word.word];
        if (!synData) return createQuestion(word, 'A', wordList);

        const firstSyn = synData.synonyms[0];
        const correctNuance = synData.nuances[firstSyn];

        return {
          type: 'D',
          word: word,
          synonym: firstSyn,
          question: `"${word.word}"와 "${firstSyn}"의 차이는?`,
          choices: shuffleArray([
            { text: `${word.word}: ${word.definition_ko} / ${firstSyn}: ${correctNuance?.slice(0, 30)}...`, isCorrect: true },
            { text: '같은 의미로 사용할 수 있다', isCorrect: false },
            { text: `${firstSyn}가 더 격식적인 표현이다`, isCorrect: false },
            { text: '발음만 다르고 의미는 동일하다', isCorrect: false },
          ]),
          nuanceExplanation: `${word.word}: ${word.definition_ko}\n${firstSyn}: ${correctNuance}`,
        };

      default:
        return null;
    }
  };

  // 퀴즈 답안 제출
  const submitQuizAnswer = () => {
    const isCorrect = selectedAnswer?.isCorrect || false;
    setShowAnswer(true);
    setQuizResults(prev => [...prev, isCorrect]);
  };

  // 다음 문제
  const nextQuestion = () => {
    if (quizIndex + 1 >= quizQuestions.length) {
      // 퀴즈 완료 → 결과 판정
      const correctCount = [...quizResults, selectedAnswer?.isCorrect].filter(Boolean).length;
      const score = correctCount / quizQuestions.length;
      const passed = score >= PASS_THRESHOLD;

      setIsPassed(passed);

      if (passed) {
        // 통과 → XP 지급
        const baseXP = 20;
        const bonusXP = score === 1 ? 10 : 0;
        recordXP(baseXP + bonusXP, 'word_quiz', { score: Math.round(score * 100) });

        // 게임 토큰 지급
        grantGameToken(1);

        // 진행 저장
        saveProgress(todayWords, score);
      }

      setMode('result');
    } else {
      setQuizIndex(quizIndex + 1);
      setSelectedAnswer(null);
      setShowAnswer(false);
    }
  };

  // 재시험 (Phase 2로 복귀)
  const retryQuiz = () => {
    setLearningIndex(0);
    setMode('learning');
  };

  // XP 기록
  const recordXP = async (amount, eventType, detail = {}) => {
    try {
      await fetch('/api/concept-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          event_type: eventType,
          detail: { xp: amount, ...detail },
        }),
      });

      // XP 업데이트 (gamification API)
      await fetch('/api/gamification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_xp',
          student_id: studentId,
          xp: amount,
          source: eventType,
        }),
      });
    } catch (err) {
      console.error('Failed to record XP:', err);
    }
  };

  // 게임 토큰 지급
  const grantGameToken = async (amount) => {
    try {
      const res = await fetch('/api/arcade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_tokens',
          student_id: studentId,
          amount,
        }),
      });
      const data = await res.json();

      // localStorage에도 백업 저장 (데모 모드 대응)
      const storageKey = `jb_game_tokens_${studentId}`;
      const currentTokens = parseInt(localStorage.getItem(storageKey) || '0');
      localStorage.setItem(storageKey, String(currentTokens + amount));

      showToast(`🎮 게임 토큰 +${amount} 획득!`);
    } catch (err) {
      console.error('Failed to grant game token:', err);
      // API 실패 시에도 localStorage에 저장
      const storageKey = `jb_game_tokens_${studentId}`;
      const currentTokens = parseInt(localStorage.getItem(storageKey) || '0');
      localStorage.setItem(storageKey, String(currentTokens + amount));
      showToast(`🎮 게임 토큰 +${amount} 획득!`);
    }
  };

  // 진행 저장
  const saveProgress = (words, score) => {
    const vocab = JSON.parse(localStorage.getItem(`jb_vocabulary_${studentId}`) || '{}');
    const today = new Date().toISOString().split('T')[0];

    words.forEach(w => {
      vocab[w.word] = {
        ...(vocab[w.word] || {}),
        last_reviewed: today,
        status: score >= PASS_THRESHOLD ? 'learned' : 'learning',
        last_score: Math.round(score * 100),
      };
    });

    localStorage.setItem(`jb_vocabulary_${studentId}`, JSON.stringify(vocab));
  };

  // 헬퍼 함수
  const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);
  const getRandomItems = (arr, n) => shuffleArray(arr).slice(0, Math.min(n, arr.length));

  // 현재 상태에 따른 렌더링
  const currentSortWord = todayWords[sortingIndex];
  const currentLearnWord = unknownWords[learningIndex];
  const currentQuiz = quizQuestions[quizIndex];
  const grade = profile?.grade || 10;
  const recommendation = GRADE_LEVEL_RECOMMENDATIONS[grade] || GRADE_LEVEL_RECOMMENDATIONS[10];

  return (
    <div className="min-h-screen bg-bg-page">
      <Navigation />

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* 로딩 */}
      {mode === 'loading' && (
        <div className="flex items-center justify-center h-[calc(100vh-56px)]">
          <div className="text-text-tertiary">단어 로딩 중...</div>
        </div>
      )}

      {/* 설정 */}
      {mode === 'setup' && (
        <SetupWizard
          grade={grade}
          recommendation={recommendation}
          onComplete={saveSettings}
        />
      )}

      {/* Phase 1: 분류 */}
      {mode === 'sorting' && currentSortWord && (
        <div className="max-w-md mx-auto p-6 pt-8">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-1">단어 분류</h2>
            <p className="text-sm text-text-secondary">알고 있는 단어는 오른쪽, 모르는 단어는 왼쪽으로</p>
          </div>

          {/* 진행 바 */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-text-tertiary mb-1">
              <span>{sortingIndex + 1} / {todayWords.length}</span>
              <span>알아요 {knownWords.length} | 몰라요 {unknownWords.length}</span>
            </div>
            <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-subj-english transition-all"
                style={{ width: `${((sortingIndex) / todayWords.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 스와이프 카드 */}
          <div
            ref={cardRef}
            className="relative cursor-grab active:cursor-grabbing"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <div
              className={`card p-8 text-center transition-transform select-none ${
                swipeDirection === 'right' ? 'translate-x-full opacity-0' :
                swipeDirection === 'left' ? '-translate-x-full opacity-0' : ''
              }`}
              style={{
                transform: swipeDirection ? undefined : `translateX(${dragOffset}px) rotate(${dragOffset * 0.05}deg)`,
              }}
            >
              {/* 스와이프 힌트 오버레이 */}
              {dragOffset > 50 && (
                <div className="absolute inset-0 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-3xl text-green-600 font-bold">알아요</span>
                </div>
              )}
              {dragOffset < -50 && (
                <div className="absolute inset-0 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-3xl text-red-600 font-bold">몰라요</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-4xl font-serif font-bold text-text-primary">
                  {currentSortWord.word}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); speakWord(currentSortWord.word); }}
                  className="w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-xl"
                >
                  🔊
                </button>
              </div>
              <div className="text-sm text-text-tertiary mb-2">
                ({currentSortWord.part_of_speech})
              </div>
              {currentSortWord.ipa && (
                <div className="text-lg text-blue-600 font-mono">
                  {currentSortWord.ipa}
                </div>
              )}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => handleSort(false)}
              className="flex-1 btn bg-red-100 text-red-700 border border-red-300 hover:bg-red-200 py-4 text-lg"
            >
              ❌ 몰라요
            </button>
            <button
              onClick={() => handleSort(true)}
              className="flex-1 btn bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 py-4 text-lg"
            >
              ✅ 알아요
            </button>
          </div>
        </div>
      )}

      {/* Phase 2: 학습 */}
      {mode === 'learning' && unknownWords.length > 0 && currentLearnWord && (
        <div className="max-w-md mx-auto p-6 pt-8">
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary mb-1">단어 학습</h2>
            <p className="text-sm text-text-secondary">
              {learningIndex + 1} / {unknownWords.length} 모르는 단어
            </p>
          </div>

          {/* 진행 바 */}
          <div className="h-2 bg-bg-hover rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-subj-math transition-all"
              style={{ width: `${((learningIndex + 1) / unknownWords.length) * 100}%` }}
            />
          </div>

          {/* 학습 카드 */}
          <div className="card p-6">
            {/* 단어 + 발음 */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-3xl font-serif font-bold text-text-primary">
                {currentLearnWord.word}
              </span>
              <button
                onClick={() => speakWord(currentLearnWord.word)}
                className="w-10 h-10 rounded-full bg-blue-50 hover:bg-blue-100 flex items-center justify-center text-xl"
              >
                🔊
              </button>
            </div>

            <div className="text-center text-sm text-text-tertiary mb-1">
              ({currentLearnWord.part_of_speech})
            </div>

            {currentLearnWord.ipa && (
              <div className="text-center text-lg text-blue-600 font-mono mb-4">
                {currentLearnWord.ipa}
              </div>
            )}

            <hr className="my-4 border-border-subtle" />

            {/* 한국어 뜻 */}
            <div className="mb-4">
              <div className="text-xs text-text-tertiary mb-1">한국어 뜻</div>
              <div className="text-lg text-text-primary font-medium">
                {currentLearnWord.definition_ko}
              </div>
            </div>

            {/* 영어 정의 */}
            <div className="mb-4">
              <div className="text-xs text-text-tertiary mb-1">English Definition</div>
              <div className="text-sm text-text-secondary">
                {currentLearnWord.definition_en}
              </div>
            </div>

            {/* 예문 */}
            {currentLearnWord.example_sentence && (
              <div className="mb-4">
                <div className="text-xs text-text-tertiary mb-1">예문</div>
                <div className="text-sm text-text-secondary italic bg-bg-sidebar p-3 rounded-lg">
                  {currentLearnWord.example_sentence.split(new RegExp(`(${currentLearnWord.word})`, 'gi')).map((part, i) =>
                    part.toLowerCase() === currentLearnWord.word.toLowerCase()
                      ? <strong key={i} className="text-subj-english">{part}</strong>
                      : part
                  )}
                </div>
              </div>
            )}

            {/* 유사어 */}
            {synonymsData[currentLearnWord.word] && (
              <div className="mb-4">
                <div className="text-xs text-text-tertiary mb-1">유사어 뉘앙스</div>
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  {synonymsData[currentLearnWord.word].synonyms.slice(0, 3).map((syn, i) => (
                    <div key={i} className="mb-2 last:mb-0">
                      <span className="font-medium text-blue-700">{syn}</span>
                      <span className="text-text-secondary ml-2">
                        {synonymsData[currentLearnWord.word].nuances[syn]?.slice(0, 50)}...
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 다음 버튼 */}
          <button
            onClick={handleNextLearning}
            className="w-full mt-6 btn bg-subj-english text-white py-4 text-lg"
          >
            {learningIndex + 1 >= unknownWords.length ? '퀴즈 시작 →' : '다음 →'}
          </button>
        </div>
      )}

      {/* 학습할 단어 없음 (모두 알고 있음) → 바로 퀴즈 */}
      {mode === 'learning' && unknownWords.length === 0 && (
        <div className="max-w-md mx-auto p-6 pt-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">모든 단어를 알고 있어요!</h2>
          <p className="text-text-secondary mb-6">바로 퀴즈로 확인해볼까요?</p>
          <button
            onClick={() => startQuiz(knownWords, [])}
            className="btn bg-subj-english text-white py-3 px-8"
          >
            퀴즈 시작
          </button>
        </div>
      )}

      {/* Phase 3: 퀴즈 */}
      {mode === 'quiz' && currentQuiz && (
        <div className="max-w-md mx-auto p-6 pt-8">
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary mb-1">종합 퀴즈</h2>
            <p className="text-sm text-text-secondary">
              {quizIndex + 1} / {quizQuestions.length}
            </p>
          </div>

          {/* 진행 바 */}
          <div className="h-2 bg-bg-hover rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-subj-physics transition-all"
              style={{ width: `${((quizIndex + 1) / quizQuestions.length) * 100}%` }}
            />
          </div>

          {/* 문제 유형 표시 */}
          <div className="text-xs text-text-tertiary mb-2">
            {currentQuiz.type === 'A' && '정의 → 단어'}
            {currentQuiz.type === 'B' && '단어 → 정의'}
            {currentQuiz.type === 'C' && '빈칸 채우기'}
            {currentQuiz.type === 'D' && '유사어 구분'}
          </div>

          {/* 문제 카드 */}
          <div className="card p-6 mb-4">
            {/* Type C: 빈칸 문제는 예문 표시 */}
            {currentQuiz.type === 'C' ? (
              <div className="text-lg text-text-primary mb-4 italic">
                "{currentQuiz.question}"
              </div>
            ) : (
              <div className="text-lg text-text-primary mb-4">
                {currentQuiz.question}
              </div>
            )}

            {/* 선택지 */}
            <div className="space-y-3">
              {currentQuiz.choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => !showAnswer && setSelectedAnswer(choice)}
                  disabled={showAnswer}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    showAnswer
                      ? choice.isCorrect
                        ? 'border-green-500 bg-green-50'
                        : selectedAnswer === choice
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white'
                      : selectedAnswer === choice
                        ? 'border-subj-physics bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                  {choice.text}
                </button>
              ))}
            </div>

            {/* Type D: 정답 후 뉘앙스 설명 */}
            {showAnswer && currentQuiz.type === 'D' && currentQuiz.nuanceExplanation && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm">
                <div className="font-medium text-blue-700 mb-2">뉘앙스 차이</div>
                <div className="text-text-secondary whitespace-pre-line">
                  {currentQuiz.nuanceExplanation}
                </div>
              </div>
            )}
          </div>

          {/* 제출/다음 버튼 */}
          {!showAnswer ? (
            <button
              onClick={submitQuizAnswer}
              disabled={!selectedAnswer}
              className={`w-full btn py-4 text-lg ${
                selectedAnswer
                  ? 'bg-subj-physics text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              확인
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="w-full btn bg-subj-english text-white py-4 text-lg"
            >
              {quizIndex + 1 >= quizQuestions.length ? '결과 보기' : '다음 문제 →'}
            </button>
          )}
        </div>
      )}

      {/* Phase 4: 결과 */}
      {mode === 'result' && (
        <div className="max-w-md mx-auto p-6 pt-12 text-center">
          <div className="text-6xl mb-4">
            {isPassed ? '🎉' : '😢'}
          </div>

          <h2 className="text-2xl font-bold text-text-primary mb-2">
            {isPassed ? '통과!' : '다시 도전하세요'}
          </h2>

          <div className="text-lg text-text-secondary mb-6">
            {quizResults.filter(Boolean).length} / {quizQuestions.length} 정답
            <span className="ml-2">
              ({Math.round((quizResults.filter(Boolean).length / quizQuestions.length) * 100)}%)
            </span>
          </div>

          {isPassed ? (
            <>
              <div className="bg-green-50 p-4 rounded-lg mb-6">
                <div className="text-green-700 font-medium">
                  +{quizResults.filter(Boolean).length === quizQuestions.length ? 30 : 20} XP 획득!
                </div>
                {quizResults.filter(Boolean).length === quizQuestions.length && (
                  <div className="text-green-600 text-sm mt-1">
                    Perfect! 보너스 +10 XP
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setMode('loading');
                  loadWords(wordSettings.maxLevel, wordSettings.dailyCount);
                }}
                className="btn bg-subj-english text-white py-3 px-8"
              >
                다음 단어 학습하기
              </button>
            </>
          ) : (
            <>
              <p className="text-text-secondary mb-6">
                80% 이상 정답해야 통과입니다.<br />
                다시 학습 후 퀴즈에 도전하세요.
              </p>

              <button
                onClick={retryQuiz}
                className="btn bg-subj-math text-white py-3 px-8"
              >
                다시 학습하기
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 설정 위저드 컴포넌트
function SetupWizard({ grade, recommendation, onComplete }) {
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState({
    maxLevel: recommendation.maxLevel,
    dailyCount: 10,
    targetDays: 100,
  });

  const handleComplete = () => {
    onComplete({
      ...settings,
      startDate: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="max-w-lg mx-auto p-6 pt-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">📖 단어 학습</h1>
        <p className="text-text-secondary">학습 계획을 설정해주세요</p>
      </div>

      {step === 1 && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">레벨 선택</h3>
          <p className="text-sm text-text-secondary mb-4">
            {grade}학년 추천: {recommendation.label}
          </p>

          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(level => (
              <button
                key={level}
                onClick={() => setSettings(s => ({ ...s, maxLevel: level }))}
                className={`w-full p-3 rounded-lg border-2 text-left ${
                  settings.maxLevel >= level
                    ? 'border-subj-english bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                Level {level}
                {level === recommendation.maxLevel && (
                  <span className="ml-2 text-xs text-subj-english">(추천)</span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full mt-6 btn bg-subj-english text-white"
          >
            다음
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">하루 학습량</h3>

          <div className="space-y-2">
            {[5, 10, 15, 20].map(count => (
              <button
                key={count}
                onClick={() => setSettings(s => ({ ...s, dailyCount: count }))}
                className={`w-full p-3 rounded-lg border-2 text-left ${
                  settings.dailyCount === count
                    ? 'border-subj-english bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                하루 {count}개
                {count === 10 && <span className="ml-2 text-xs text-subj-english">(추천)</span>}
              </button>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
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
        </div>
      )}
    </div>
  );
}
