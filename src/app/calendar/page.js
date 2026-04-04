'use client';

import { useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import DashboardLayout from '@/components/DashboardLayout';
import { SUBJECTS, getSubjectColor, getSubjectLightColor } from '@/lib/constants';

// 샘플 과제 데이터
const SAMPLE_ASSIGNMENTS = [
  {
    id: '1',
    title: 'SAT Math Practice Test #3',
    subject: 'math',
    cbId: 'MATH-ALG-001',
    dueDate: new Date(2026, 3, 3, 23, 59),
    status: 'completed',
  },
  {
    id: '2',
    title: 'Physics Chapter 5 Review',
    subject: 'physics',
    cbId: 'PHY-MECH-005',
    dueDate: new Date(2026, 3, 4, 23, 59),
    status: 'pending',
  },
  {
    id: '3',
    title: 'English Vocabulary Quiz',
    subject: 'english',
    cbId: 'ENG-VOCAB-012',
    dueDate: new Date(2026, 3, 5, 14, 0),
    status: 'pending',
  },
  {
    id: '4',
    title: 'Chemistry Lab Report',
    subject: 'chemistry',
    cbId: 'CHEM-ORG-003',
    dueDate: new Date(2026, 3, 6, 23, 59),
    status: 'pending',
  },
];

export default function CalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [assignments, setAssignments] = useState(SAMPLE_ASSIGNMENTS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // 날짜별 과제 그룹핑
  const assignmentsByDate = assignments.reduce((acc, a) => {
    const dateKey = format(a.dueDate, 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(a);
    return acc;
  }, {});

  // 과제 완료 토글
  const toggleComplete = (id) => {
    setAssignments(prev =>
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
                  onClick={() => {
                    setSelectedDate(day);
                    setShowAddModal(true);
                  }}
                  className={`
                    p-2 border-r border-b border-border-subtle last:border-r-0 cursor-pointer
                    hover:bg-bg-hover transition-colors
                    ${isToday(day) ? 'bg-subj-math-light/30' : ''}
                  `}
                >
                  {dayAssignments.map((assignment) => {
                    const subject = SUBJECTS.find(s => s.id === assignment.subject);
                    return (
                      <div
                        key={assignment.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComplete(assignment.id);
                        }}
                        className={`
                          mb-2 p-2 rounded-md text-caption cursor-pointer transition-all
                          ${assignment.status === 'completed' ? 'opacity-60' : ''}
                        `}
                        style={{
                          backgroundColor: getSubjectLightColor(assignment.subject),
                          borderLeft: `3px solid ${getSubjectColor(assignment.subject)}`,
                        }}
                      >
                        <div className="flex items-start gap-2">
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
                              {format(assignment.dueDate, 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* 빈 날짜에 + 버튼 표시 */}
                  {dayAssignments.length === 0 && (
                    <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-text-disabled text-xl">+</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 이번 주 요약 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-caption text-text-tertiary mb-1">총 과제</div>
            <div className="text-stat text-text-primary">{assignments.length}</div>
          </div>
          <div className="card p-4">
            <div className="text-caption text-text-tertiary mb-1">완료</div>
            <div className="text-stat text-success">
              {assignments.filter(a => a.status === 'completed').length}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-caption text-text-tertiary mb-1">남은 과제</div>
            <div className="text-stat text-warning">
              {assignments.filter(a => a.status === 'pending').length}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
