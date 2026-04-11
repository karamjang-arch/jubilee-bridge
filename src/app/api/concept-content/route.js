import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 과목 ID 매핑
const SUBJECT_MAP = {
  'MATH': 'math',
  'ENG': 'english',
  'PHYS': 'physics',
  'PHY': 'physics',      // PHY-MODERN-001 등
  'CHEM': 'chemistry',
  'BIO': 'biology',
  'HIST': 'history',
  'ECON': 'economics',
  'CS': 'cs',
};

// concept_id에서 과목 추출
function getSubjectFromId(conceptId) {
  const prefix = conceptId.split('-')[0];
  return SUBJECT_MAP[prefix] || null;
}

// CB 콘텐츠 로드 (캐싱)
const contentCache = new Map();

function loadSubjectContent(subjectId) {
  if (contentCache.has(subjectId)) {
    return contentCache.get(subjectId);
  }

  const filePath = path.join(process.cwd(), 'public', 'data', `cb-content-${subjectId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    contentCache.set(subjectId, data);
    return data;
  } catch (error) {
    console.error(`Failed to load ${subjectId} content:`, error);
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conceptId = searchParams.get('id');
  const subjectId = searchParams.get('subject');
  const random = searchParams.get('random'); // random=10 for quiz
  const withQuestions = searchParams.get('withQuestions') === 'true';

  // 단일 개념 조회
  if (conceptId) {
    const subject = getSubjectFromId(conceptId);
    if (!subject) {
      return NextResponse.json({ error: 'Invalid concept ID' }, { status: 400 });
    }

    const content = loadSubjectContent(subject);
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    const conceptContent = content[conceptId];
    if (!conceptContent) {
      return NextResponse.json({ error: 'Concept not found', concept_id: conceptId }, { status: 404 });
    }

    return NextResponse.json(conceptContent);
  }

  // 랜덤 진단 문제 (온보딩 퀴즈용)
  if (random) {
    const count = parseInt(random, 10) || 10;
    const allQuestions = [];

    // 모든 과목에서 진단 문제 수집
    for (const subj of Object.values(SUBJECT_MAP)) {
      const content = loadSubjectContent(subj);
      if (!content) continue;

      for (const [id, data] of Object.entries(content)) {
        if (data.diagnostic_questions && data.diagnostic_questions.length > 0) {
          // 선택지가 있는 문제만 (inline_choice 또는 numbered_choice)
          const validQuestions = data.diagnostic_questions.filter(
            q => q.choices && q.choices.length >= 2
          );

          for (const q of validQuestions) {
            allQuestions.push({
              concept_id: id,
              concept_title: data.title_ko || data.title_en,
              subject: subj,
              cluster: data.cluster,
              ...q
            });
          }
        }
      }
    }

    // 셔플 후 선택
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    return NextResponse.json({
      count: selected.length,
      questions: selected
    });
  }

  // 과목별 개념 목록 (진단 문제 포함)
  if (subjectId) {
    const content = loadSubjectContent(subjectId);
    if (!content) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // 진단 문제가 있는 개념만 필터
    if (withQuestions) {
      const filtered = {};
      for (const [id, data] of Object.entries(content)) {
        if (data.diagnostic_questions && data.diagnostic_questions.length > 0) {
          filtered[id] = data;
        }
      }
      return NextResponse.json({
        count: Object.keys(filtered).length,
        concepts: filtered
      });
    }

    return NextResponse.json({
      count: Object.keys(content).length,
      concepts: Object.keys(content)
    });
  }

  // 전체 통계
  const stats = {
    subjects: {}
  };

  for (const [prefix, subj] of Object.entries(SUBJECT_MAP)) {
    const content = loadSubjectContent(subj);
    if (content) {
      let withPathways = 0;
      let withQuestions = 0;

      for (const data of Object.values(content)) {
        if (Object.keys(data.learning_pathways || {}).length > 0) withPathways++;
        if ((data.diagnostic_questions || []).length > 0) withQuestions++;
      }

      stats.subjects[subj] = {
        total: Object.keys(content).length,
        withPathways,
        withQuestions
      };
    }
  }

  return NextResponse.json(stats);
}
