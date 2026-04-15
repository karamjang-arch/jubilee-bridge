'use client';

import { useState, useRef, useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useCurriculum } from '@/hooks/useCurriculum';

/**
 * 숙제/시험 사진 분석 컴포넌트
 * - 이미지 업로드 (카메라/갤러리)
 * - Gemini Vision으로 문제 분석
 * - 스킬맵 연동
 */
export default function HomeworkScanner({ onClose, onNavigateToSkillmap, onNavigateToTutor }) {
  const { studentId } = useProfile();
  const { curriculum } = useCurriculum();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload'); // upload | analyzing | result
  const [images, setImages] = useState([]); // { file, preview, base64 }[]
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('math');

  const subjects = curriculum === 'kr'
    ? [
        { value: 'math', label: '수학' },
        { value: 'korean', label: '국어' },
        { value: 'english', label: '영어' },
        { value: 'physics', label: '물리' },
        { value: 'chemistry', label: '화학' },
        { value: 'biology', label: '생물' },
      ]
    : [
        { value: 'math', label: 'Math' },
        { value: 'english', label: 'English' },
        { value: 'physics', label: 'Physics' },
        { value: 'chemistry', label: 'Chemistry' },
        { value: 'biology', label: 'Biology' },
        { value: 'history', label: 'History' },
      ];

  // 이미지 리사이즈 및 base64 변환
  const processImage = useCallback((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 1024;
          let { width, height } = img;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height * maxSize) / width;
              width = maxSize;
            } else {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          resolve({
            file,
            preview: URL.createObjectURL(file),
            base64,
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // 파일 선택 처리
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 최대 3장
    const filesToProcess = files.slice(0, 3 - images.length);

    const processed = await Promise.all(filesToProcess.map(processImage));
    setImages(prev => [...prev, ...processed].slice(0, 3));
    setError(null);
  };

  // 이미지 제거
  const removeImage = (index) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  // 드래그앤드롭
  const handleDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const filesToProcess = files.slice(0, 3 - images.length);
    const processed = await Promise.all(filesToProcess.map(processImage));
    setImages(prev => [...prev, ...processed].slice(0, 3));
    setError(null);
  };

  // 분석 시작
  const handleAnalyze = async () => {
    if (images.length === 0) return;

    setStep('analyzing');
    setError(null);

    try {
      // 첫 번째 이미지만 분석 (추후 여러 장 지원 가능)
      const res = await fetch('/api/homework-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          curriculum,
          subject: selectedSubject,
          image: images[0].base64,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || data.reason || '분석에 실패했습니다.');
      }

      setResults(data);
      setStep('result');
    } catch (err) {
      console.error('Homework scan error:', err);
      setError(err.message);
      setStep('upload');
    }
  };

  // 오답 문제 튜터로 이동
  const handleTutorClick = (problem) => {
    if (onNavigateToTutor && problem.matched_concept) {
      onNavigateToTutor({
        conceptId: problem.matched_concept.concept_id,
        problemContext: {
          question: problem.problem_text,
          user_answer: problem.student_answer,
          correct_answer: problem.correct_answer,
        },
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border-subtle p-4 flex items-center justify-between">
          <div>
            <h2 className="text-heading text-text-primary">📸 숙제 분석</h2>
            <p className="text-caption text-text-tertiary">
              {step === 'upload' && '사진을 업로드하세요'}
              {step === 'analyzing' && 'AI가 분석 중...'}
              {step === 'result' && '분석 완료'}
            </p>
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

        {/* Content */}
        <div className="p-4">
          {/* Upload Step */}
          {step === 'upload' && (
            <>
              {/* 과목 선택 */}
              <div className="mb-4">
                <label className="block text-caption text-text-secondary mb-2">과목 선택</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-body focus:ring-2 focus:ring-info focus:border-info"
                >
                  {subjects.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* 이미지 업로드 영역 */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => images.length < 3 && fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                  ${images.length >= 3 ? 'border-border-subtle bg-bg-sidebar cursor-not-allowed' : 'border-info hover:bg-info-light'}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="text-4xl mb-2">📷</div>
                <div className="text-body text-text-primary mb-1">
                  {images.length >= 3 ? '최대 3장까지 업로드 가능' : '사진을 선택하거나 드래그하세요'}
                </div>
                <div className="text-caption text-text-tertiary">
                  모바일: 카메라로 직접 촬영 가능
                </div>
              </div>

              {/* 업로드된 이미지 미리보기 */}
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={img.preview}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(idx);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-danger text-white rounded-full flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 에러 메시지 */}
              {error && (
                <div className="mt-4 p-3 bg-danger-light text-danger rounded-lg text-caption">
                  {error}
                </div>
              )}

              {/* 분석 버튼 */}
              <button
                onClick={handleAnalyze}
                disabled={images.length === 0}
                className={`
                  mt-4 w-full py-3 rounded-lg font-medium transition-colors
                  ${images.length > 0
                    ? 'bg-info text-white hover:bg-info-dark'
                    : 'bg-bg-sidebar text-text-disabled cursor-not-allowed'}
                `}
              >
                분석 시작
              </button>

              {/* 안내 문구 */}
              <p className="mt-3 text-xs text-text-tertiary text-center">
                AI 분석은 참고용입니다. 정확하지 않을 수 있어요.
              </p>
            </>
          )}

          {/* Analyzing Step */}
          {step === 'analyzing' && (
            <div className="py-12 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-info border-t-transparent rounded-full mx-auto mb-4" />
              <div className="text-body text-text-primary mb-2">AI가 문제를 분석하고 있어요</div>
              <div className="text-caption text-text-tertiary">잠시만 기다려주세요...</div>
            </div>
          )}

          {/* Result Step */}
          {step === 'result' && results && (
            <>
              {/* 요약 */}
              <div className="mb-4 p-4 bg-gradient-to-r from-info-light to-success-light rounded-xl">
                <div className="grid grid-cols-3 gap-4 text-center mb-3">
                  <div>
                    <div className="text-stat text-info">{results.summary?.correct || 0}</div>
                    <div className="text-xs text-text-tertiary">정답</div>
                  </div>
                  <div>
                    <div className="text-stat text-warning">
                      {(results.summary?.total || 0) - (results.summary?.correct || 0)}
                    </div>
                    <div className="text-xs text-text-tertiary">오답</div>
                  </div>
                  <div>
                    <div className="text-stat text-success">{results.summary?.accuracy || 0}%</div>
                    <div className="text-xs text-text-tertiary">정확도</div>
                  </div>
                </div>

                {/* XP 획득 */}
                <div className="flex items-center justify-center gap-2 p-2 bg-white/50 rounded-lg">
                  <span className="text-lg">⭐</span>
                  <span className="text-body font-medium text-warning">
                    +{results.summary?.xp_earned || 0} XP 획득!
                  </span>
                </div>

                {/* XP 내역 */}
                {results.summary?.xp_breakdown && (
                  <div className="mt-2 text-xs text-text-tertiary text-center">
                    업로드 +5
                    {results.summary.xp_breakdown.correct_answers > 0 && ` · 정답 +${results.summary.xp_breakdown.correct_answers}`}
                    {results.summary.xp_breakdown.accuracy_bonus > 0 && ' · 90%+ 보너스 +20'}
                  </div>
                )}
              </div>

              {/* 취약 영역 */}
              {results.summary?.weak_areas?.length > 0 && (
                <div className="mb-4 p-3 bg-warning-light rounded-lg">
                  <div className="text-caption font-medium text-warning mb-1">취약 영역</div>
                  <div className="flex flex-wrap gap-1">
                    {results.summary.weak_areas.map((area, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-white rounded text-xs text-text-secondary">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 문제별 결과 */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.problems?.map((problem, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      problem.is_correct
                        ? 'border-success bg-success-light/30'
                        : 'border-danger bg-danger-light/30'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{problem.is_correct ? '✅' : '❌'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-caption font-medium text-text-primary">
                          문제 {problem.problem_number}
                        </div>
                        <div className="text-xs text-text-secondary line-clamp-2 mb-1">
                          {problem.problem_text}
                        </div>

                        {/* 관련 개념 */}
                        {problem.matched_concept && (
                          <div className="text-xs text-info mb-1">
                            📚 {problem.matched_concept.title}
                          </div>
                        )}

                        {/* 오답인 경우 */}
                        {!problem.is_correct && (
                          <>
                            <div className="text-xs text-text-tertiary">
                              내 답: <span className="text-danger">{problem.student_answer}</span>
                              {' → '}
                              정답: <span className="text-success">{problem.correct_answer}</span>
                            </div>

                            {problem.misconception && (
                              <div className="mt-1 text-xs text-warning">
                                💡 {problem.misconception}
                              </div>
                            )}

                            {/* 튜터와 대화 버튼 */}
                            {problem.matched_concept && (
                              <button
                                onClick={() => handleTutorClick(problem)}
                                className="mt-2 text-xs text-info hover:underline"
                              >
                                🤖 이 문제에 대해 튜터와 대화하기 →
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 하단 버튼 */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setStep('upload');
                    setImages([]);
                    setResults(null);
                  }}
                  className="flex-1 py-2 border border-border-subtle rounded-lg text-caption text-text-secondary hover:bg-bg-hover"
                >
                  다시 분석하기
                </button>
                <button
                  onClick={() => {
                    onNavigateToSkillmap?.();
                    onClose();
                  }}
                  className="flex-1 py-2 bg-info text-white rounded-lg text-caption hover:bg-info-dark"
                >
                  스킬맵에서 확인
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
