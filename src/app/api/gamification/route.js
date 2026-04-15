import { NextResponse } from "next/server";
import { supabaseAdmin, TABLES } from "@/lib/supabase";
import {
  calculateXpFromEvents,
  calculateStreak,
  calculateStreakBonus,
  calculateLevel,
  getXpToNextLevel,
  generateDailyMissions,
  checkMissionCompletion,
  getMissionProgress,
} from "@/lib/gamification";
import {
  calculateBadgeStats,
  findNewBadges,
  getAllBadgeStatus,
} from "@/lib/badges";

// 데모 데이터
const DEMO_GAMIFICATION = {
  JH: {
    totalXp: 450,
    level: 3,
    streak: 5,
    badges: ['first_step', 'math_explorer'],
    lastActive: '2026-04-15',
    nickname: 'JiHu_Star',
  },
  EH: {
    totalXp: 280,
    level: 2,
    streak: 3,
    badges: ['first_step'],
    lastActive: '2026-04-15',
    nickname: 'EunHu_Learn',
  },
};

// Check if using demo mode
function isUsingDemo() {
  return !supabaseAdmin;
}

/**
 * GET: 학생의 게이미피케이션 상태 조회
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const includeLeaderboard = searchParams.get('leaderboard') === 'true';

    if (!studentId && !includeLeaderboard) {
      return NextResponse.json(
        { error: 'Missing required parameter: student_id' },
        { status: 400 }
      );
    }

    if (isUsingDemo()) {
      // 데모 모드
      if (includeLeaderboard) {
        const leaderboard = Object.entries(DEMO_GAMIFICATION).map(([id, data]) => ({
          studentId: id,
          nickname: data.nickname,
          totalXp: data.totalXp,
          level: data.level,
        })).sort((a, b) => b.totalXp - a.totalXp);

        return NextResponse.json({ leaderboard, demo: true });
      }

      const demoData = DEMO_GAMIFICATION[studentId] || {
        totalXp: 0, level: 1, streak: 0, badges: [], lastActive: null, nickname: `Student_${studentId?.slice(0, 4)}`
      };

      const levelInfo = calculateLevel(demoData.totalXp);
      const nextLevelInfo = getXpToNextLevel(demoData.totalXp);
      const missions = generateDailyMissions();

      return NextResponse.json({
        studentId,
        totalXp: demoData.totalXp,
        level: levelInfo,
        nextLevel: nextLevelInfo,
        streak: demoData.streak,
        badges: demoData.badges,
        missions: missions.map(m => ({ ...m, completed: false, progress: 0 })),
        nickname: demoData.nickname,
        lastActive: demoData.lastActive,
        demo: true,
      });
    }

    // Supabase queries
    if (includeLeaderboard) {
      // 리더보드 조회
      const { data: progressData, error } = await supabaseAdmin
        .from(TABLES.STUDENT_PROGRESS)
        .select('student_id, total_xp, level, nickname')
        .order('total_xp', { ascending: false })
        .limit(50);

      if (error) throw error;

      const leaderboard = (progressData || []).map(row => ({
        studentId: row.student_id,
        totalXp: row.total_xp || 0,
        level: row.level || 1,
        nickname: row.nickname || `Student_${row.student_id?.slice(0, 4)}`,
      }));

      return NextResponse.json({ leaderboard });
    }

    // 학생별 상세 조회
    // 1. concept_history에서 이벤트 가져오기
    const { data: historyRows, error: historyError } = await supabaseAdmin
      .from(TABLES.CONCEPT_HISTORY)
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (historyError) throw historyError;

    const events = (historyRows || []).map(row => ({
      student_id: row.student_id,
      event_type: row.event_type,
      timestamp: row.created_at,
      curriculum: row.curriculum,
      subject: row.detail?.subject || null,
      concept_id: row.concept_id,
      score: row.score,
      duration_sec: row.detail?.duration_sec || null,
      detail: row.detail || {}
    }));

    // 2. concept_progress에서 마스터 현황 가져오기
    const { data: conceptRows, error: conceptError } = await supabaseAdmin
      .from(TABLES.CONCEPT_PROGRESS)
      .select('*')
      .eq('student_id', studentId);

    if (conceptError) throw conceptError;

    const conceptProgress = (conceptRows || []).map(row => ({
      student: row.student_id,
      concept_id: row.concept_id,
      status: row.status,
      mastered_at: row.updated_at,
      subject: row.detail?.subject || null,
    }));

    // 3. 획득한 뱃지 가져오기
    const { data: badgeRows, error: badgeError } = await supabaseAdmin
      .from(TABLES.STUDENT_BADGES)
      .select('*')
      .eq('student_id', studentId);

    if (badgeError) throw badgeError;

    const earnedBadges = (badgeRows || []).map(row => ({
      badge_id: row.badge_id,
      earned_date: row.earned_date,
    }));

    // 4. XP 계산
    const { totalXp, xpBreakdown } = calculateXpFromEvents(events);
    const streak = calculateStreak(events);
    const streakBonus = calculateStreakBonus(streak);
    const finalXp = totalXp + streakBonus;

    // 5. 레벨 계산
    const levelInfo = calculateLevel(finalXp);
    const nextLevelInfo = getXpToNextLevel(finalXp);

    // 6. 뱃지 상태 계산
    const badgeStats = calculateBadgeStats(events, conceptProgress);
    badgeStats.streak = streak;
    const allBadges = getAllBadgeStatus(badgeStats, earnedBadges);
    const newBadges = findNewBadges(badgeStats, earnedBadges);

    // 7. 일일 미션
    const today = new Date().toISOString().split('T')[0];
    const missions = generateDailyMissions();
    const missionsWithStatus = missions.map(mission => ({
      ...mission,
      completed: checkMissionCompletion(mission, events, today),
      progress: getMissionProgress(mission, events, today),
    }));

    // 8. student_progress 업데이트 (캐싱)
    const { data: existingProgress } = await supabaseAdmin
      .from(TABLES.STUDENT_PROGRESS)
      .select('*')
      .eq('student_id', studentId)
      .single();

    const currentNickname = existingProgress?.nickname || `Student_${studentId?.slice(0, 4)}`;

    await supabaseAdmin
      .from(TABLES.STUDENT_PROGRESS)
      .upsert({
        student_id: studentId,
        total_xp: finalXp,
        level: levelInfo.level,
        streak_days: streak,
        last_active_date: today,
        nickname: currentNickname,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'student_id',
      });

    return NextResponse.json({
      studentId,
      totalXp: finalXp,
      xpBreakdown,
      streakBonus,
      level: levelInfo,
      nextLevel: nextLevelInfo,
      streak,
      badges: allBadges,
      newBadges,
      missions: missionsWithStatus,
      nickname: currentNickname,
      lastActive: today,
    });

  } catch (error) {
    console.error('Gamification GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gamification data', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST: 뱃지 획득, 닉네임 변경 등
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, studentId, badgeId, nickname } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: 'Missing required field: studentId' },
        { status: 400 }
      );
    }

    if (isUsingDemo()) {
      return NextResponse.json({ success: true, demo: true });
    }

    if (action === 'earn_badge' && badgeId) {
      // 뱃지 획득 기록
      const { error } = await supabaseAdmin
        .from(TABLES.STUDENT_BADGES)
        .upsert({
          student_id: studentId,
          badge_id: badgeId,
          earned_date: new Date().toISOString(),
        }, {
          onConflict: 'student_id,badge_id',
        });

      if (error) throw error;
      return NextResponse.json({ success: true, badge: badgeId });
    }

    if (action === 'update_nickname' && nickname) {
      // 닉네임 변경
      const { error } = await supabaseAdmin
        .from(TABLES.STUDENT_PROGRESS)
        .upsert({
          student_id: studentId,
          nickname,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'student_id',
        });

      if (error) throw error;
      return NextResponse.json({ success: true, nickname });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Gamification POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process gamification action', details: error.message },
      { status: 500 }
    );
  }
}
