'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';

const EVENT_LABELS = {
  content_view: { label: '콘텐츠 열람', icon: '👁️', color: 'text-info' },
  test_attempt: { label: '테스트 시작', icon: '📝', color: 'text-warning' },
  test_complete: { label: '테스트 완료', icon: '✅', color: 'text-success' },
  essay_submit: { label: '에세이 채점', icon: '✍️', color: 'text-subj-english' },
  mastery_update: { label: '숙달도 변경', icon: '🎯', color: 'text-subj-math' },
  review_scheduled: { label: '복습 예약', icon: '📅', color: 'text-text-tertiary' }
};

const SUBJECT_LABELS = {
  math: '수학',
  english: '영어',
  korean: '국어',
  science: '과학',
  social: '사회',
  history: '한국사',
  ethics: '도덕',
  essay: '에세이'
};

export default function ConceptHistoryCard() {
  const { studentId } = useProfile();
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/concept-history?student_id=${studentId}&limit=10`);
        const data = await res.json();
        setEvents(data.events || []);
        setStats(data.stats || null);
      } catch (error) {
        console.error('Failed to fetch concept history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [studentId]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;

    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="card p-5">
        <h2 className="text-subheading text-text-primary mb-4">학습 기록</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-bg-sidebar rounded" />
          <div className="h-10 bg-bg-sidebar rounded" />
          <div className="h-10 bg-bg-sidebar rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-subheading text-text-primary">학습 기록</h2>
        {stats && (
          <span className="text-caption text-text-tertiary">
            총 {stats.totalDurationMin}분 학습
          </span>
        )}
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-success-light rounded-lg text-center">
            <div className="text-stat text-success">{stats.eventCounts?.test_complete || 0}</div>
            <div className="text-xs text-text-tertiary">테스트</div>
          </div>
          <div className="p-3 bg-info-light rounded-lg text-center">
            <div className="text-stat text-info">{stats.eventCounts?.essay_submit || 0}</div>
            <div className="text-xs text-text-tertiary">에세이</div>
          </div>
          <div className="p-3 bg-warning-light rounded-lg text-center">
            <div className="text-stat text-warning">{stats.avgTestScore || '-'}</div>
            <div className="text-xs text-text-tertiary">평균점</div>
          </div>
        </div>
      )}

      {/* Recent Events */}
      {events.length === 0 ? (
        <div className="text-center py-6 text-text-tertiary">
          <span className="text-3xl block mb-2">📊</span>
          <p className="text-caption">아직 학습 기록이 없습니다</p>
          <p className="text-xs mt-1">테스트나 에세이를 제출하면 기록됩니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(expanded ? events : events.slice(0, 5)).map((event, idx) => {
            const eventInfo = EVENT_LABELS[event.event_type] || { label: event.event_type, icon: '📌', color: 'text-text-secondary' };

            return (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-sidebar transition-colors">
                <span className="text-lg">{eventInfo.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-caption font-medium ${eventInfo.color}`}>
                      {eventInfo.label}
                    </span>
                    {event.subject && (
                      <span className="text-xs text-text-tertiary">
                        {SUBJECT_LABELS[event.subject] || event.subject}
                      </span>
                    )}
                  </div>
                  {event.concept_id && (
                    <div className="text-xs text-text-tertiary truncate">
                      {event.concept_id}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {event.score !== null && event.score !== undefined && (
                    <div className={`text-caption font-medium ${
                      event.score >= 80 ? 'text-success' : event.score >= 60 ? 'text-warning' : 'text-red-500'
                    }`}>
                      {event.score}점
                    </div>
                  )}
                  <div className="text-xs text-text-tertiary">
                    {formatTime(event.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show More Button */}
      {events.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 py-2 text-caption text-info hover:bg-info-light rounded-lg transition-colors"
        >
          {expanded ? '접기 ▲' : `더 보기 (${events.length - 5}개) ▼`}
        </button>
      )}

      {/* Subject Distribution */}
      {stats?.subjectCounts && Object.keys(stats.subjectCounts).length > 0 && (
        <div className="mt-4 pt-4 border-t border-border-subtle">
          <h3 className="text-xs text-text-tertiary mb-2">과목별 활동</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.subjectCounts).map(([subject, count]) => (
              <span key={subject} className="px-2 py-1 bg-bg-sidebar rounded text-xs text-text-secondary">
                {SUBJECT_LABELS[subject] || subject} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
