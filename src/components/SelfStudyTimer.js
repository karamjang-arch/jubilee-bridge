"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_CATEGORIES = {
  Study: [
    "sat-math", "sat-reading", "sat-writing",
    "english", "math", "science", "social-studies", "korean", "bible",
  ],
  Activities: [
    "instrument", "sports", "volunteering", "church", "reading", "other",
  ],
};

const ACTIVITY_SET = new Set(DEFAULT_CATEGORIES.Activities);

function buildCategories(customSubjects) {
  if (!customSubjects || customSubjects.length === 0) return DEFAULT_CATEGORIES;
  const study = [];
  const activities = [];
  customSubjects.forEach(s => {
    if (ACTIVITY_SET.has(s)) {
      activities.push(s);
    } else {
      study.push(s);
    }
  });
  const result = {};
  if (study.length > 0) result.Study = study;
  if (activities.length > 0) result.Activities = activities;
  if (Object.keys(result).length === 0) result.Study = customSubjects;
  return result;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SelfStudyTimer({ studentCode = "jihu", customSubjects = null }) {
  const categories = buildCategories(customSubjects);
  const firstGroup = Object.keys(categories)[0];
  const [group, setGroup] = useState(firstGroup);
  const [category, setCategory] = useState(categories[firstGroup][0]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [memo, setMemo] = useState("");
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const handleGroupChange = useCallback((g) => {
    setGroup(g);
    setCategory(categories[g][0]);
  }, []);

  function handleStart() {
    setStopped(false);
    setCopied(false);
    setRunning(true);
  }

  function handleStop() {
    setRunning(false);
    setStopped(true);
  }

  function handleSave() {
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const line = `${todayString()} | ${studentCode} | ${category} | ${minutes}min | ${memo.trim() || "-"}`;
    navigator.clipboard.writeText(line).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    setLogs(prev => [{ category, minutes, memo: memo.trim() || "-", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...prev]);
    // reset
    setElapsed(0);
    setStopped(false);
    setMemo("");
  }

  function handleReset() {
    setRunning(false);
    setStopped(false);
    setElapsed(0);
    setMemo("");
    setCopied(false);
  }

  const totalMinutes = logs.reduce((sum, l) => sum + l.minutes, 0);

  return (
    <div className="bg-navy rounded-xl p-4 sm:p-5 mb-4 sm:mb-5">
      <div className="text-white text-xs mb-3" style={{ fontWeight: 600 }}>
        Self-Study Timer
      </div>

      {/* Category selection */}
      <div className="flex gap-2 mb-3">
        {Object.keys(categories).map(g => (
          <button
            key={g}
            onClick={() => handleGroupChange(g)}
            disabled={running}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              group === g
                ? "bg-white text-navy"
                : "bg-white/15 text-white/70 hover:bg-white/25"
            } ${running ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{ fontWeight: 500 }}
          >
            {g}
          </button>
        ))}
      </div>

      <select
        value={category}
        onChange={e => setCategory(e.target.value)}
        disabled={running}
        className={`w-full px-3 py-2 rounded-lg text-sm bg-white/10 text-white border border-white/20 mb-4 outline-none focus:border-white/40 ${
          running ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {categories[group].map(c => (
          <option key={c} value={c} className="bg-navy text-white">
            {c.replace(/-/g, " ")}
          </option>
        ))}
      </select>

      {/* Timer display */}
      <div className="text-center mb-4">
        <div
          className="text-white text-5xl sm:text-6xl tracking-wider"
          style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
        >
          {formatTime(elapsed)}
        </div>
        <div className="text-white/40 text-xs mt-1">
          {category.replace(/-/g, " ")}
        </div>
      </div>

      {/* Start / Stop / Reset buttons */}
      <div className="flex justify-center gap-3 mb-4">
        {!running && !stopped && (
          <button
            onClick={handleStart}
            className="px-6 py-2.5 rounded-full text-sm text-white bg-teal hover:bg-teal/90 transition-colors"
            style={{ fontWeight: 600 }}
          >
            Start
          </button>
        )}
        {running && (
          <button
            onClick={handleStop}
            className="px-6 py-2.5 rounded-full text-sm text-white bg-coral hover:bg-coral/90 transition-colors"
            style={{ fontWeight: 600 }}
          >
            Stop
          </button>
        )}
        {stopped && (
          <>
            <button
              onClick={handleStart}
              className="px-5 py-2 rounded-full text-xs text-white bg-white/15 hover:bg-white/25 transition-colors"
              style={{ fontWeight: 500 }}
            >
              Resume
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-2 rounded-full text-xs text-white/50 hover:text-white/80 transition-colors"
              style={{ fontWeight: 500 }}
            >
              Reset
            </button>
          </>
        )}
      </div>

      {/* Memo + Save (shown after stop) */}
      {stopped && elapsed > 0 && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="memo (optional) e.g. cello scales"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-white/10 text-white border border-white/20 outline-none focus:border-white/40 placeholder:text-white/30"
          />
          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-lg text-sm text-navy bg-amber-400 hover:bg-amber-300 transition-colors"
            style={{ fontWeight: 600 }}
          >
            {copied ? "Copied to clipboard!" : `Save (${Math.max(1, Math.round(elapsed / 60))}min)`}
          </button>
        </div>
      )}

      {/* Today's log */}
      {logs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs" style={{ fontWeight: 500 }}>Today&apos;s log</span>
            <span className="text-white/50 text-xs">{totalMinutes}min total</span>
          </div>
          <div className="flex flex-col gap-1">
            {logs.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-white/70 px-2 py-1.5 rounded bg-white/5">
                <span className="text-white/40">{l.time}</span>
                <span className="text-white/90" style={{ fontWeight: 500 }}>{l.category.replace(/-/g, " ")}</span>
                <span>{l.minutes}min</span>
                {l.memo !== "-" && <span className="text-white/40 truncate">{l.memo}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
