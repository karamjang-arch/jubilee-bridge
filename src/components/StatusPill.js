"use client";

export default function StatusPill({ status }) {
  const statusClass = `status-${status}`;
  
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-xl text-[11px] ${statusClass}`} style={{ fontWeight: 500 }}>
      {status}
    </span>
  );
}
