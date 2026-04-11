import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TESTS_DIR = path.join(process.cwd(), 'public', 'tests', 'json');

// GET: List available tests or get specific test
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get('id');
  const section = searchParams.get('section'); // rw or math
  const module = searchParams.get('module'); // 1 or 2

  // List all available tests
  if (!testId) {
    try {
      if (!fs.existsSync(TESTS_DIR)) {
        return NextResponse.json({ tests: [] });
      }

      // SAT 테스트만 필터링 (sat- 접두사)
      const files = fs.readdirSync(TESTS_DIR).filter(f =>
        f.endsWith('.json') && f.startsWith('sat-')
      );
      const tests = files.map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(TESTS_DIR, f), 'utf-8'));
        return {
          id: data.id,
          name: data.name,
          source: data.source,
          totalQuestions: data.totalQuestions,
          sections: {
            reading_writing: {
              module1: data.sections?.reading_writing?.module1?.length || 0,
              module2: data.sections?.reading_writing?.module2?.length || 0,
            },
            math: {
              module1: data.sections?.math?.module1?.length || 0,
              module2: data.sections?.math?.module2?.length || 0,
            },
          },
        };
      });

      return NextResponse.json({ tests });
    } catch (error) {
      console.error('Error listing tests:', error);
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

    // If requesting specific section/module
    if (section && module) {
      const sectionKey = section === 'rw' ? 'reading_writing' : 'math';
      const moduleKey = `module${module}`;
      const questions = data.sections?.[sectionKey]?.[moduleKey] || [];

      return NextResponse.json({
        testId: data.id,
        testName: data.name,
        section: sectionKey,
        module: parseInt(module),
        questions,
        totalQuestions: questions.length,
      });
    }

    // Return full test
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading test:', error);
    return NextResponse.json({ error: 'Failed to load test' }, { status: 500 });
  }
}
