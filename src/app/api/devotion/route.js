import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// dawn-selections.json 로드 (public/data 폴더 - Vercel 호환)
const DAWN_SELECTIONS_PATH = path.join(process.cwd(), 'public', 'data', 'dawn-selections.json');

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  try {
    // JSON 파일 읽기
    const fileContent = await fs.readFile(DAWN_SELECTIONS_PATH, 'utf-8');
    const dawnSelections = JSON.parse(fileContent);

    // 특정 날짜 요청 시
    if (date) {
      const devotion = dawnSelections[date];
      if (devotion) {
        return NextResponse.json({ date, ...devotion });
      }
      // 날짜가 없으면 가장 최근 데이터 반환
      const dates = Object.keys(dawnSelections).sort().reverse();
      const latestDate = dates[0];
      return NextResponse.json({ date: latestDate, ...dawnSelections[latestDate] });
    }

    // 전체 데이터 반환
    return NextResponse.json(dawnSelections);
  } catch (error) {
    console.error('Failed to load dawn-selections:', error);
    // 폴백 데이터
    return NextResponse.json({
      date: '2026-04-03',
      title_text: '다 이루었다',
      scripture: '요19:28-30',
      hymn_text: ['143 웬 말인가 날 위하여', '147 거기 너 있었는가'],
    });
  }
}
