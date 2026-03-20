"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StatCard from "@/components/StatCard";
import StatusPill from "@/components/StatusPill";
import {
  StatusPieChart,
  SubjectRadarChart,
  DailyMinutesChart,
  MasteryTrendChart,
  SATScoreChart,
} from "@/components/Charts";
import { DEMO_CONCEPTS, DEMO_DAILY, DEMO_SAT_SCORES, DEMO_USERS } from "@/lib/demo-data";
import { computeStudentStats, getUserSubjects } from "@/lib/data-service";
import SelfStudyTimer from "@/components/SelfStudyTimer";

function StudentDashboardContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";
  
  const [selectedStudent, setSelectedStudent] = useState("jihu");
  const [concepts, setConcepts] = useState([]);
  const [daily, setDaily] = useState([]);
  const [satScores, setSatScores] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // 교사인 경우: 학생 선택 가능
  const isTeacher = session?.user?.role === "teacher" || isDemo;

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      
      // Phase 1: 데모 데이터 사용 (Sheets API 연동 후 교체)
      const studentCode = isTeacher ? selectedStudent : (session?.user?.studentCode || "jihu");
      
      if (!isTeacher) {
        setSelectedStudent(studentCode);
      }

      // 데모 데이터 또는 API 데이터
      setConcepts(DEMO_CONCEPTS.filter(c => c.student === studentCode));
      setDaily(DEMO_DAILY.filter(d => d.student === studentCode));
      setSatScores(DEMO_SAT_SCORES.filter(s => s.student === studentCode));
      setStudents(DEMO_USERS.filter(u => u.role === "student"));
      
      setLoading(false);
    }
    
    loadData();
  }, [selectedStudent, session, isTeacher]);

  const stats = computeStudentStats(concepts, daily);
  const customSubjects = getUserSubjects(students, selectedStudent);

  if (loading) {
    return (
      <div className="min-h-screen bg-light">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center text-jgray text-sm">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light">
      <Header />
      
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        
        {/* 데모 배너 */}
        {isDemo && (
          <div className="mb-4 p-3 rounded-xl bg-amber/10 border border-amber/20 text-sm text-amber text-center">
            Demo mode — viewing sample data
          </div>
        )}

        {/* 교사 모드: 학생 선택 탭 */}
        {isTeacher && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {students.map(s => (
              <button
                key={s.student_code}
                onClick={() => setSelectedStudent(s.student_code)}
                className={`px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-colors ${
                  selectedStudent === s.student_code
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-navy border-jborder hover:border-navy/30"
                }`}
                style={{ fontWeight: 500 }}
              >
                {s.name} ({s.student_code})
              </button>
            ))}
          </div>
        )}

        {/* Self-Study Timer */}
        <SelfStudyTimer studentCode={selectedStudent} customSubjects={customSubjects} />

        {/* Row 1: Stat Cards */}
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 mb-4 sm:mb-5">
          <StatCard label="Total concepts" value={stats.total} />
          <StatCard label="Mastered" value={stats.mastered} colorClass="text-teal" />
          <StatCard label="Need review" value={stats.inProgress + stats.weak} colorClass="text-jred" />
          <StatCard label="Avg mastery" value={(stats.avgMastery * 100).toFixed(0) + "%"} colorClass="text-jblue" />
          <StatCard label="Study hours" value={stats.totalHours} />
          <StatCard label="Streak" value={`${stats.streak}d`} colorClass="text-amber" sub="consecutive days" />
          <StatCard label="XP" value={stats.totalXP} colorClass="text-navy" sub={`Level: ${stats.level}`} />
        </div>

        {/* Row 2: Charts Grid (Pie + Radar) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-jborder">
            <div className="text-xs text-navy mb-3" style={{ fontWeight: 600 }}>Status distribution</div>
            {stats.statusDistribution.length > 0 ? (
              <StatusPieChart data={stats.statusDistribution} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-jgray text-sm">No data yet</div>
            )}
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-jborder">
            <div className="text-xs text-navy mb-3" style={{ fontWeight: 600 }}>Mastery by subject</div>
            {stats.subjectMastery.length > 0 ? (
              <SubjectRadarChart data={stats.subjectMastery} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-jgray text-sm">No data yet</div>
            )}
          </div>
        </div>

        {/* Row 3: Study Timeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-jborder">
            <div className="text-xs text-navy mb-3" style={{ fontWeight: 600 }}>Daily study minutes</div>
            {stats.minutesTimeline.length > 0 ? (
              <DailyMinutesChart data={stats.minutesTimeline} />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-jgray text-sm">No data yet</div>
            )}
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-jborder">
            <div className="text-xs text-navy mb-3" style={{ fontWeight: 600 }}>Mastery change trend</div>
            {stats.masteryTimeline.length > 0 ? (
              <MasteryTrendChart data={stats.masteryTimeline} />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-jgray text-sm">No data yet</div>
            )}
          </div>
        </div>

        {/* Row 4: Concepts Needing Review */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-jborder mb-4 sm:mb-5">
          <div className="text-xs text-navy mb-3" style={{ fontWeight: 600 }}>Concepts needing review</div>
          <div className="flex flex-col gap-1.5">
            {stats.needReview.length > 0 ? (
              stats.needReview.map((c, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-lg text-sm ${
                    i % 2 === 0 ? "bg-light" : "bg-white"
                  }`}
                >
                  <StatusPill status={c.status} />
                  <span className="text-sm truncate" style={{ fontWeight: 500 }}>
                    {c.unit.replace(/-/g, " ")}
                  </span>
                  <span className="text-jgray text-xs ml-auto hidden sm:inline">{c.subject}</span>
                  <span
                    className="text-sm ml-auto sm:ml-0"
                    style={{
                      fontWeight: 600,
                      color: c.status === "weak" ? "#E24B4A" : "#BA7517",
                    }}
                  >
                    {(c.mastery * 100).toFixed(0)}%
                  </span>
                </div>
              ))
            ) : (
              <div className="text-jgray text-sm py-2">
                All clear. Nothing needs review right now.
              </div>
            )}
          </div>
        </div>

        {/* Row 5: SAT Practice Scores */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-jborder mb-4 sm:mb-5">
          <div className="text-xs text-navy mb-3" style={{ fontWeight: 600 }}>SAT practice scores</div>
          {satScores.length > 0 ? (
            <>
              <SATScoreChart data={satScores} />
              <div className="mt-3 flex gap-4 text-[11px] text-jgray justify-center">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-jblue" /> R&W
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal" /> Math
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-0.5 bg-navy" style={{ borderStyle: "dashed" }} /> Total
                </span>
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-jgray text-sm">
              No SAT practice tests recorded yet
            </div>
          )}
        </div>

        {/* Row 6: Recent Activity */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-jborder">
          <div className="text-xs text-navy mb-3" style={{ fontWeight: 600 }}>Recent activity (last 7 days)</div>
          <div className="flex flex-col gap-1.5">
            {daily.slice(-7).reverse().map((d, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                  i % 2 === 0 ? "bg-light" : "bg-white"
                }`}
              >
                <span className="text-xs text-jgray w-14">{d.date.slice(5)}</span>
                <span className="text-xs">{d.total_minutes}min</span>
                <span className="text-xs text-teal">+{d.new_concepts} new</span>
                <span className="text-xs text-jblue">{d.reviewed} reviewed</span>
                <span className="text-xs ml-auto" style={{ fontWeight: 500 }}>+{d.xp} XP</span>
              </div>
            ))}
            {daily.length === 0 && (
              <div className="text-jgray text-sm py-2">No activity recorded yet</div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function StudentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-light flex items-center justify-center">
        <div className="text-jgray text-sm">Loading...</div>
      </div>
    }>
      <StudentDashboardContent />
    </Suspense>
  );
}
