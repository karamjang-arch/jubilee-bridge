import { NextResponse } from "next/server";
import { supabaseAdmin, TABLES } from "@/lib/supabase";

// 데모 데이터
const DEMO_ARCADE = {
  JH: { tokens: 5, highScores: { tank: 350, dodge: 420, volleyball: 500 } },
  EH: { tokens: 2, highScores: { tank: 200, dodge: 180 } },
};

// Check if using demo mode
function isUsingDemo() {
  return !supabaseAdmin;
}

/**
 * GET: 아케이드 상태 조회 (토큰 수, 최고 점수)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const leaderboard = searchParams.get('leaderboard') === 'true';
    const gameType = searchParams.get('game_type');

    if (isUsingDemo()) {
      if (leaderboard) {
        // 게임 리더보드
        const mockLeaderboard = Object.entries(DEMO_ARCADE).map(([id, data]) => ({
          studentId: id,
          totalScore: Object.values(data.highScores).reduce((a, b) => a + b, 0),
          games: data.highScores,
        })).sort((a, b) => b.totalScore - a.totalScore);

        return NextResponse.json({ leaderboard: mockLeaderboard, demo: true });
      }

      const data = DEMO_ARCADE[studentId] || { tokens: 3, highScores: {} };
      return NextResponse.json({ ...data, demo: true });
    }

    // 리더보드 조회
    if (leaderboard) {
      let query = supabaseAdmin
        .from('game_scores')
        .select('student_id, game_type, score');

      if (gameType) {
        query = query.eq('game_type', gameType);
      }

      const { data: scores, error } = await query;

      if (error) throw error;

      // 학생별 최고 점수 집계
      const playerScores = {};
      (scores || []).forEach(row => {
        if (!playerScores[row.student_id]) {
          playerScores[row.student_id] = { games: {}, totalScore: 0 };
        }
        const current = playerScores[row.student_id].games[row.game_type] || 0;
        if (row.score > current) {
          playerScores[row.student_id].games[row.game_type] = row.score;
        }
      });

      // 총점 계산
      Object.values(playerScores).forEach(p => {
        p.totalScore = Object.values(p.games).reduce((a, b) => a + b, 0);
      });

      const leaderboardData = Object.entries(playerScores)
        .map(([id, data]) => ({ studentId: id, ...data }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 10);

      return NextResponse.json({ leaderboard: leaderboardData });
    }

    // 개인 상태 조회
    if (!studentId) {
      return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });
    }

    // 토큰 수 조회
    const { data: progress, error: progressError } = await supabaseAdmin
      .from(TABLES.STUDENT_PROGRESS)
      .select('game_tokens')
      .eq('student_id', studentId)
      .single();

    // 최고 점수 조회
    const { data: scores, error: scoresError } = await supabaseAdmin
      .from('game_scores')
      .select('game_type, score')
      .eq('student_id', studentId);

    if (scoresError) console.error('Scores query error:', scoresError);

    // 게임별 최고 점수 추출
    const highScores = {};
    (scores || []).forEach(row => {
      if (!highScores[row.game_type] || row.score > highScores[row.game_type]) {
        highScores[row.game_type] = row.score;
      }
    });

    return NextResponse.json({
      tokens: progress?.game_tokens || 0,
      highScores,
    });
  } catch (error) {
    console.error('Arcade GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch arcade data' }, { status: 500 });
  }
}

/**
 * POST: 게임 플레이/점수 저장
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, student_id, game_type, score } = body;

    if (!action || !student_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (isUsingDemo()) {
      if (action === 'play') {
        const data = DEMO_ARCADE[student_id] || { tokens: 3, highScores: {} };
        if (data.tokens < 1) {
          return NextResponse.json({ error: 'Not enough tokens' }, { status: 400 });
        }
        data.tokens--;
        return NextResponse.json({ success: true, tokens: data.tokens, demo: true });
      }

      if (action === 'score') {
        return NextResponse.json({ success: true, demo: true });
      }

      if (action === 'add_tokens') {
        const data = DEMO_ARCADE[student_id] || { tokens: 0, highScores: {} };
        data.tokens += body.amount || 1;
        return NextResponse.json({ success: true, tokens: data.tokens, demo: true });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // 플레이 (토큰 차감)
    if (action === 'play') {
      // 현재 토큰 확인
      const { data: progress, error: getError } = await supabaseAdmin
        .from(TABLES.STUDENT_PROGRESS)
        .select('game_tokens')
        .eq('student_id', student_id)
        .single();

      const currentTokens = progress?.game_tokens || 0;

      if (currentTokens < 1) {
        return NextResponse.json({ error: 'Not enough tokens' }, { status: 400 });
      }

      // 토큰 차감
      const { error: updateError } = await supabaseAdmin
        .from(TABLES.STUDENT_PROGRESS)
        .upsert({
          student_id,
          game_tokens: currentTokens - 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'student_id' });

      if (updateError) throw updateError;

      return NextResponse.json({ success: true, tokens: currentTokens - 1 });
    }

    // 점수 저장
    if (action === 'score') {
      if (!game_type || score === undefined) {
        return NextResponse.json({ error: 'Missing game_type or score' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('game_scores')
        .insert({
          student_id,
          game_type,
          score,
          played_at: new Date().toISOString(),
        });

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    // 토큰 추가 (학습 완료 시 호출)
    if (action === 'add_tokens') {
      const amount = body.amount || 1;

      // 현재 토큰 조회
      const { data: progress } = await supabaseAdmin
        .from(TABLES.STUDENT_PROGRESS)
        .select('game_tokens')
        .eq('student_id', student_id)
        .single();

      const currentTokens = progress?.game_tokens || 0;

      // 토큰 추가
      const { error } = await supabaseAdmin
        .from(TABLES.STUDENT_PROGRESS)
        .upsert({
          student_id,
          game_tokens: currentTokens + amount,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'student_id' });

      if (error) throw error;

      return NextResponse.json({ success: true, tokens: currentTokens + amount });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Arcade POST error:', error);
    return NextResponse.json({ error: 'Failed to process arcade action' }, { status: 500 });
  }
}
