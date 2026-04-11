import { NextResponse } from 'next/server';

// 캐시: 날짜별로 저장 (서버 메모리)
const cache = new Map();

// 성서유니온 QT 타입 코드 (verified 2026-04-08)
const QT_CODES = {
  daily: 'QT1',       // 매일성경 (개역개정)
  youth: 'QT2',       // 청소년 매일성경 (쉬운성경)
  english: 'QT10',    // Daily Bible For Youth (ESV)
};

// 오늘 날짜 (YYYY-MM-DD, KST 기준)
function getTodayDate() {
  const now = new Date();
  // KST = UTC + 9
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 캐시 키 생성
function getCacheKey(date, type) {
  return `${date}_${type}`;
}

// 성서유니온 AJAX 호출
async function fetchFromSU(endpoint, params) {
  const response = await fetch(`https://sum.su.or.kr:8888/Ajax/Bible/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// HTML 태그 제거
function stripHtml(str) {
  return str ? str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

// 이미지 기반 제목인지 확인 (예: "J,20260409,-,2")
function isImageTitle(title) {
  return !title || /^[A-Z],\d+/.test(title);
}

// 묵상 데이터 가져오기
async function fetchDevotion(date, type) {
  const cacheKey = getCacheKey(date, type);

  // 캐시 확인 (24시간 유효)
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.data;
    }
  }

  const qtCode = QT_CODES[type] || QT_CODES.youth;

  // 병렬로 API 호출
  const promises = [
    fetchFromSU('BodyMatterDetail', { qt_ty: qtCode, Base_de: date }),
    fetchFromSU('BodyBible', { qt_ty: qtCode, Base_de: date }),
  ];

  // 청소년/영어 버전은 제목이 이미지 기반 → QT1에서 제목 가져옴
  if (type === 'youth' || type === 'english') {
    promises.push(
      fetchFromSU('BodyMatterDetail', { qt_ty: 'QT1', Base_de: date })
    );
  }

  const results = await Promise.all(promises);
  const [detailData, bibleData, adultDetailData] = results;

  // 제목: 이미지 기반이면 QT1에서 가져옴
  let title = stripHtml(detailData.Qt_sj);
  if (isImageTitle(title) && adultDetailData) {
    title = stripHtml(adultDetailData.Qt_sj);
  }
  title = title || '오늘의 묵상';

  // 본문 범위 (예: "창세기 22:1-24")
  const bibleName = stripHtml(detailData.Bible_name)?.replace(/\([^)]+\)/g, '').trim() || '';
  const bibleChapter = (detailData.Bible_chapter || '').replace(/\s*-\s*/g, '-').replace(/\s*:\s*/g, ':');
  const scripture = bibleName && bibleChapter
    ? `${bibleName} ${bibleChapter}`
    : '';

  // 성경 본문 (전체)
  let verses = [];
  if (Array.isArray(bibleData) && bibleData.length > 0) {
    verses = bibleData.map(v => ({
      verse: v.Verse || '',
      text: stripHtml(v.Bible_Cn) || '',
    }));
  }

  // 미리보기용 (처음 2절)
  const preview = verses.slice(0, 2)
    .map(v => v.verse ? `${v.verse}. ${v.text}` : v.text)
    .join(' ');

  const result = {
    date,
    title,
    scripture,
    preview,
    verses,
    type,
  };

  // 캐시 저장
  cache.set(cacheKey, { data: result, timestamp: Date.now() });

  return result;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || getTodayDate();
  const type = searchParams.get('type') || 'youth';

  try {
    const devotion = await fetchDevotion(date, type);

    return NextResponse.json({
      success: true,
      data: devotion,
      source: 'scripture-union',
    });
  } catch (error) {
    console.error('Failed to fetch devotion:', error);

    return NextResponse.json({
      success: false,
      error: '오늘의 묵상을 불러올 수 없습니다.',
      link: 'https://sum.su.or.kr:8888/bible/today',
    }, { status: 503 });
  }
}
