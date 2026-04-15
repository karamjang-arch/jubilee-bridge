'use client';

import { useState, useEffect, useMemo } from 'react';
import Navigation from '@/components/Navigation';
import { useProfile } from '@/hooks/useProfile';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';

const TABS = [
  { id: 'calendar', label: 'Calendar', icon: '' },
  { id: 'concepts', label: 'Concept', icon: '' },
  { id: 'stats', label: 'Stats', icon: '' },
];

const EVENT_ICONS = {
  quiz_correct: { icon: '', label: 'Quiz Correct' },
  quiz_incorrect: { icon: '', label: 'Quiz Incorrect' },
  tutor_session: { icon: '', label: 'Tutor' },
  test_completed: { icon: '', label: 'Test' },
  homework_scan: { icon: '', label: 'Homework' },
  word_quiz: { icon: '', label: 'Word' },
  study_session: { icon: '', label: 'Study' },
};

const SUBJECT_COLORS = {
  MATH: '#378ADD',
  ENG: '#9F7AEA',
  SCI: '#48BB78',
  PHYS: '#ED8936',
  CHEM: '#F56565',
  BIO: '#38B2AC',
  HIST: '#D69E2E',
  SAT: '#667EEA',
  OTHER: '#A0AEC0',
};

const CHART_COLORS = ['#378ADD', '#48BB78', '#9F7AEA', '#ED8936', '#F56565', '#38B2AC'];

