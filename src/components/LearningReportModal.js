'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// 색상 상수
const COLORS = {
  primary: 'var(--subj-math)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};

export default function LearningReportModal({ student, onClose }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 전체 학습 이력 로드 (클라이언트에서 필터링)
  useEffect(() => {
    if (!student?.id) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/concept-history?student_id=${student.id}&limit=500`);
        const data = await res.json();
        setEvents(data.events || []);
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setError('학습 이력을 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [student?.id]);

  // 통계 계산
  const stats = useMemo(() => {
    if (events.length === 0) return null;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 최근 7일 이벤트
    const recentEvents = events.filter(e => new Date(e.timestamp) >= sevenDaysAgo);

    // 학습한 개념 수 (중복 제거)
    const uniqueConcepts = new Set(recentEvents.filter(e => e.concept_id).map(e => e.concept_id));
    const conceptsLearned = uniqueConcepts.size;

    // 마스터한 개념 수
    const masteredConcepts = events.filter(e =>
      e.event_type === 'mastery_update' &&
      new Date(e.timestamp) >= sevenDaysAgo
    ).length;

    // 테스트 결과 분석 (오답률 높은 개념)
    const conceptScores = {};
    events.filter(e => e.event_type === 'test_complete').forEach(e => {
      if (!e.concept_id) return;
      if (!conceptScores[e.concept_id]) {
        conceptScores[e.concept_id] = { correct: 0, total: 0 };
      }
      conceptScores[e.concept_id].total++;
      if (e.score >= 70) {
        conceptScores[e.concept_id].correct++;
      }
    });

    // 오답률 높은 개념 Top 5 (최소 2번 이상 시도)
    const weakConcepts = Object.entries(conceptScores)
      .filter(([, stats]) => stats.total >= 2)
      .map(([conceptId, stats]) => ({
        conceptId,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        attempts: stats.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    // 일별 학습량 (최근 14일)
    const dailyActivity = {};
    for (let i = 0; i < 14; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      dailyActivity[dateKey] = 0;
    }

    events
      .filter(e => new Date(e.timestamp) >= fourteenDaysAgo)
      .forEach(e => {
        const dateKey = new Date(e.timestamp).toISOString().split('T')[0];
        if (dailyActivity[dateKey] !== undefined) {
          dailyActivity[dateKey]++;
        }
      });

    // 차트 데이터 (최신 날짜가 오른쪽)
    const chartData = Object.entries(dailyActivity)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date: date.slice(5), // MM-DD 형식
        count,
      }));

    // 평균 테스트 점수
    const testScores = events
      .filter(e => e.event_type === 'test_complete' && e.score !== null)
      .map(e => e.score);
    const avgScore = testScores.length > 0
      ? Math.round(testScores.reduce((a, b) => a + b, 0) / testScores.length)
      : null;

    // 튜터 세션 통계 (Deep Solve)
    const tutorSessions = events.filter(e => e.event_type === 'tutor_session');
    const tutorSessionCount = tutorSessions.length;
    const totalTutorTurns = tutorSessions.reduce((sum, e) => sum + (e.detail?.turn_count || 0), 0);
    const totalTutorMinutes = Math.round(
      tutorSessions.reduce((sum, e) => sum + (e.detail?.duration_sec || 0), 0) / 60
    );

    // 오개념 분석
    const misconceptionCounts = {};
    const misconceptionDetails = []; // { misconception, conceptId, timestamp }
    tutorSessions.forEach(e => {
      const misconceptions = e.detail?.misconceptions || [];
      misconceptions.forEach(m => {
        misconceptionCounts[m] = (misconceptionCounts[m] || 0) + 1;
        misconceptionDetails.push({
          misconception: m,
          conceptId: e.concept_id,
          timestamp: e.timestamp,
        });
      });
    });

    // 빈번한 오개념 Top 5
    const topMisconceptions = Object.entries(misconceptionCounts)
      .map(([misconception, count]) => ({ misconception, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 모든 오개념 (최신순)
    const allMisconceptions = misconceptionDetails
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      conceptsLearned,
      masteredConcepts,
      weakConcepts,
      chartData,
      avgScore,
      totalEvents: events.length,
      tutorSessionCount,
      totalTutorTurns,
      totalTutorMinutes,
      topMisconceptions,
      allMisconceptions,
    };
  }, [events]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border-subtle p-4 flex items-center justify-between">
          <div>
            <h2 className="text-heading text-text-primary">📋 학습 리포트</h2>
            <p className="text-caption text-text-tertiary">{student?.name}</p>
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
          {loading ? (
            <div className="py-8 text-center text-text-tertiary">
              <div className="animate-spin w-8 h-8 border-2 border-subj-math border-t-transparent rounded-full mx-auto mb-2" />
              학습 이력을 불러오는 중...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-danger">{error}</div>
          ) : !stats ? (
            <div className="py-8 text-center text-text-tertiary">
              아직 학습 기록이 없습니다.
            </div>
          ) : (
            <>
              {/* 요약 통계 */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 bg-info-light rounded-lg text-center">
                  <div className="text-stat text-info">{stats.conceptsLearned}</div>
                  <div className="text-caption text-text-tertiary">최근 7일 학습 개념</div>
                </div>
                <div className="p-4 bg-success-light rounded-lg text-center">
                  <div className="text-stat text-success">{stats.masteredConcepts}</div>
                  <div className="text-caption text-text-tertiary">마스터한 개념</div>
                </div>
                <div className="p-4 bg-warning-light rounded-lg text-center">
                  <div className="text-stat text-warning">{stats.avgScore ?? '-'}</div>
                  <div className="text-caption text-text-tertiary">평균 점수</div>
                </div>
                <div className="p-4 bg-bg-sidebar rounded-lg text-center">
                  <div className="text-stat text-text-primary">{stats.totalEvents}</div>
                  <div className="text-caption text-text-tertiary">총 활동 수</div>
                </div>
              </div>

              {/* 튜터 세션 통계 */}
              {stats.tutorSessionCount > 0 && (
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🤖</span>
                    <h3 className="text-ui text-text-primary">AI 튜터 활동</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-heading text-info">{stats.tutorSessionCount}</div>
                      <div className="text-xs text-text-tertiary">대화 세션</div>
                    </div>
                    <div>
                      <div className="text-heading text-info">{stats.totalTutorTurns}</div>
                      <div className="text-xs text-text-tertiary">총 대화 턴</div>
                    </div>
                    <div>
                      <div className="text-heading text-info">{stats.totalTutorMinutes}분</div>
                      <div className="text-xs text-text-tertiary">튜터링 시간</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 발견된 오개념 */}
              {stats.allMisconceptions.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-ui text-text-primary mb-3">⚠️ 발견된 오개념</h3>

                  {/* Top 5 빈번한 오개념 */}
                  {stats.topMisconceptions.length > 0 && (
                    <div className="mb-4 p-3 bg-warning-light rounded-lg border border-warning/30">
                      <div className="text-xs text-warning font-medium mb-2">가장 빈번한 오개념 Top 5</div>
                      <div className="space-y-2">
                        {stats.topMisconceptions.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-warning text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <div className="text-caption text-text-primary">{item.misconception}</div>
                              <div className="text-xs text-text-tertiary">{item.count}회 발견</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 전체 오개념 목록 */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {stats.allMisconceptions.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-bg-sidebar rounded-lg text-caption"
                      >
                        <div className="flex items-center gap-2 text-text-tertiary text-xs mb-1">
                          <span className="font-mono">{item.conceptId}</span>
                          <span>·</span>
                          <span>{new Date(item.timestamp).toLocaleDateString('ko-KR')}</span>
                        </div>
                        <div className="text-text-primary">{item.misconception}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 일별 학습량 차트 */}
              <div className="mb-6">
                <h3 className="text-ui text-text-primary mb-3">📊 일별 학습량 (최근 14일)</h3>
                <div className="bg-bg-sidebar rounded-lg p-3" style={{ height: '150px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={(value) => [`${value}개 활동`, '학습량']}
                        contentStyle={{
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {stats.chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.count > 0 ? 'var(--subj-math)' : 'var(--bg-hover)'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 오답률 높은 개념 */}
              <div>
                <h3 className="text-ui text-text-primary mb-3">🎯 집중 필요 개념 Top 5</h3>
                {stats.weakConcepts.length > 0 ? (
                  <div className="space-y-2">
                    {stats.weakConcepts.map((concept, idx) => (
                      <div
                        key={concept.conceptId}
                        className="flex items-center justify-between p-3 bg-bg-sidebar rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            concept.accuracy < 50 ? 'bg-danger text-white' : 'bg-warning text-white'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-caption text-text-primary font-mono">
                              {concept.conceptId}
                            </div>
                            <div className="text-xs text-text-tertiary">
                              {concept.attempts}회 시도
                            </div>
                          </div>
                        </div>
                        <div className={`text-ui font-bold ${
                          concept.accuracy < 50 ? 'text-danger' : 'text-warning'
                        }`}>
                          {concept.accuracy}%
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-text-tertiary bg-bg-sidebar rounded-lg">
                    충분한 데이터가 없습니다<br />
                    <span className="text-xs">(2회 이상 시도한 개념 기준)</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
