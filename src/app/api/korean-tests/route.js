import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TESTS_DIR = path.join(process.cwd(), 'public', 'tests', 'json');

// GET: List available Korean tests or get specific test
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get('id');

  // List all available Korean tests
  if (!testId) {
    try {
      if (!fs.existsSync(TESTS_DIR)) {
        return NextResponse.json({ tests: [] });
      }

      const files = fs.readdirSync(TESTS_DIR).filter(f => f.startsWith('korean-') && f.endsWith('.json'));
      const tests = files.map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(TESTS_DIR, f), 'utf-8'));
        return {
          id: data.id,
          name: data.name,
          source: data.source,
          testType: data.testType,
          year: data.year,
          month: data.month,
          subject: data.subject,
          totalQuestions: data.totalQuestions,
        };
      });

      // Sort by year (desc), month, subject
      tests.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        if (b.month !== a.month) return b.month - a.month;
        return a.subject.localeCompare(b.subject);
      });

      return NextResponse.json({ tests });
    } catch (error) {
      console.error('Error listing Korean tests:', error);
      return NextResponse.json({ error: 'Failed to list tests' }, { status: 500 });
    }
  }

  // Get specific test
  try {
    const testPath = path.join(TESTS_DIR, `${testId}.json`);
    if (!fs.existsSync(testPath)) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    const data = JSON.parse(fs.readFileSync(testPath, 'utf-8'));
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading Korean test:', error);
    return NextResponse.json({ error: 'Failed to load test' }, { status: 500 });
  }
}
