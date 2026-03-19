"use client";

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis,
  LineChart, Line,
} from "recharts";

const STATUS_COLORS = {
  mastered: "#1D9E75",
  strong: "#378ADD",
  "in-progress": "#BA7517",
  weak: "#E24B4A",
};

export function StatusPieChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={75}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
          labelLine={false}
          fontSize={11}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.name] || "#888"} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SubjectRadarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data}>
        <PolarGrid strokeDasharray="3 3" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis angle={90} domain={[0, 1]} tick={{ fontSize: 9 }} />
        <Radar dataKey="mastery" stroke="#2C3E6B" fill="#2C3E6B" fillOpacity={0.2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function DailyMinutesChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="minutes" fill="#378ADD" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MasteryTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey="change" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SATScoreChart({ data }) {
  if (!data || data.length === 0) return null;
  
  const chartData = data.map(d => ({
    date: d.date.slice(5),
    "R&W": d.rw_score,
    Math: d.math_score,
    Total: d.total_score,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey="R&W" stroke="#378ADD" strokeWidth={2} />
        <Line type="monotone" dataKey="Math" stroke="#1D9E75" strokeWidth={2} />
        <Line type="monotone" dataKey="Total" stroke="#2C3E6B" strokeWidth={2} strokeDasharray="5 5" />
      </LineChart>
    </ResponsiveContainer>
  );
}
