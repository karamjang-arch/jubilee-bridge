import { NextResponse } from 'next/server';
import { fetchDevotion } from '@/lib/sheets';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const student = searchParams.get('student');
  const limit = parseInt(searchParams.get('limit')) || 7;

  if (!student) {
    return NextResponse.json({
      success: false,
      error: 'student parameter is required',
    }, { status: 400 });
  }

  try {
    const allDevotion = await fetchDevotion();

    // 해당 학생의 묵상 기록 필터링 + 최신순 정렬
    const studentDevotion = allDevotion
      .filter(d => d.student === student && d.memo)
      .sort((a, b) => {
        const dateA = new Date(a.date || a.created_at);
        const dateB = new Date(b.date || b.created_at);
        return dateB - dateA;
      })
      .slice(0, limit)
      .map(d => ({
        date: d.date,
        passage: d.passage,
        memo: d.memo,
      }));

    return NextResponse.json({
      success: true,
      data: studentDevotion,
    });
  } catch (error) {
    console.error('Failed to fetch devotion history:', error);

    return NextResponse.json({
      success: false,
      error: '묵상 기록을 불러올 수 없습니다.',
    }, { status: 500 });
  }
}
