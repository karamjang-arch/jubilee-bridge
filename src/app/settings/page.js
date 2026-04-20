'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { useProfile } from '@/hooks/useProfile';

const WORD_LEVELS = [
  { value: 1, label: 'Level 1 (Oxford Essential, ~493단어)' },
  { value: 2, label: 'Level 1+2 (~917단어)' },
  { value: 3, label: 'Level 1~3 (~1,300단어)' },
  { value: 4, label: 'Level 1~4 (~1,967단어)' },
  { value: 5, label: 'Level 전체 (2,130단어)' },
];

export default function SettingsPage() {
  const { profile, studentId, isLoading: profileLoading } = useProfile();

  // 단어 설정
  const [wordSettings, setWordSettings] = useState(null);
  const [newMaxLevel, setNewMaxLevel] = useState(4);
  const [newDailyCount, setNewDailyCount] = useState(10);
  const [wordSaved, setWordSaved] = useState(false);

  // Canvas 설정
  const [canvasUrl, setCanvasUrl] = useState('https://purdue.instructure.com');
  const [canvasToken, setCanvasToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // null, 'testing', 'success', 'error'
  const [testMessage, setTestMessage] = useState('');
  const [courses, setCourses] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // 저장된 설정 로드
  useEffect(() => {
    if (profileLoading || !studentId) return;

    const savedCanvas = localStorage.getItem(`jb_canvas_settings_${studentId}`);
    if (savedCanvas) {
      const settings = JSON.parse(savedCanvas);
      setCanvasUrl(settings.canvasUrl || 'https://purdue.instructure.com');
      setCanvasToken(settings.canvasToken || '');
    }

    const savedWord = localStorage.getItem(`jb_word_settings_${studentId}`);
    if (savedWord) {
      const ws = JSON.parse(savedWord);
      setWordSettings(ws);
      setNewMaxLevel(ws.maxLevel || 4);
      setNewDailyCount(ws.dailyCount || 10);
    }
  }, [profileLoading, studentId]);

  // 단어 설정 저장
  const handleSaveWordSettings = () => {
    if (!studentId) return;
    const updated = {
      ...(wordSettings || {}),
      maxLevel: newMaxLevel,
      dailyCount: newDailyCount,
      startDate: wordSettings?.startDate || new Date().toISOString().split('T')[0],
    };
    localStorage.setItem(`jb_word_settings_${studentId}`, JSON.stringify(updated));
    setWordSettings(updated);
    setWordSaved(true);
    setTimeout(() => setWordSaved(false), 2000);
  };

  // Canvas 연동 테스트
  const handleTest = async () => {
    if (!canvasToken.trim()) {
      setTestStatus('error');
      setTestMessage('Access Token을 입력하세요.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('연결 테스트 중...');
    setCourses([]);

    try {
      const res = await fetch(`${canvasUrl}/api/v1/courses?enrollment_state=active&per_page=50`, {
        headers: {
          'Authorization': `Bearer ${canvasToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setCourses(data);
        setTestStatus('success');
        setTestMessage(`연동 성공! ${data.length}개 과목 발견`);
      } else {
        setTestStatus('success');
        setTestMessage('연동 성공! 하지만 활성 과목이 없습니다.');
      }
    } catch (error) {
      console.error('Canvas test failed:', error);
      setTestStatus('error');
      setTestMessage('연결 실패. Token을 확인하세요.');
    }
  };

  // 설정 저장
  const handleSave = async () => {
    if (!studentId) return;

    setIsSaving(true);

    // localStorage에 저장
    const settings = {
      canvasUrl,
      canvasToken,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`jb_canvas_settings_${studentId}`, JSON.stringify(settings));

    // TODO: Google Sheets에도 저장 (student_profile)

    setIsSaving(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg-page">
      <Navigation />

      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-display text-text-primary mb-6">설정</h1>

        {/* 단어 학습 설정 섹션 */}
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-xl">📖</span>
            </div>
            <div>
              <h2 className="text-heading text-text-primary">단어 학습 설정</h2>
              <p className="text-caption text-text-tertiary">레벨과 일일 학습량을 조정합니다</p>
            </div>
          </div>

          {!wordSettings ? (
            <p className="text-body text-text-tertiary">아직 단어 학습을 시작하지 않았습니다.</p>
          ) : (
            <>
              <div className="mb-4">
                <label className="text-caption text-text-tertiary mb-2 block">단어 레벨</label>
                <div className="space-y-2">
                  {WORD_LEVELS.map(level => (
                    <button
                      key={level.value}
                      onClick={() => setNewMaxLevel(level.value)}
                      className={`w-full p-3 text-left rounded-lg border-2 transition-all text-body ${
                        newMaxLevel === level.value
                          ? 'border-subj-english bg-subj-english/10 text-text-primary font-medium'
                          : 'border-border-subtle bg-bg-page text-text-secondary hover:bg-bg-hover'
                      }`}
                    >
                      {newMaxLevel === level.value && <span className="mr-2">✓</span>}
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-caption text-text-tertiary mb-2 block">
                  일일 단어 수: <strong className="text-text-primary">{newDailyCount}단어</strong>
                </label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={newDailyCount}
                  onChange={(e) => setNewDailyCount(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-caption text-text-tertiary mt-1">
                  <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
                </div>
              </div>

              <button
                onClick={handleSaveWordSettings}
                className="w-full btn bg-subj-english text-white py-3 font-semibold hover:opacity-90"
              >
                {wordSaved ? '✓ 저장됨' : '단어 설정 저장'}
              </button>
            </>
          )}
        </div>

        {/* Canvas 연동 섹션 */}
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <span className="text-xl">🎓</span>
            </div>
            <div>
              <h2 className="text-heading text-text-primary">Canvas LMS 연동</h2>
              <p className="text-caption text-text-tertiary">학교 과제를 자동으로 가져옵니다</p>
            </div>
          </div>

          {/* Canvas URL */}
          <div className="mb-4">
            <label className="text-caption text-text-tertiary mb-2 block">
              Canvas URL
            </label>
            <input
              type="url"
              value={canvasUrl}
              onChange={(e) => setCanvasUrl(e.target.value)}
              placeholder="https://purdue.instructure.com"
              className="w-full px-4 py-3 bg-bg-page border border-border-medium rounded-lg text-body focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Access Token */}
          <div className="mb-4">
            <label className="text-caption text-text-tertiary mb-2 block">
              Access Token
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={canvasToken}
                onChange={(e) => setCanvasToken(e.target.value)}
                placeholder="Canvas에서 발급받은 토큰"
                className="w-full px-4 py-3 pr-12 bg-bg-page border border-border-medium rounded-lg text-body focus:border-purple-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                {showToken ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="text-xs text-text-tertiary mt-1">
              Canvas → 설정 → Access Tokens에서 발급
            </p>
          </div>

          {/* 테스트 결과 */}
          {testStatus && (
            <div className={`mb-4 p-4 rounded-lg ${
              testStatus === 'testing' ? 'bg-bg-sidebar' :
              testStatus === 'success' ? 'bg-success-light' :
              'bg-error-light'
            }`}>
              <div className={`text-body ${
                testStatus === 'testing' ? 'text-text-secondary' :
                testStatus === 'success' ? 'text-success' :
                'text-error'
              }`}>
                {testStatus === 'testing' && '⏳ '}
                {testStatus === 'success' && '✅ '}
                {testStatus === 'error' && '❌ '}
                {testMessage}
              </div>

              {/* 과목 목록 */}
              {courses.length > 0 && (
                <div className="mt-3 space-y-1">
                  {courses.slice(0, 5).map(course => (
                    <div key={course.id} className="text-caption text-text-secondary">
                      • {course.name}
                    </div>
                  ))}
                  {courses.length > 5 && (
                    <div className="text-caption text-text-tertiary">
                      ... 외 {courses.length - 5}개
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className="flex-1 btn btn-secondary disabled:opacity-50"
            >
              {testStatus === 'testing' ? '테스트 중...' : '연동 테스트'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !canvasToken.trim()}
              className="flex-1 btn text-white disabled:opacity-50"
              style={{ backgroundColor: '#7c3aed' }}
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* 토큰 발급 가이드 */}
        <div className="card p-6">
          <h3 className="text-subheading text-text-primary mb-3">
            Access Token 발급 방법
          </h3>
          <ol className="space-y-2 text-body text-text-secondary">
            <li>1. Canvas에 로그인</li>
            <li>2. 좌측 하단 → Account → Settings</li>
            <li>3. Approved Integrations 섹션</li>
            <li>4. "+ New Access Token" 클릭</li>
            <li>5. Purpose: "JubileeBridge" 입력</li>
            <li>6. 생성된 토큰 복사 (한 번만 표시됨!)</li>
          </ol>
        </div>
      </div>

      {/* 토스트 */}
      {showToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-800 text-white rounded-lg shadow-lg">
          설정이 저장되었습니다!
        </div>
      )}
    </div>
  );
}
