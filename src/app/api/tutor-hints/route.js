import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

// Cache for strategy DBs
let mathStrategiesCache = null;
let readingStrategiesCache = null;
let csatStrategiesCache = null;

function loadMathStrategies() {
  if (mathStrategiesCache) return mathStrategiesCache;

  const filePath = path.join(DATA_DIR, 'strategy-db-math.json');
  if (!fs.existsSync(filePath)) return null;

  try {
    mathStrategiesCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return mathStrategiesCache;
  } catch (e) {
    console.error('Failed to load math strategies:', e);
    return null;
  }
}

function loadReadingStrategies() {
  if (readingStrategiesCache) return readingStrategiesCache;

  const filePath = path.join(DATA_DIR, 'strategy-db-reading.json');
  if (!fs.existsSync(filePath)) return null;

  try {
    readingStrategiesCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return readingStrategiesCache;
  } catch (e) {
    console.error('Failed to load reading strategies:', e);
    return null;
  }
}

function loadCsatStrategies() {
  if (csatStrategiesCache) return csatStrategiesCache;

  const filePath = path.join(DATA_DIR, 'strategy-db-csat.json');
  if (!fs.existsSync(filePath)) return null;

  try {
    csatStrategiesCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return csatStrategiesCache;
  } catch (e) {
    console.error('Failed to load CSAT strategies:', e);
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get('subject'); // math, english/reading
  const topic = searchParams.get('topic'); // optional: specific topic
  const type = searchParams.get('type'); // skill, strategy, all

  if (!subject) {
    return NextResponse.json({ error: 'Missing subject parameter' }, { status: 400 });
  }

  const result = {
    subject,
    hints: [],
    strategies: [],
    generalPrinciples: [],
  };

  // Math strategies
  if (subject === 'math' || subject === 'all') {
    const mathData = loadMathStrategies();
    if (mathData) {
      let skills = mathData.skills || [];

      // Filter by topic if provided
      if (topic) {
        const topicLower = topic.toLowerCase();
        skills = skills.filter(s =>
          s.name?.toLowerCase().includes(topicLower) ||
          s.category?.toLowerCase().includes(topicLower) ||
          s.subcategory?.toLowerCase().includes(topicLower) ||
          s.description?.toLowerCase().includes(topicLower)
        );
      }

      // Take top 5 most relevant
      const topSkills = skills.slice(0, 5).map(s => ({
        id: s.id,
        name: s.name,
        category: `${s.category} > ${s.subcategory}`,
        difficulty: s.difficulty,
        frequency: s.sat_frequency,
        keyPoints: s.key_concepts,
        commonMistakes: s.common_mistakes,
        strategyHint: s.strategy_hint,
      }));

      result.hints.push(...topSkills);
    }
  }

  // Reading/English strategies
  if (subject === 'english' || subject === 'reading' || subject === 'all') {
    const readingData = loadReadingStrategies();
    if (readingData) {
      let strategies = readingData.strategies || [];

      // Filter by topic if provided
      if (topic) {
        const topicLower = topic.toLowerCase();
        strategies = strategies.filter(s =>
          s.question_type?.toLowerCase().includes(topicLower) ||
          s.description?.toLowerCase().includes(topicLower)
        );
      }

      // Take top 5 most relevant
      const topStrategies = strategies.slice(0, 5).map(s => ({
        id: s.id,
        questionType: s.question_type,
        section: s.section,
        recognitionClues: s.recognition_clues,
        strategySteps: s.strategy_steps,
        commonTraps: s.common_traps,
        tutorHints: s.tutor_hints,
      }));

      result.strategies.push(...topStrategies);

      // Add general principles
      if (readingData.general_principles) {
        result.generalPrinciples = readingData.general_principles;
      }
    }
  }

  // Korean CSAT strategies (국어, 수학, 영어)
  if (subject === 'korean' || subject === 'csat' || subject === '국어') {
    const csatData = loadCsatStrategies();
    if (csatData?.subjects?.korean) {
      const koreanTypes = csatData.subjects.korean.questionTypes || [];
      if (topic) {
        const topicLower = topic.toLowerCase();
        const filtered = koreanTypes.filter(qt =>
          qt.name?.includes(topicLower) ||
          qt.description?.includes(topicLower)
        );
        result.strategies.push(...filtered.slice(0, 5));
      } else {
        result.strategies.push(...koreanTypes.slice(0, 5));
      }
    }
  }

  if (subject === 'csat_math' || subject === '수학') {
    const csatData = loadCsatStrategies();
    if (csatData?.subjects?.math) {
      const mathTypes = csatData.subjects.math.questionTypes || [];
      result.strategies.push(...mathTypes.slice(0, 5));
    }
  }

  if (subject === 'csat_english' || subject === '영어') {
    const csatData = loadCsatStrategies();
    if (csatData?.subjects?.english) {
      const engTypes = csatData.subjects.english.questionTypes || [];
      result.strategies.push(...engTypes.slice(0, 5));
    }
  }

  return NextResponse.json(result);
}
