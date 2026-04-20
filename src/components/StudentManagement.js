'use client';

import { useState, useEffect } from 'react';
import LearningReportModal from './LearningReportModal';

export default function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [reportStudent, setReportStudent] = useState(null);
  const [tokenModal, setTokenModal] = useState(null);
  const [tokenAmount, setTokenAmount] = useState(5);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // 학생 목록 로드
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch('/api/admin/students');
        const data = await res.json();
        setStudents(data.students || []);
      } catch (error) {
        console.error('Failed to fetch students:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // 액션 실행
  const handleAction = async (action, student) => {
    setConfirmModal(null);
    setActionLoading(`${action}-${student.id}`);

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, studentId: student.id }),
      });

      const data = await res.json();

      if (res.ok) {
        // 성공 시 학생 목록 새로고침
        const refreshRes = await fetch('/api/admin/students');
        const refreshData = await refreshRes.json();
        setStudents(refreshData.students || []);

        // localStorage에서도 onboarding 상태 초기화
        localStorage.removeItem(`jb_onboarding_completed_${student.id}`);

        alert(data.message || '완료되었습니다.');
      } else {
        alert(data.error || '오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Action failed:', error);
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 확인 모달 표시
  const showConfirm = (action, student) => {
    const messages = {
      reset: {
        title: '전체 리셋',
        message: `${student.name}의 모든 데이터를 초기화합니다.\n\n진행 상황, 단어, 묵상 메모가 모두 삭제됩니다.\n다음 로그인 시 온보딩부터 다시 시작합니다.\n\n계속하시겠습니까?`,
        buttonText: '리셋',
        buttonClass: 'bg-red-500 hover:bg-red-600',
      },
      rediagnose: {
        title: '재진단',
        message: `${student.name}의 진단평가 결과만 초기화합니다.\n\n학습으로 마스터한 개념은 유지됩니다.\n다음 로그인 시 진단평가만 다시 진행합니다.\n\n계속하시겠습니까?`,
        buttonText: '재진단',
        buttonClass: 'bg-blue-500 hover:bg-blue-600',
      },
    };

    setConfirmModal({
      action,
      student,
      ...messages[action],
    });
  };

  // 학생 추가
  const handleAddStudent = async () => {
    if (!newStudentId.trim() || !newStudentName.trim()) {
      alert('ID와 이름은 필수입니다.');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_student',
          studentId: newStudentId.trim().toUpperCase(),
          name: newStudentName.trim(),
          grade: newStudentGrade ? Number(newStudentGrade) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const refreshRes = await fetch('/api/admin/students');
        const refreshData = await refreshRes.json();
        setStudents(refreshData.students || []);
        setShowAddForm(false);
        setNewStudentId('');
        setNewStudentName('');
        setNewStudentGrade('');
        alert(`${newStudentName} 학생이 추가되었습니다.`);
      } else {
        alert(data.error || '학생 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Add student failed:', error);
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setAddLoading(false);
    }
  };

  // 토큰 지급
  const handleGrantTokens = async () => {
    if (!tokenModal || tokenAmount < 1 || tokenAmount > 99) return;

    setActionLoading(`token-${tokenModal.id}`);
    try {
      const res = await fetch('/api/arcade', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: tokenModal.id,
          game_tokens: tokenAmount,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`${tokenModal.name}에게 토큰 ${tokenAmount}개를 지급했습니다.`);
        setTokenModal(null);
        setTokenAmount(5);
      } else {
        alert(data.error || '토큰 지급에 실패했습니다.');
      }
    } catch (error) {
      console.error('Token grant failed:', error);
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="text-center text-text-tertiary">학생 목록 로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-neutral-600 to-neutral-400" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                <span className="text-xl">👨‍🏫</span>
              </div>
              <div>
                <h3 className="text-heading text-text-primary">학생 관리</h3>
                <p className="text-caption text-text-tertiary">학생별 진행 상황 및 초기화</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 text-sm bg-subj-math text-white rounded-lg hover:opacity-90 transition-all"
            >
              + 학생 추가
            </button>
          </div>

          {/* 학생 추가 폼 */}
          {showAddForm && (
            <div className="mb-4 p-4 bg-bg-sidebar rounded-lg border border-border-subtle space-y-3">
              <h4 className="text-ui font-medium text-text-primary">새 학생 추가</h4>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  placeholder="ID (예: JUNHU)"
                  className="px-3 py-2 bg-bg-card border border-border-medium rounded-lg text-body text-text-primary focus:outline-none focus:border-subj-math uppercase"
                />
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="이름 (예: 준후)"
                  className="px-3 py-2 bg-bg-card border border-border-medium rounded-lg text-body text-text-primary focus:outline-none focus:border-subj-math"
                />
                <input
                  type="number"
                  value={newStudentGrade}
                  onChange={(e) => setNewStudentGrade(e.target.value)}
                  placeholder="학년 (선택)"
                  min="1"
                  max="12"
                  className="px-3 py-2 bg-bg-card border border-border-medium rounded-lg text-body text-text-primary focus:outline-none focus:border-subj-math"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 text-caption text-text-secondary bg-bg-card border border-border-subtle rounded-lg hover:bg-bg-hover"
                >
                  취소
                </button>
                <button
                  onClick={handleAddStudent}
                  disabled={addLoading || !newStudentId.trim() || !newStudentName.trim()}
                  className="flex-1 py-2 text-caption text-white bg-subj-math rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {addLoading ? '추가 중...' : '추가'}
                </button>
              </div>
            </div>
          )}

          {students.length === 0 ? (
            <div className="text-center text-text-tertiary py-4">
              등록된 학생이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 bg-bg-sidebar rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                      {student.id.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-ui font-medium text-text-primary">
                        {student.name}
                        {student.grade && (
                          <span className="text-text-tertiary ml-2">({student.grade}학년)</span>
                        )}
                        {student.role === 'admin' && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-neutral-200 text-neutral-600 rounded">관리자</span>
                        )}
                      </div>
                      <div className="text-caption text-text-tertiary">
                        마스터 {student.masteredCount}개
                        {student.streak > 0 && ` · ${student.streak}일 연속`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTokenModal(student)}
                      disabled={actionLoading === `token-${student.id}`}
                      className="px-3 py-1.5 text-xs bg-yellow-50 text-yellow-700 rounded-md hover:bg-yellow-100 disabled:opacity-50"
                    >
                      {actionLoading === `token-${student.id}` ? '...' : '🎮 토큰'}
                    </button>
                    <button
                      onClick={() => setReportStudent(student)}
                      className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                    >
                      📋 리포트
                    </button>
                    <button
                      onClick={() => showConfirm('rediagnose', student)}
                      disabled={actionLoading === `rediagnose-${student.id}`}
                      className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 disabled:opacity-50"
                    >
                      {actionLoading === `rediagnose-${student.id}` ? '...' : '📝 재진단'}
                    </button>
                    <button
                      onClick={() => showConfirm('reset', student)}
                      disabled={actionLoading === `reset-${student.id}`}
                      className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-md hover:bg-red-100 disabled:opacity-50"
                    >
                      {actionLoading === `reset-${student.id}` ? '...' : '🔄 리셋'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 확인 모달 */}
      {confirmModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setConfirmModal(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-card rounded-lg shadow-elevated z-50 p-6 w-full max-w-sm">
            <h3 className="text-heading text-text-primary mb-2">
              {confirmModal.title}
            </h3>
            <p className="text-body text-text-secondary mb-4 whitespace-pre-line">
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={() => handleAction(confirmModal.action, confirmModal.student)}
                className={`flex-1 btn text-white ${confirmModal.buttonClass}`}
              >
                {confirmModal.buttonText}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 학습 리포트 모달 */}
      {reportStudent && (
        <LearningReportModal
          student={reportStudent}
          onClose={() => setReportStudent(null)}
        />
      )}

      {/* 토큰 지급 모달 */}
      {tokenModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setTokenModal(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-card rounded-lg shadow-elevated z-50 p-6 w-full max-w-sm">
            <h3 className="text-heading text-text-primary mb-2">
              🎮 게임 토큰 지급
            </h3>
            <p className="text-body text-text-secondary mb-4">
              <strong>{tokenModal.name}</strong>에게 지급할 토큰 수
            </p>
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="99"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(Math.min(99, Math.max(1, Number(e.target.value))))}
                  className="w-16 px-2 py-1 border border-border-medium rounded text-center"
                />
              </div>
              <div className="flex justify-between mt-2 text-caption text-text-tertiary">
                <span>1</span>
                <span>🎮 × {tokenAmount}</span>
                <span>99</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setTokenModal(null)}
                className="flex-1 btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleGrantTokens}
                disabled={actionLoading === `token-${tokenModal.id}`}
                className="flex-1 btn bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50"
              >
                {actionLoading === `token-${tokenModal.id}` ? '지급 중...' : '지급'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
