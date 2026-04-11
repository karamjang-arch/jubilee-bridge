'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import DashboardLayout from '@/components/DashboardLayout';
import { SUBJECTS, getSubjectColor, getSubjectLightColor } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';

export default function CalendarPage() {
  const { studentId } = useProfile();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [jbAssignments, setJbAssignments] = useState([]);
  const [canvasAssignments, setCanvasAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Canvas 과제 로드
  useEffect(() => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    const fetchCanvasAssignments = async () => {
      const savedSettings = localStorage.getItem(`jb_canvas_settings_${studentId}`);
      if (!savedSettings) {
        setIsLoading(false);
        return;
      }

      const settings = JSON.parse(savedSettings);
      if (!settings.canvasToken) {
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
          // Canvas 과제를 캘린더 형식으로 변환
          const formatted = data.data.map(a => ({
            id: `canvas_${a.id}`,
            title: a.name,
            subject: 'canvas',
            courseName: a.course_name,
            dueDate: new Date(a.due_at),
            status: a.submitted ? 'completed' : 'pending',
            points: a.points_possible,
            url: a.html_url,
            isCanvas: true,
          }));
          setCanvasAssignments(formatted);
        }
      } catch (error) {
        console.error('Failed to fetch Canvas assignments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCanvasAssignments();
  }, [studentId]);

  // 모든 과제 통합
  const allAssignments = [...jbAssignments, ...canvasAssignments];

  // 날짜별 과제 그룹핑
  const assignmentsByDate = allAssignments.reduce((acc, a) => {
    const dateKey = format(a.dueDate, 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(a);
    return acc;
  }, {});

  // 과제 완료 토글 (JB 과제만)
  const toggleComplete = (id) => {
    if (id.startsWith('canvas_')) return; // Canvas 과제는 토글 불가
    setJbAssignments(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, status: a.status === 'completed' ? 'pending' : 'completed' }
          : a
      )
    );
  };

  // 주 이동
  const navigateWeek = (direction) => {
    setCurrentWeek(prev => addDays(prev, direction * 7));
  };

  // Canvas 과제 스타일
  const getAssignmentStyle = (assignment) => {
    if (assignment.isCanvas) {
      return {
        backgroundColor: '#f3e8ff', // purple-100
        borderLeft: '3px solid #7c3aed', // purple-600
      };
    }
    return {
      backgroundColor: getSubjectLightColor(assignment.subject),
      borderLeft: `3px solid ${getSubjectColor(assignment.subject)}`,
    };
  };

  // 통계 계산
  const totalAssignments = allAssignments.length;
  const completedCount = allAssignments.filter(a => a.status === 'completed').length;
  const pendingCount = allAssignments.filter(a => a.status === 'pending').length;
  const canvasCount = canvasAssignments.length;

  return (
    <DashboardLayout showSidebar={false}>
      <div className="p-6 max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-display text-text-primary">과제 캘린더</h1>
            <p className="text-body text-text-secondary mt-1">
              {format(weekStart, 'yyyy년 M월', { locale: ko })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 hover:bg-bg-hover rounded-md transition-colors"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentWeek(new Date())}
              className="px-3 py-1.5 text-ui text-text-secondary hover:bg-bg-hover rounded-md transition-colors"
            >
              오늘
            </button>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 hover:bg-bg-hover rounded-md transition-colors"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 범례 */}
        {canvasCount > 0 && (
          <div className="flex items-center gap-4 mb-4 text-caption text-text-tertiary">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-purple-500" />
              <span>🎓 Canvas 과제</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-subj-math" />
              <span>JubileeBridge 과제</span>
            </div>
          </div>
        )}

        {/* 로딩 */}
        {isLoading ? (
          <div className="card p-12 text-center">
            <div className="text-text-tertiary">과제 로딩 중...</div>
          </div>
        ) : (
          <>
            {/* 주간 캘린더 */}
            <div className="card overflow-hidden">
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 border-b border-border-subtle">
                {weekDays.map((day, idx) => (
                  <div
                    key={idx}
                    className={`
                      p-4 text-center border-r border-border-subtle last:border-r-0
                      ${isToday(day) ? 'bg-subj-math-light' : 'bg-bg-sidebar'}
                    `}
                  >
                    <div className="text-caption text-text-tertiary mb-1">
                      {format(day, 'EEE', { locale: ko })}
                    </div>
                    <div
                      className={`
                        text-subheading
                        ${isToday(day) ? 'text-subj-math font-semibold' : 'text-text-primary'}
                      `}
                    >
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              {/* 과제 그리드 */}
              <div className="grid grid-cols-7 min-h-[400px]">
                {weekDays.map((day, idx) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayAssignments = assignmentsByDate[dateKey] || [];

                  return (
                    <div
                      key={idx}
                      className={`
                        p-2 border-r border-b border-border-subtle last:border-r-0
                        ${isToday(day) ? 'bg-subj-math-light/30' : ''}
                      `}
                    >
                      {dayAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          onClick={() => {
                            if (assignment.isCanvas) {
                              setSelectedAssignment(assignment);
                            } else {
                              toggleComplete(assignment.id);
                            }
                          }}
                          className={`
                            mb-2 p-2 rounded-md text-caption cursor-pointer transition-all
                            ${assignment.status === 'completed' ? 'opacity-60' : ''}
                          `}
                          style={getAssignmentStyle(assignment)}
                        >
                          <div className="flex items-start gap-2">
                            {assignment.isCanvas ? (
                              <span className="mt-0.5 flex-shrink-0">🎓</span>
                            ) : (
                              <span
                                className={`
                                  mt-0.5 w-3.5 h-3.5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center
                                  ${assignment.status === 'completed'
                                    ? 'bg-success border-success text-white'
                                    : 'border-border-strong'
                                  }
                                `}
                              >
                                {assignment.status === 'completed' && (
                                  <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <div
                                className={`
                                  font-medium truncate
                                  ${assignment.status === 'completed' ? 'line-through text-text-tertiary' : 'text-text-primary'}
                                `}
                              >
                                {assignment.title}
                              </div>
                              <div className="text-text-tertiary mt-0.5">
                                {assignment.isCanvas ? assignment.courseName : format(assignment.dueDate, 'HH:mm')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* 빈 날짜 표시 */}
                      {dayAssignments.length === 0 && (
                        <div className="h-full flex items-center justify-center opacity-30">
                          <span className="text-text-disabled text-sm">-</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 이번 주 요약 */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4">
                <div className="text-caption text-text-tertiary mb-1">총 과제</div>
                <div className="text-stat text-text-primary">{totalAssignments}</div>
              </div>
              <div className="card p-4">
                <div className="text-caption text-text-tertiary mb-1">완료</div>
                <div className="text-stat text-success">{completedCount}</div>
              </div>
              <div className="card p-4">
                <div className="text-caption text-text-tertiary mb-1">남은 과제</div>
                <div className="text-stat text-warning">{pendingCount}</div>
              </div>
              <div className="card p-4">
                <div className="text-caption text-text-tertiary mb-1">🎓 Canvas</div>
                <div className="text-stat text-purple-600">{canvasCount}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Canvas 과제 상세 모달 */}
      {selectedAssignment && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setSelectedAssignment(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-card rounded-xl shadow-elevated z-50 p-6 w-full max-w-md">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎓</span>
                <div>
                  <h3 className="text-heading text-text-primary">
                    {selectedAssignment.title}
                  </h3>
                  <p className="text-caption text-purple-600">
                    {selectedAssignment.courseName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="text-text-tertiary hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-body">
                <span className="text-text-tertiary">마감일</span>
                <span className="text-text-primary">
                  {format(selectedAssignment.dueDate, 'M월 d일 (EEE) HH:mm', { locale: ko })}
                </span>
              </div>
              {selectedAssignment.points > 0 && (
                <div className="flex justify-between text-body">
                  <span className="text-text-tertiary">배점</span>
                  <span className="text-text-primary">{selectedAssignment.points}점</span>
                </div>
              )}
              <div className="flex justify-between text-body">
                <span className="text-text-tertiary">상태</span>
                <span className={selectedAssignment.status === 'completed' ? 'text-success' : 'text-warning'}>
                  {selectedAssignment.status === 'completed' ? '제출됨' : '미제출'}
                </span>
              </div>
            </div>

            <a
              href={selectedAssignment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn w-full justify-center text-white"
              style={{ backgroundColor: '#7c3aed' }}
            >
              Canvas에서 열기 →
            </a>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
