import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Questions cache by subject
const questionsCache = new Map();

// US Subject mapping from concept ID prefix
const SUBJECT_MAP_US = {
  'MATH': 'math',
  'ENG': 'english',
  'PHYS': 'physics',
  'PHY': 'physics',
  'CHEM': 'chemistry',
  'BIO': 'biology',
  'HIST': 'history',
  'ECON': 'economics',
  'CS': 'cs',
};

// Check if concept is Korean
function isKoreanConcept(conceptId) {
  return conceptId && conceptId.startsWith('KR-');
}

function getSubjectFromId(conceptId) {
  // Korean concepts don't have questions yet
  if (isKoreanConcept(conceptId)) {
    return null;
  }
  const prefix = conceptId.split('-')[0];
  return SUBJECT_MAP_US[prefix] || null;
}

function loadQuestions(subject) {
  if (questionsCache.has(subject)) {
    return questionsCache.get(subject);
  }

  const filePath = path.join(process.cwd(), 'public', 'data', `cb-questions-${subject}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    questionsCache.set(subject, data);
    return data;
  } catch (error) {
    console.error(`Failed to load questions for ${subject}:`, error);
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conceptId = searchParams.get('id');
  const random = searchParams.get('random'); // Get N random questions

  if (!conceptId) {
    return NextResponse.json({ error: 'Missing concept ID' }, { status: 400 });
  }

  // Korean concepts - no questions available yet
  if (isKoreanConcept(conceptId)) {
    return NextResponse.json({
      questions: [],
      source: 'none',
      curriculum: 'kr',
      message: '한국 실전 문제 준비 중입니다.'
    });
  }

  const subject = getSubjectFromId(conceptId);
  if (!subject) {
    return NextResponse.json({ error: 'Invalid concept ID' }, { status: 400 });
  }

  const questions = loadQuestions(subject);
  if (!questions) {
    return NextResponse.json({
      questions: [],
      source: 'none',
      message: 'No questions file for this subject'
    });
  }

  const conceptQuestions = questions[conceptId];
  if (!conceptQuestions || conceptQuestions.length === 0) {
    return NextResponse.json({
      questions: [],
      source: 'none',
      message: 'No questions for this concept'
    });
  }

  // Return random subset if requested
  if (random) {
    const count = Math.min(parseInt(random), conceptQuestions.length);
    const shuffled = [...conceptQuestions].sort(() => Math.random() - 0.5);
    return NextResponse.json({
      questions: shuffled.slice(0, count),
      source: 'cb-questions',
      total: conceptQuestions.length
    });
  }

  return NextResponse.json({
    questions: conceptQuestions,
    source: 'cb-questions',
    total: conceptQuestions.length
  });
}
