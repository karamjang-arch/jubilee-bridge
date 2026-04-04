import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// Notion 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY || '',
});

// D6 암송 데이터베이스 ID (실제 DB ID로 교체 필요)
const D6_DATABASE_ID = process.env.D6_DATABASE_ID || '';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week'); // YYYY-WW 형식

  try {
    if (!D6_DATABASE_ID) {
      // DB ID가 없으면 샘플 데이터 반환
      return NextResponse.json({
        verse: {
          reference: '로마서 8:28',
          verse_ko: '우리가 알거니와 하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는 모든 것이 합력하여 선을 이루느니라',
          verse_en: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
          week: '2026년 4월 첫째 주',
        },
        source: 'fallback',
      });
    }

    // Notion DB에서 이번 주 암송 구절 조회
    const response = await notion.databases.query({
      database_id: D6_DATABASE_ID,
      filter: {
        property: 'Week',
        rich_text: {
          contains: week || new Date().toISOString().slice(0, 7),
        },
      },
      sorts: [
        {
          property: 'Created',
          direction: 'descending',
        },
      ],
      page_size: 1,
    });

    if (response.results.length === 0) {
      return NextResponse.json({
        verse: null,
        message: 'No memorization verse found for this week',
      });
    }

    const page = response.results[0];
    const properties = page.properties;

    // Notion 페이지에서 데이터 추출
    const verse = {
      reference: properties.Reference?.title?.[0]?.plain_text || '',
      verse_ko: properties.VerseKo?.rich_text?.[0]?.plain_text || '',
      verse_en: properties.VerseEn?.rich_text?.[0]?.plain_text || '',
      week: properties.Week?.rich_text?.[0]?.plain_text || '',
    };

    return NextResponse.json({ verse, source: 'notion' });
  } catch (error) {
    console.error('Notion API error:', error);
    // 에러 시 샘플 데이터 반환
    return NextResponse.json({
      verse: {
        reference: '로마서 8:28',
        verse_ko: '우리가 알거니와 하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는 모든 것이 합력하여 선을 이루느니라',
        verse_en: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
        week: '2026년 4월 첫째 주',
      },
      source: 'fallback',
      error: error.message,
    });
  }
}
