import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Questions cache by subject
const questionsCache = new Map();
const krQuestionsCache = new Map();

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

// Korean subject mapping (concept prefix → kr output file)
const SUBJECT_MAP_KR = {
  'MATH': 'kr-math',
  'ENG': 'kr-english',
  'PHYS': 'kr-science',
  'PHY': 'kr-science',
  'CHEM': 'kr-science',
  'BIO': 'kr-science',
  'HIST': 'kr-history',
  'ECON': 'kr-society',
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

function getKrSubjectFromId(conceptId) {
  if (isKoreanConcept(conceptId)) return null;
  const prefix = conceptId.split('-')[0];
  return SUBJECT_MAP_KR[prefix] || null;
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

function loadKrQuestions(krSubject) {
  if (krQuestionsCache.has(krSubject)) {
    return krQuestionsCache.get(krSubject);
  }

  const filePath = path.join(process.cwd(), 'public', 'data', `cb-questions-${krSubject}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    krQuestionsCache.set(krSubject, data);
    return data;
  } catch (error) {
    console.error(`Failed to load KR questions for ${krSubject}:`, error);
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const conceptId = searchParams.get('id');
  const random = searchParams.get('random'); // Get N random questions
  const locale = searchParams.get('locale') || 'all'; // 'us', 'kr', 'all'

  if (!conceptId) {
    return NextResponse.json({ error: 'Missing concept ID' }, { status: 400 });
  }

  // Korean concepts (KR- prefix) - no questions available yet
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

  // Load US questions
  let usQuestions = [];
  if (locale !== 'kr') {
    const usData = loadQuestions(subject);
    if (usData && usData[conceptId]) {
      usQuestions = usData[conceptId].map(q => ({ ...q, locale: 'us' }));
    }
  }

  // Load Korean questions (mapped from Korean tests)
  let krQuestions = [];
  if (locale !== 'us') {
    const krSubject = getKrSubjectFromId(conceptId);
    if (krSubject) {
      const krData = loadKrQuestions(krSubject);
      if (krData && krData[conceptId]) {
        const krQs = krData[conceptId].questions || krData[conceptId];
        krQuestions = (Array.isArray(krQs) ? krQs : []).map(q => ({ ...q, locale: 'kr' }));
      }
    }
  }

  // Combine questions
  const allQuestions = [...usQuestions, ...krQuestions];

  if (allQuestions.length === 0) {
    return NextResponse.json({
      questions: [],
      source: 'none',
      message: 'No questions for this concept'
    });
  }

  // Return random subset if requested
  if (random) {
    const count = Math.min(parseInt(random), allQuestions.length);
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    return NextResponse.json({
      questions: shuffled.slice(0, count),
      source: 'cb-questions',
      total: allQuestions.length,
      counts: { us: usQuestions.length, kr: krQuestions.length }
    });
  }

  return NextResponse.json({
    questions: allQuestions,
    source: 'cb-questions',
    total: allQuestions.length,
    counts: { us: usQuestions.length, kr: krQuestions.length }
  });
}
