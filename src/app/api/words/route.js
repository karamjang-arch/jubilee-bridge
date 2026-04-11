import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Word DB 캐시 (일반 + 전체)
let wordsCache = null;
let wordIndex = null;
let fullWordsCache = null;
let fullWordIndex = null;

async function loadWords() {
  if (wordsCache) return wordsCache;

  try {
    const filePath = path.join(process.cwd(), 'public', 'word-db.json');
    const content = await fs.readFile(filePath, 'utf-8');
    wordsCache = JSON.parse(content);

    // 인덱스 생성
    wordIndex = {};
    wordsCache.forEach((word, idx) => {
      wordIndex[word.word.toLowerCase()] = idx;
    });

    return wordsCache;
  } catch (error) {
    console.error('Failed to load word-db.json:', error);
    return [];
  }
}

// 전체 DB 로드 (검색용)
async function loadFullWords() {
  if (fullWordsCache) return fullWordsCache;

  try {
    const filePath = path.join(process.cwd(), 'public', 'word-db-full.json');
    const content = await fs.readFile(filePath, 'utf-8');
    fullWordsCache = JSON.parse(content);

    // 인덱스 생성
    fullWordIndex = {};
    fullWordsCache.forEach((word, idx) => {
      fullWordIndex[word.word.toLowerCase()] = idx;
    });

    return fullWordsCache;
  } catch (error) {
    console.error('Failed to load word-db-full.json:', error);
    // fallback to regular DB
    return loadWords();
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word');
  const search = searchParams.get('search');
  const difficulty = searchParams.get('difficulty');
  const all = searchParams.get('all') === 'true';
  const full = searchParams.get('full') === 'true'; // 전체 DB 사용 (검색용)
  const limit = all ? 999999 : (parseInt(searchParams.get('limit')) || 50);
  const offset = parseInt(searchParams.get('offset')) || 0;

  try {
    // 검색 시 전체 DB 사용
    const words = (search || full) ? await loadFullWords() : await loadWords();
    const index = (search || full) ? fullWordIndex : wordIndex;

    // 특정 단어 조회
    if (word) {
      const idx = index?.[word.toLowerCase()];
      if (idx !== undefined) {
        return NextResponse.json(words[idx]);
      }
      return NextResponse.json({ error: 'Word not found' }, { status: 404 });
    }

    // 검색 (전체 DB에서)
    if (search) {
      const searchLower = search.toLowerCase();
      const results = words.filter(w => {
        const wordMatch = w.word.toLowerCase().includes(searchLower);
        const defEnMatch = w.definition_en?.toLowerCase().includes(searchLower);
        const defKoMatch = w.definition_ko?.includes(search);
        return wordMatch || defEnMatch || defKoMatch;
      }).slice(0, limit);
      return NextResponse.json({ count: results.length, words: results });
    }

    // 난이도 필터
    let filtered = words;
    if (difficulty) {
      filtered = words.filter(w => w.difficulty === difficulty);
    }

    // 페이지네이션
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      total: filtered.length,
      offset,
      limit,
      words: paginated,
    });
  } catch (error) {
    console.error('Words API error:', error);
    return NextResponse.json({ error: 'Failed to load words' }, { status: 500 });
  }
}