export default function RecordsPage() {
  const { profile, studentId, isAdmin } = useProfile();
  const [activeTab, setActiveTab] = useState('calendar');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [students, setStudents] = useState([]);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [calendarData, setCalendarData] = useState({ events: [], sessions: [], streak: 0 });
  const [selectedDate, setSelectedDate] = useState(null);

  // Concepts state
  const [conceptsData, setConceptsData] = useState({ concepts: [] });
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  // Stats state
  const [statsData, setStatsData] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('week');

  const [loading, setLoading] = useState(true);

  // Effective student ID
  const effectiveStudentId = isAdmin ? selectedStudent : studentId;

  // Load students list for admin
  useEffect(() => {
    if (isAdmin) {
      fetch('/api/sheets?tab=student_profile')
        .then(res => res.json())
        .then(data => {
          const studentList = (data.data || []).filter(p => p.role === 'student');
          setStudents(studentList);
          if (studentList.length > 0 && !selectedStudent) {
            setSelectedStudent(studentList[0].id);
          }
        });
    }
  }, [isAdmin, selectedStudent]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!effectiveStudentId) return;

    setLoading(true);
    let url = `/api/records?student_id=${effectiveStudentId}&view=${activeTab}`;

    if (activeTab === 'calendar') {
      url += `&month=${currentMonth}`;
    } else if (activeTab === 'concepts' && subjectFilter !== 'all') {
      url += `&subject=${subjectFilter}`;
    } else if (activeTab === 'stats') {
      url += `&period=${statsPeriod}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(result => {
        if (activeTab === 'calendar') {
          setCalendarData(result.data || { events: [], sessions: [], streak: 0 });
        } else if (activeTab === 'concepts') {
          setConceptsData(result.data || { concepts: [] });
        } else if (activeTab === 'stats') {
          setStatsData(result.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch records:', err);
        setLoading(false);
      });
  }, [effectiveStudentId, activeTab, currentMonth, subjectFilter, statsPeriod]);

  return (
    <div className="min-h-screen bg-bg-page">
      <Navigation />

      <main className="max-w-container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">My Records</h1>

          {/* Admin: Student selector */}
          {isAdmin && students.length > 0 && (
            <select
              value={selectedStudent || ''}
              onChange={e => setSelectedStudent(e.target.value)}
              className="px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-text-primary"
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
              ))}
            </select>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 p-1 bg-bg-card rounded-lg border border-border-subtle w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2 rounded-md text-ui font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-subj-math text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }
              `}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-text-tertiary">Loading...</div>
          </div>
        ) : (
          <>
            {activeTab === 'calendar' && (
              <CalendarView
                data={calendarData}
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
            )}
            {activeTab === 'concepts' && (
              <ConceptsView
                data={conceptsData}
                subjectFilter={subjectFilter}
                setSubjectFilter={setSubjectFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
              />
            )}
            {activeTab === 'stats' && (
              <StatsView
                data={statsData}
                period={statsPeriod}
                setPeriod={setStatsPeriod}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Calendar View Component
function CalendarView({ data, currentMonth, setCurrentMonth, selectedDate, setSelectedDate }) {
  const { events, sessions, streak } = data;

  // Parse month
  const [year, month] = currentMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const date = e.created_at.split('T')[0];
      if (!map[date]) map[date] = [];
      map[date].push(e);
    });
    sessions.forEach(s => {
      const date = s.created_at.split('T')[0];
      if (!map[date]) map[date] = [];
      map[date].push({ ...s, event_type: 'study_session' });
    });
    return map;
  }, [events, sessions]);

  // Get activity intensity for a date (0-4)
  const getIntensity = (dateStr) => {
    const dayEvents = eventsByDate[dateStr] || [];
    if (dayEvents.length === 0) return 0;
    if (dayEvents.length <= 2) return 1;
    if (dayEvents.length <= 5) return 2;
    if (dayEvents.length <= 10) return 3;
    return 4;
  };

  const intensityColors = [
    'bg-bg-hover',
    'bg-success/20',
    'bg-success/40',
    'bg-success/60',
    'bg-success/80',
  ];

  // Navigate months
  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setSelectedDate(null);
  };

  // Format time
  const formatTime = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Selected date events
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  return (
    <div className="space-y-6">
      {/* Streak banner */}
      {streak > 0 && (
        <div className="bg-progress-streak/10 border border-progress-streak/30 rounded-lg p-4 flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <div className="text-heading text-progress-streak font-semibold">{streak} Day Streak!</div>
            <div className="text-caption text-text-secondary">Keep studying every day</div>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-bg-card border border-border-subtle rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 hover:bg-bg-hover rounded-md text-text-secondary">
            ←
          </button>
          <h2 className="text-heading font-semibold text-text-primary">
            {new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-bg-hover rounded-md text-text-secondary">
            →
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-caption text-text-tertiary py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for start of month */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const intensity = getIntensity(dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === new Date().toISOString().split('T')[0];

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={`
                  aspect-square rounded-md flex items-center justify-center text-ui transition-all
                  ${intensityColors[intensity]}
                  ${isSelected ? 'ring-2 ring-subj-math' : ''}
                  ${isToday ? 'font-bold' : ''}
                  hover:ring-2 hover:ring-subj-math/50
                `}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border-subtle">
          <span className="text-caption text-text-tertiary">Less</span>
          {intensityColors.map((color, i) => (
            <div key={i} className={`w-4 h-4 rounded ${color}`} />
          ))}
          <span className="text-caption text-text-tertiary">More</span>
        </div>
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div className="bg-bg-card border border-border-subtle rounded-lg p-6">
          <h3 className="text-heading font-semibold text-text-primary mb-4">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </h3>

          {selectedEvents.length === 0 ? (
            <p className="text-text-tertiary">No study activities on this day</p>
          ) : (
            <div className="space-y-3">
              {selectedEvents
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                .map((event, i) => {
                  const eventInfo = EVENT_ICONS[event.event_type] || { icon: '·', label: event.event_type };
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 bg-bg-hover rounded-lg">
                      <span className="text-lg">{eventInfo.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-caption text-text-tertiary">
                            {formatTime(event.created_at)}
                          </span>
                          <span className="text-ui text-text-primary">
                            {event.metadata?.concept_name || event.concept_id || eventInfo.label}
                          </span>
                        </div>
                        {event.xp_earned > 0 && (
                          <span className="text-caption text-success">+{event.xp_earned} XP</span>
                        )}
                        {event.metadata?.misconception && (
                          <div className="text-caption text-danger mt-1">
                            Misconception: {event.metadata.misconception}
                          </div>
                        )}
                        {event.metadata?.turns && (
                          <div className="text-caption text-text-tertiary">
                            {event.metadata.turns} conversation turns
                          </div>
                        )}
                        {event.metadata?.score_percent !== undefined && (
                          <div className="text-caption text-text-secondary">
                            Score: {event.metadata.score_percent}%
                          </div>
                        )}
                        {event.duration_minutes && (
                          <div className="text-caption text-text-secondary">
                            {event.duration_minutes} minutes
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Concepts View Component
function ConceptsView({ data, subjectFilter, setSubjectFilter, sortBy, setSortBy }) {
  const { concepts } = data;

  // Extract unique subjects
  const subjects = useMemo(() => {
    const set = new Set(concepts.map(c => c.concept_id?.split('-')[0]));
    return ['all', ...Array.from(set).filter(Boolean)];
  }, [concepts]);

  // Filter and sort concepts
  const filteredConcepts = useMemo(() => {
    let result = [...concepts];

    if (subjectFilter !== 'all') {
      result = result.filter(c => c.concept_id?.startsWith(subjectFilter));
    }

    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        break;
      case 'accuracy-low':
        result.sort((a, b) => (a.score || 0) - (b.score || 0));
        break;
      case 'misconceptions':
        result.sort((a, b) => (b.misconceptions?.length || 0) - (a.misconceptions?.length || 0));
        break;
    }

    return result;
  }, [concepts, subjectFilter, sortBy]);

  const getStatusBadge = (status) => {
    const styles = {
      mastered: 'bg-success/10 text-success',
      learning: 'bg-warning/10 text-warning',
      available: 'bg-bg-hover text-text-tertiary',
      weak: 'bg-danger/10 text-danger',
    };
    return styles[status] || styles.available;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <label className="text-caption text-text-tertiary">Subject:</label>
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="px-3 py-1.5 bg-bg-card border border-border-subtle rounded-md text-ui text-text-primary"
          >
            {subjects.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Subjects' : s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-caption text-text-tertiary">Sort:</label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-1.5 bg-bg-card border border-border-subtle rounded-md text-ui text-text-primary"
          >
            <option value="recent">Recent</option>
            <option value="accuracy-low">Low Accuracy First</option>
            <option value="misconceptions">Misconceptions First</option>
          </select>
        </div>
      </div>

      {/* Concepts table */}
      <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-hover">
              <th className="text-left text-caption text-text-tertiary font-medium px-4 py-3">Concept</th>
              <th className="text-center text-caption text-text-tertiary font-medium px-4 py-3 w-24">Status</th>
              <th className="text-center text-caption text-text-tertiary font-medium px-4 py-3 w-20">Attempts</th>
              <th className="text-center text-caption text-text-tertiary font-medium px-4 py-3 w-24">Accuracy</th>
              <th className="text-center text-caption text-text-tertiary font-medium px-4 py-3 w-28">Last Study</th>
              <th className="text-left text-caption text-text-tertiary font-medium px-4 py-3">Misconceptions</th>
            </tr>
          </thead>
          <tbody>
            {filteredConcepts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-text-tertiary">
                  No concept records found
                </td>
              </tr>
            ) : (
              filteredConcepts.map((concept, i) => {
                const subject = concept.concept_id?.split('-')[0];
                const subjectColor = SUBJECT_COLORS[subject] || SUBJECT_COLORS.OTHER;

                return (
                  <tr key={i} className="border-b border-border-subtle last:border-0 hover:bg-bg-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: subjectColor }}
                        />
                        <span className="text-ui text-text-primary">{concept.concept_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-caption ${getStatusBadge(concept.status)}`}>
                        {concept.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-ui text-text-secondary">
                      {concept.attempts || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-ui ${(concept.score || 0) >= 80 ? 'text-success' : (concept.score || 0) >= 60 ? 'text-warning' : 'text-danger'}`}>
                        {concept.score || 0}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-caption text-text-tertiary">
                      {concept.updated_at?.split('T')[0] || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {concept.misconceptions?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {concept.misconceptions.map((m, j) => (
                            <span key={j} className="px-2 py-0.5 bg-danger/10 text-danger text-caption rounded">
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-caption text-text-tertiary">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Stats View Component
function StatsView({ data, period, setPeriod }) {
  if (!data) {
    return <div className="text-text-tertiary">No statistics available</div>;
  }

  const {
    dailyActivity = [],
    subjectDistribution = [],
    accuracy = 0,
    totalConcepts = 0,
    masteredConcepts = 0,
    totalStudyMinutes = 0,
    streak = 0,
  } = data;

  // Format daily activity for chart
  const chartData = dailyActivity.map(d => ({
    date: d.date.slice(5), // MM-DD
    events: d.events,
    minutes: d.minutes,
  }));

  // Format pie data
  const pieData = subjectDistribution.map(s => ({
    name: s.subject,
    value: s.count,
  }));

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setPeriod('week')}
          className={`px-4 py-2 rounded-md text-ui ${period === 'week' ? 'bg-subj-math text-white' : 'bg-bg-card text-text-secondary border border-border-subtle'}`}
        >
          Week
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={`px-4 py-2 rounded-md text-ui ${period === 'month' ? 'bg-subj-math text-white' : 'bg-bg-card text-text-secondary border border-border-subtle'}`}
        >
          Month
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Concepts" value={totalConcepts} icon="" />
        <StatCard label="Mastered" value={masteredConcepts} icon="" color="text-success" />
        <StatCard label="Study Time" value={`${Math.round(totalStudyMinutes)}m`} icon="" />
        <StatCard label="Current Streak" value={`${streak}d`} icon="🔥" color="text-progress-streak" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily activity bar chart */}
        <div className="bg-bg-card border border-border-subtle rounded-lg p-6">
          <h3 className="text-heading font-semibold text-text-primary mb-4">Daily Activity</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="events" fill="#378ADD" radius={[4, 4, 0, 0]} name="Activities" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-tertiary">
              No activity data
            </div>
          )}
        </div>

        {/* Subject distribution pie chart */}
        <div className="bg-bg-card border border-border-subtle rounded-lg p-6">
          <h3 className="text-heading font-semibold text-text-primary mb-4">Subject Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={10}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={SUBJECT_COLORS[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-tertiary">
              No subject data
            </div>
          )}
        </div>
      </div>

      {/* Accuracy card */}
      <div className="bg-bg-card border border-border-subtle rounded-lg p-6">
        <h3 className="text-heading font-semibold text-text-primary mb-4">Quiz Accuracy</h3>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-subj-math">{accuracy}%</div>
          <div className="flex-1 h-4 bg-bg-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-subj-math rounded-full transition-all"
              style={{ width: `${accuracy}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, icon, color = 'text-text-primary' }) {
  return (
    <div className="bg-bg-card border border-border-subtle rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-caption text-text-tertiary">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
