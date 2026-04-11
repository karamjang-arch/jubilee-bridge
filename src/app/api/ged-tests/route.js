import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const JSON_DIR = path.join(process.cwd(), 'public/tests/json');

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get('id');

  try {
    if (testId) {
      // Return single test
      const filePath = path.join(JSON_DIR, `${testId}.json`);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Test not found' }, { status: 404 });
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return NextResponse.json(data);
    }

    // Return test list
    const files = fs.readdirSync(JSON_DIR).filter(f => f.startsWith('ged-') && f.endsWith('.json'));

    const tests = files.map(file => {
      const data = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf-8'));
      return {
        id: data.id,
        name: data.name,
        level: data.level,
        levelKo: data.levelKo,
        year: data.year,
        round: data.round,
        subject: data.subject,
        totalQuestions: data.totalQuestions,
      };
    });

    // Sort by year desc, round desc, level, subject
    tests.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.round !== b.round) return b.round - a.round;
      const levelOrder = { high: 1, mid: 2, unknown: 3 };
      if (levelOrder[a.level] !== levelOrder[b.level]) {
        return levelOrder[a.level] - levelOrder[b.level];
      }
      return a.subject.localeCompare(b.subject, 'ko');
    });

    const stats = {
      total: tests.length,
      totalQuestions: tests.reduce((sum, t) => sum + t.totalQuestions, 0),
      byLevel: {},
      byYear: {},
      bySubject: {},
    };

    tests.forEach(t => {
      stats.byLevel[t.levelKo] = (stats.byLevel[t.levelKo] || 0) + 1;
      stats.byYear[t.year] = (stats.byYear[t.year] || 0) + 1;
      stats.bySubject[t.subject] = (stats.bySubject[t.subject] || 0) + 1;
    });

    return NextResponse.json({ tests, stats });
  } catch (error) {
    console.error('GED Tests API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
