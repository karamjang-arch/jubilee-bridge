import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cache for loaded questions
const questionsCache = new Map();

function loadAllQuestions(subject) {
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
  const subject = searchParams.get('subject');
  const count = parseInt(searchParams.get('count')) || 10;

  if (!subject) {
    return NextResponse.json({ error: 'Missing subject parameter' }, { status: 400 });
  }

  const allQuestions = loadAllQuestions(subject);
  if (!allQuestions) {
    return NextResponse.json({
      questions: [],
      message: `No questions file for subject: ${subject}`
    });
  }

  // Collect all valid questions (4 choices, easy/medium difficulty)
  const validQuestions = [];

  for (const [conceptId, questions] of Object.entries(allQuestions)) {
    for (const q of questions) {
      // Filter: must have 4 choices and answer
      if (!q.choices || q.choices.length !== 4 || !q.answer) continue;

      // Filter: easy/medium only (exclude hard)
      if (q.difficulty && q.difficulty.includes('hard')) continue;

      validQuestions.push({
        concept_id: conceptId,
        cluster: q.cluster || conceptId.split('-').slice(0, 3).join('-'),
        question: q.question,
        choices: q.choices,
        answer: q.answer,
        explanation: q.explanation || null,
        difficulty: q.difficulty || 'medium',
      });
    }
  }

  if (validQuestions.length === 0) {
    return NextResponse.json({
      questions: [],
      message: 'No valid questions found'
    });
  }

  // Shuffle and pick random questions
  const shuffled = validQuestions.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return NextResponse.json({
    questions: selected,
    total: validQuestions.length,
    selected: selected.length
  });
}
