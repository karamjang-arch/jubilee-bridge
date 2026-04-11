'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from 'recharts';

// Axis colors by key
const AXIS_COLORS = {
  // General essay
  thesis_focus: '#3b82f6',
  audience_awareness: '#10b981',
  voice_style: '#f59e0b',
  organization: '#8b5cf6',
  evidence_support: '#ef4444',
  // Book response
  text_comprehension: '#3b82f6',
  critical_perspective: '#10b981',
  personal_connection: '#f59e0b',
  textual_evidence: '#ef4444',
  // Argumentative
  reading_comprehension: '#3b82f6',
  critical_thinking: '#10b981',
  synthesis: '#f59e0b',
  logical_structure: '#8b5cf6',
  expression: '#ef4444',
};

const GRADE_LABELS = {
  elementary: '초등',
  middle: '중등',
  high: '고등',
};

const TRACK_LABELS = {
  general: { ko: '일반 에세이', en: 'General Essay', icon: '📝' },
  book_response: { ko: '독서 에세이', en: 'Book Response', icon: '📚' },
  argumentative: { ko: '입시 논술', en: 'Argumentative', icon: '📋' },
};

export default function EssayResultPage() {
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [essayText, setEssayText] = useState('');
  const [showEssay, setShowEssay] = useState(false);

  useEffect(() => {
    const storedResult = sessionStorage.getItem('essayResult');
    const storedEssay = sessionStorage.getItem('essayText');

    if (!storedResult) {
      router.push('/essay/submit');
      return;
    }

    setResult(JSON.parse(storedResult));
    setEssayText(storedEssay || '');
  }, [router]);

  if (!result) {
    return (
      <DashboardLayout showSidebar={false}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-border-subtle border-t-text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Prepare radar chart data
  const radarData = result.axes.map(axis => ({
    subject: axis.name,
    score: axis.score,
    fullMark: axis.max,
    percentage: Math.round((axis.score / axis.max) * 100),
  }));

  // Score grade
  const getScoreGrade = (score) => {
    if (score >= 90) return { grade: 'A', color: '#10b981', label: '우수' };
    if (score >= 80) return { grade: 'B', color: '#3b82f6', label: '양호' };
    if (score >= 70) return { grade: 'C', color: '#f59e0b', label: '보통' };
    if (score >= 60) return { grade: 'D', color: '#f97316', label: '미흡' };
    return { grade: 'F', color: '#ef4444', label: '개선 필요' };
  };

  const scoreInfo = getScoreGrade(result.total_score);
  const trackInfo = TRACK_LABELS[result.metadata?.essayType] || TRACK_LABELS.general;
  const isKorean = result.metadata?.language === 'ko';

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/essay/submit" className="text-caption text-text-tertiary hover:text-text-secondary mb-2 inline-block">
            ← 새 에세이 작성
          </Link>
          <h1 className="text-display text-text-primary">채점 결과</h1>
          {result.metadata && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl">{trackInfo.icon}</span>
              <p className="text-caption text-text-tertiary">
                {isKorean ? trackInfo.ko : trackInfo.en} · {GRADE_LABELS[result.metadata.gradeBand]} · {result.metadata.language === 'ko' ? '한국어' : 'English'} · {result.metadata.charCount}자
              </p>
            </div>
          )}
          {result.metadata?.bookTitle && (
            <p className="text-caption text-info mt-1">
              책: "{result.metadata.bookTitle}"
            </p>
          )}
        </div>

        {/* Total Score Card */}
        <div className="card p-6 mb-6 text-center">
          <div className="inline-flex items-baseline gap-2">
            <span
              className="text-6xl font-bold"
              style={{ color: scoreInfo.color }}
            >
              {result.total_score}
            </span>
            <span className="text-2xl text-text-secondary">/ 100</span>
          </div>
          <div className="mt-2">
            <span
              className="inline-block px-4 py-1 rounded-full text-white font-medium"
              style={{ backgroundColor: scoreInfo.color }}
            >
              {scoreInfo.grade} - {scoreInfo.label}
            </span>
          </div>
        </div>

        {/* Radar Chart + Axis Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Radar Chart */}
          <div className="card p-5">
            <h2 className="text-subheading text-text-primary mb-4">5축 분석</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border-subtle)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Radar
                    name="점수"
                    dataKey="percentage"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${props.payload.score}/${props.payload.fullMark} (${value}%)`,
                      props.payload.subject
                    ]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Axis Details */}
          <div className="card p-5">
            <h2 className="text-subheading text-text-primary mb-4">축별 점수</h2>
            <div className="space-y-4">
              {result.axes.map((axis) => {
                const pct = Math.round((axis.score / axis.max) * 100);
                return (
                  <div key={axis.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-caption font-medium text-text-primary">{axis.name}</span>
                      <span className="text-caption text-text-secondary">{axis.score}/{axis.max}</span>
                    </div>
                    <div className="h-2 bg-bg-sidebar rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: AXIS_COLORS[axis.key] || '#3b82f6'
                        }}
                      />
                    </div>
                    <p className="text-xs text-text-tertiary mt-1">{axis.feedback}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Strengths */}
          <div className="card p-5">
            <h2 className="text-subheading text-success mb-3 flex items-center gap-2">
              <span>✓</span> 강점
            </h2>
            <ul className="space-y-2">
              {result.strengths.map((s, i) => (
                <li key={i} className="text-body text-text-secondary flex gap-2">
                  <span className="text-success">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Improvements */}
          <div className="card p-5">
            <h2 className="text-subheading text-warning mb-3 flex items-center gap-2">
              <span>△</span> 개선점
            </h2>
            <ul className="space-y-2">
              {result.improvements.map((s, i) => (
                <li key={i} className="text-body text-text-secondary flex gap-2">
                  <span className="text-warning">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Model Sentence */}
        {result.model_sentence && (
          <div className="card p-5 mb-6 bg-info-light border-info">
            <h2 className="text-subheading text-info mb-2 flex items-center gap-2">
              <span>💡</span> 모범 문장
            </h2>
            <p className="text-body text-text-primary italic">"{result.model_sentence}"</p>
          </div>
        )}

        {/* Show/Hide Essay */}
        <div className="mb-6">
          <button
            onClick={() => setShowEssay(!showEssay)}
            className="text-caption text-info hover:underline"
          >
            {showEssay ? '에세이 숨기기 ▲' : '제출한 에세이 보기 ▼'}
          </button>
          {showEssay && (
            <div className="mt-3 p-4 bg-bg-sidebar rounded-lg">
              <pre className="whitespace-pre-wrap text-caption text-text-secondary font-mono">
                {essayText}
              </pre>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link
            href="/essay/submit"
            className="flex-1 py-3 text-center rounded-lg border border-border-subtle text-text-secondary hover:bg-bg-sidebar transition-colors"
          >
            새 에세이 작성
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 py-3 text-center rounded-lg bg-text-primary text-bg-card hover:opacity-90 transition-colors"
          >
            대시보드로
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
