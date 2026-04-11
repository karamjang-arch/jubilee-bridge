'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/useProfile';

// D-day 계산
function getDday(dueAt) {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const now = new Date();
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `D+${Math.abs(diff)}`;
  if (diff === 0) return 'D-Day';
  return `D-${diff}`;
}

// 마감 임박 여부
function isUrgent(dueAt) {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  const now = new Date();
  const hoursLeft = (due - now) / (1000 * 60 * 60);
  return hoursLeft <= 48 && hoursLeft > 0;
}

export default function CanvasAssignmentsCard() {
  const { studentId } = useProfile();
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    const fetchAssignments = async () => {
      // Canvas 설정 확인
      const savedSettings = localStorage.getItem(`jb_canvas_settings_${studentId}`);
      if (!savedSettings) {
        setNeedsSetup(true);
        setIsLoading(false);
        return;
      }

      const settings = JSON.parse(savedSettings);
      if (!settings.canvasToken) {
        setNeedsSetup(true);
        setIsLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          student: studentId,
          canvasUrl: settings.canvasUrl,
          canvasToken: settings.canvasToken,
        });

        const res = await fetch(`/api/canvas/assignments?${params}`);
        const data = await res.json();

        if (data.success) {
          // 이번 주 마감 과제만 필터링
          const now = new Date();
          const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          const thisWeek = data.data.filter(a => {
            const due = new Date(a.due_at);
            return due >= now && due <= weekLater;
          });

          setAssignments(thisWeek);
          setError(null);
        } else if (data.needsSetup) {
          setNeedsSetup(true);
        } else {
          setError(data.error);
        }
      } catch (err) {
        console.error('Failed to fetch Canvas assignments:', err);
        setError('과제를 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignments();
  }, [studentId]);

  // 로딩
  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-bg-hover rounded w-1/3 mb-4" />
          <div className="h-4 bg-bg-hover rounded w-2/3 mb-2" />
          <div className="h-4 bg-bg-hover rounded w-1/2" />
        </div>
      </div>
    );
  }

  // 설정 필요
  if (needsSetup) {
    return (
      <div className="card overflow-hidden">
        <div className="h-1 bg-purple-500" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-xl">🎓</span>
            </div>
            <div>
              <h3 className="text-heading text-text-primary">학교 과제</h3>
              <p className="text-caption text-text-tertiary">Canvas 연동이 필요합니다</p>
            </div>
          </div>

          <Link
            href="/settings"
            className="btn w-full justify-center"
            style={{ backgroundColor: '#7c3aed', color: 'white' }}
          >
            설정으로 이동 →
          </Link>
        </div>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="card overflow-hidden">
        <div className="h-1 bg-purple-500" />
        <div className="p-6 text-center">
          <p className="text-body text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="h-1 bg-purple-500" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-xl">🎓</span>
            </div>
            <div>
              <h3 className="text-heading text-text-primary">이번 주 학교 과제</h3>
              <p className="text-caption text-text-tertiary">
                {assignments.length}개 과제
              </p>
            </div>
          </div>
          <Link href="/calendar" className="text-caption text-purple-600 hover:underline">
            전체 보기
          </Link>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-4 text-body text-text-tertiary">
            이번 주 마감 과제가 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.slice(0, 5).map(assignment => (
              <a
                key={assignment.id}
                href={assignment.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block p-3 rounded-lg transition-colors ${
                  isUrgent(assignment.due_at)
                    ? 'bg-warning-light hover:bg-warning-light/80'
                    : 'bg-bg-sidebar hover:bg-bg-hover'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-body text-text-primary truncate">
                      {assignment.name}
                    </div>
                    <div className="text-caption text-text-tertiary truncate">
                      {assignment.course_name}
                    </div>
                  </div>
                  <div className={`ml-3 px-2 py-1 rounded text-xs font-medium ${
                    isUrgent(assignment.due_at)
                      ? 'bg-warning text-white'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {getDday(assignment.due_at)}
                  </div>
                </div>
                {assignment.points_possible > 0 && (
                  <div className="text-xs text-text-tertiary mt-1">
                    {assignment.points_possible}점
                  </div>
                )}
              </a>
            ))}
            {assignments.length > 5 && (
              <div className="text-center text-caption text-text-tertiary pt-2">
                +{assignments.length - 5}개 더
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
