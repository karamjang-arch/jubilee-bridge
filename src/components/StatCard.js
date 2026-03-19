"use client";

export default function StatCard({ label, value, sub, colorClass }) {
  return (
    <div className="bg-white rounded-xl px-4 py-3 sm:px-5 sm:py-4 border border-jborder flex-1 min-w-[130px]">
      <div className="text-xs text-jgray mb-1">{label}</div>
      <div className={`text-2xl sm:text-3xl leading-tight ${colorClass || "text-navy"}`} style={{ fontWeight: 700 }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-jgray mt-1">{sub}</div>}
    </div>
  );
}
