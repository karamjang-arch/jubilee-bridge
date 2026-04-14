import { NextResponse } from "next/server";
import { google } from "googleapis";
import { isUsingDemo } from "@/lib/demo-data";
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

// Google Sheets 인증
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// 데모 데이터
const DEMO_GAMIFICATION = {
  JH: {
    totalXp: 450,
    level: 3,
    streak: 5,
    badges: ['first_step', 'math_explorer'],
    lastActive: '2026-04-14',
    nickname: 'JiHu_Star',
  },
  EH: {
    totalXp: 280,
    level: 2,
    streak: 3,
    badges: ['first_step'],
    lastActive: '2026-04-14',
    nickname: 'EunHu_Learn',
  },
};

// student_progress 탭 헤더 (게이미피케이션 필드 포함)
const PROGRESS_HEADERS = [
  'student_id',
  'total_xp',
  'level',
  'streak_days',
  'last_active_date',
  'nickname',
];

// student_badges 탭 헤더
const BADGES_HEADERS = ['student_id', 'badge_id', 'earned_date'];

/**
 * student_progress 탭 확인/생성
 */
async function ensureProgressSheet(sheets, spreadsheetId) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets?.some(
      s => s.properties?.title === 'student_progress'
    );

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'student_progress',
                gridProperties: { rowCount: 100, columnCount: 6, frozenRowCount: 1 }
              }
            }
          }]
        }
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'student_progress!A1:F1',
        valueInputOption: 'RAW',
        requestBody: { values: [PROGRESS_HEADERS] }
      });
    }
    return true;
  } catch (error) {
    console.error('Error ensuring student_progress sheet:', error);
    return false;
  }
}

/**
 * student_badges 탭 확인/생성
 */
async function ensureBadgesSheet(sheets, spreadsheetId) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets?.some(
      s => s.properties?.title === 'student_badges'
    );

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'student_badges',
                gridProperties: { rowCount: 500, columnCount: 3, frozenRowCount: 1 }
              }
            }
          }]
        }
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'student_badges!A1:C1',
        valueInputOption: 'RAW',
        requestBody: { values: [BADGES_HEADERS] }
      });
    }
    return true;
  } catch (error) {
    console.error('Error ensuring student_badges sheet:', error);
    return false;
  }
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

        return NextResponse.json({ leaderboard });
      }

      const demoData = DEMO_GAMIFICATION[studentId] || {
        totalXp: 0, level: 1, streak: 0, badges: [], lastActive: null, nickname: `Student_${studentId?.slice(0, 4)}`
      };

      const levelInfo = calculateLevel(demoData.totalXp);
      const nextLevelInfo = getXpToNextLevel(demoData.totalXp);
      const today = new Date().toISOString().split('T')[0];
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
      });
    }

    // 실제 API 호출
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    await ensureProgressSheet(sheets, spreadsheetId);
    await ensureBadgesSheet(sheets, spreadsheetId);

    if (includeLeaderboard) {
      // 리더보드 조회
      const progressRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'student_progress!A:F',
      });

      const rows = progressRes.data.values || [];
      if (rows.length <= 1) {
        return NextResponse.json({ leaderboard: [] });
      }

      const leaderboard = rows.slice(1).map(row => ({
        studentId: row[0],
        totalXp: parseInt(row[1]) || 0,
        level: parseInt(row[2]) || 1,
        nickname: row[5] || `Student_${row[0]?.slice(0, 4)}`,
      })).sort((a, b) => b.totalXp - a.totalXp);

      return NextResponse.json({ leaderboard });
    }

    // 학생별 상세 조회
    // 1. concept_history에서 이벤트 가져오기
    const historyRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'concept_history!A:I',
    });

    const historyRows = historyRes.data.values || [];
    const events = historyRows.length > 1
      ? historyRows.slice(1)
          .filter(row => row[0] === studentId)
          .map(row => ({
            student_id: row[0],
            event_type: row[1],
            timestamp: row[2],
            curriculum: row[3],
            subject: row[4],
            concept_id: row[5],
            score: row[6] ? parseFloat(row[6]) : null,
            duration_sec: row[7] ? parseInt(row[7]) : null,
            detail: row[8] ? JSON.parse(row[8]) : {},
          }))
      : [];

    // 2. concept_progress에서 마스터 현황 가져오기
    const conceptRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'concept_progress!A:E',
    });

    const conceptRows = conceptRes.data.values || [];
    const conceptProgress = conceptRows.length > 1
      ? conceptRows.slice(1)
          .filter(row => row[0] === studentId)
          .map(row => ({
            student: row[0],
            concept_id: row[1],
            status: row[2],
            mastered_at: row[3],
          }))
      : [];

    // 3. 획득한 뱃지 가져오기
    const badgesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'student_badges!A:C',
    });

    const badgeRows = badgesRes.data.values || [];
    const earnedBadges = badgeRows.length > 1
      ? badgeRows.slice(1)
          .filter(row => row[0] === studentId)
          .map(row => ({
            badge_id: row[1],
            earned_date: row[2],
          }))
      : [];

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
    const progressRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'student_progress!A:F',
    });

    const progressRows = progressRes.data.values || [];
    const existingRowIndex = progressRows.findIndex(row => row[0] === studentId);
    const currentNickname = existingRowIndex > 0
      ? progressRows[existingRowIndex][5] || `Student_${studentId?.slice(0, 4)}`
      : `Student_${studentId?.slice(0, 4)}`;

    if (existingRowIndex > 0) {
      // 기존 행 업데이트
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `student_progress!A${existingRowIndex + 1}:F${existingRowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[studentId, finalXp, levelInfo.level, streak, today, currentNickname]]
        }
      });
    } else {
      // 새 행 추가
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'student_progress!A:F',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[studentId, finalXp, levelInfo.level, streak, today, currentNickname]]
        }
      });
    }

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
      { error: 'Failed to fetch gamification data' },
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

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (action === 'earn_badge' && badgeId) {
      // 뱃지 획득 기록
      await ensureBadgesSheet(sheets, spreadsheetId);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'student_badges!A:C',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[studentId, badgeId, new Date().toISOString()]]
        }
      });

      return NextResponse.json({ success: true, badge: badgeId });
    }

    if (action === 'update_nickname' && nickname) {
      // 닉네임 변경
      await ensureProgressSheet(sheets, spreadsheetId);

      const progressRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'student_progress!A:F',
      });

      const rows = progressRes.data.values || [];
      const existingRowIndex = rows.findIndex(row => row[0] === studentId);

      if (existingRowIndex > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `student_progress!F${existingRowIndex + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[nickname]] }
        });
      } else {
        // 새 행 추가
        const today = new Date().toISOString().split('T')[0];
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'student_progress!A:F',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [[studentId, 0, 1, 0, today, nickname]]
          }
        });
      }

      return NextResponse.json({ success: true, nickname });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Gamification POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process gamification action' },
      { status: 500 }
    );
  }
}
