"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StatCard from "@/components/StatCard";
import { DEMO_CONCEPTS, DEMO_DAILY, DEMO_USERS } from "@/lib/demo-data";

function TeacherDashboardContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";
  
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // 데이터 로드
  const concepts = DEMO_CONCEPTS;
  const daily = DEMO_DAILY;
  const studentUsers = DEMO_USERS.filter(u => u.role === "student");

  // 학생별 통계 계산
  const studentStats = useMemo(() => {
    return studentUsers.map(user => {
      const sc = concepts.filter(c => c.student === user.student_code);
      const sd = daily.filter(d => d.student === user.student_code);
      
      const mastered = sc.filter(c => c.status === "mastered").length;
      const weak = sc.filter(c => c.status === "weak").length;
      const inProgress = sc.filter(c => c.status === "in-progress").length;
      const avgMastery = sc.length > 0 
        ? sc.reduce((a, c) => a + c.mastery, 0) / sc.length 
        : 0;
      const totalHours = (sd.reduce((a, d) => a + d.total_minutes, 0) / 60).toFixed(1);
      const streak = sd.length > 0 ? sd[sd.length - 1].streak : 0;
      const lastSession = sd.length > 0 ? sd[sd.length - 1].date : "-";
      const totalXP = sd.reduce((a, d) => a + d.xp, 0);

      // 일수 계산 (마지막 세션 이후)
      const daysSinceLastSession = lastSession !== "-" 
        ? Math.floor((new Date("2026-06-22") - new Date(lastSession)) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        code: user.student_code,
        name: user.name,
        concepts: sc.length,
        mastered,
        weak,
        inProgress,
        avgMastery,
        totalHours,
        streak,
        lastSession,
        totalXP,
        daysSinceLastSession,
      };
    });
  }, [concepts, daily, studentUsers]);

  // 정렬
  const sorted = useMemo(() => {
    const arr = [...studentStats];
    arr.sort((a, b) => {
      let va = a[sortBy];
      let vb = b[sortBy];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [studentStats, sortBy, sortDir]);

  // 전체 통계
  const totalStudents = studentStats.length;
  const activeThisWeek = studentStats.filter(s => s.daysSinceLastSession <= 7).length;
  const classAvgMastery = studentStats.length > 0
    ? (studentStats.reduce((a, s) => a + s.avgMastery, 0) / studentStats.length)
    : 0;
  const classAvgHours = studentStats.length > 0
    ? (studentStats.reduce((a, s) => a + parseFloat(s.totalHours), 0) / studentStats.length).toFixed(1)
    : "0";

  // 알림 생성
  const alerts = useMemo(() => {
    const list = [];
    studentStats.forEach(s => {
      if (s.daysSinceLastSession >= 3) {
        list.push({ type: "inactive", student: s.name, code: s.code, message: `${s.daysSinceLastSession} days since last session`, severity: "warning" });
      }
      if (s.weak >= 3) {
        list.push({ type: "weak", student: s.name, code: s.code, message: `${s.weak} weak concepts need attention`, severity: "alert" });
      }
    });
    return list;
  }, [studentStats]);

  function handleSort(column) {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  }

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span className="text-jgray/30 ml-1">↕</span>;
    return <span className="text-navy ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="min-h-screen bg-light">
      <Header />
      
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* 데모 배너 */}
        {isDemo && (
          <div className="mb-4 p-3 rounded-xl bg-amber/10 border border-amber/20 text-sm text-amber text-center">
            Demo mode — viewing sample data
          </div>
        )}

        {/* Row 1: Summary Stats */}
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 mb-4 sm:mb-5">
          <StatCard label="Total students" value={totalStudents} />
          <StatCard label="Active this week" value={activeThisWeek} colorClass="text-teal" />
          <StatCard label="Class avg mastery" value={(classAvgMastery * 100).toFixed(0) + "%"} colorClass="text-jblue" />
          <StatCard label="Avg weekly hours" value={classAvgHours + "h"} />
        </div>

        {/* Row 2: Student Table */}
        <div className="bg-white rounded-xl border border-jborder mb-4 sm:mb-5 overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
            <div className="text-xs text-navy" style={{ fontWeight: 600 }}>All students overview</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-navy">
                  {[
                    { key: "name", label: "Student" },
                    { key: "concepts", label: "Concepts" },
                    { key: "mastered", label: "Mastered" },
                    { key: "weak", label: "Weak" },
                    { key: "avgMastery", label: "Avg Mastery" },
                    { key: "totalHours", label: "Hours" },
                    { key: "streak", label: "Streak" },
                    { key: "lastSession", label: "Last Session" },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-3 py-2 text-left text-[11px] text-navy uppercase tracking-wider cursor-pointer hover:bg-light/50 select-none"
                      style={{ fontWeight: 600 }}
                    >
                      {col.label}
                      <SortIcon column={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <tr
                    key={s.code}
                    className={`border-b border-jborder hover:bg-light/70 transition-colors ${
                      i % 2 === 0 ? "bg-light/30" : "bg-white"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/student?demo=true`}
                        className="text-navy hover:text-teal transition-colors"
                        style={{ fontWeight: 600 }}
                      >
                        {s.name}
                      </Link>
                      <span className="text-jgray text-xs ml-1.5">({s.code})</span>
                    </td>
                    <td className="px-3 py-2.5">{s.concepts}</td>
                    <td className="px-3 py-2.5 text-teal" style={{ fontWeight: 600 }}>{s.mastered}</td>
                    <td className="px-3 py-2.5" style={{ fontWeight: 600, color: s.weak > 0 ? "#E24B4A" : "#888780" }}>
                      {s.weak}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-jborder rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${s.avgMastery * 100}%`,
                              background: s.avgMastery >= 0.7 ? "#1D9E75" : s.avgMastery >= 0.4 ? "#BA7517" : "#E24B4A",
                            }}
                          />
                        </div>
                        <span className="text-xs">{(s.avgMastery * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{s.totalHours}h</td>
                    <td className="px-3 py-2.5" style={{ fontWeight: 600, color: s.streak >= 3 ? "#1D9E75" : "#888780" }}>
                      {s.streak}d
                    </td>
                    <td className="px-3 py-2.5 text-jgray text-xs">{s.lastSession}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 3: Alerts */}
        {alerts.length > 0 && (
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-jborder mb-4 sm:mb-5">
            <div className="text-xs text-navy mb-3" style={{ fontWeight: 600 }}>Alerts</div>
            <div className="flex flex-col gap-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    alert.severity === "alert" ? "bg-jred/5 border border-jred/15" : "bg-amber/5 border border-amber/15"
                  }`}
                >
                  <span className={`text-lg ${alert.severity === "alert" ? "text-jred" : "text-amber"}`}>
                    {alert.severity === "alert" ? "⚠" : "⏰"}
                  </span>
                  <span style={{ fontWeight: 500 }}>{alert.student}</span>
                  <span className="text-jgray">{alert.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Row 4: Class Trends (향후 Recharts 차트 추가) */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-jborder">
          <div className="text-xs text-navy mb-3" style={{ fontWeight: 600 }}>Class trends</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-jgray mb-2">Subject average mastery</div>
              {(() => {
                const subjects = [...new Set(concepts.map(c => c.subject))];
                return subjects.map(subj => {
                  const subConcepts = concepts.filter(c => c.subject === subj);
                  const avg = subConcepts.reduce((a, c) => a + c.mastery, 0) / subConcepts.length;
                  return (
                    <div key={subj} className="flex items-center gap-2 mb-2">
                      <span className="text-xs w-20 text-jgray truncate">{subj.replace("sat-", "SAT ")}</span>
                      <div className="flex-1 h-2 bg-jborder rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${avg * 100}%`,
                            background: avg >= 0.7 ? "#1D9E75" : avg >= 0.4 ? "#BA7517" : "#E24B4A",
                          }}
                        />
                      </div>
                      <span className="text-xs w-8 text-right">{(avg * 100).toFixed(0)}%</span>
                    </div>
                  );
                });
              })()}
            </div>
            <div>
              <div className="text-[11px] text-jgray mb-2">XP leaderboard</div>
              {studentStats
                .sort((a, b) => b.totalXP - a.totalXP)
                .map((s, i) => (
                  <div key={s.code} className="flex items-center gap-2 mb-2">
                    <span className="text-xs w-5 text-jgray">{i + 1}.</span>
                    <span className="text-xs flex-1" style={{ fontWeight: 500 }}>{s.name}</span>
                    <span className="text-xs text-navy" style={{ fontWeight: 600 }}>{s.totalXP} XP</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function TeacherPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-light flex items-center justify-center">
        <div className="text-jgray text-sm">Loading...</div>
      </div>
    }>
      <TeacherDashboardContent />
    </Suspense>
  );
}
