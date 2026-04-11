import { NextResponse } from 'next/server';

// 캐시 (메모리)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1시간

// Canvas API 호출
async function fetchFromCanvas(canvasUrl, token, endpoint) {
  const url = `${canvasUrl}/api/v1${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Canvas API error: ${response.status}`);
  }

  return response.json();
}

// 모든 활성 과목의 과제 가져오기
async function fetchAllAssignments(canvasUrl, token) {
  // 1. 활성 과목 목록 가져오기
  const courses = await fetchFromCanvas(canvasUrl, token, '/courses?enrollment_state=active&per_page=50');

  if (!Array.isArray(courses) || courses.length === 0) {
    return [];
  }

  // 2. 각 과목별 과제 가져오기 (병렬)
  const assignmentPromises = courses.map(async (course) => {
    try {
      const assignments = await fetchFromCanvas(
        canvasUrl,
        token,
        `/courses/${course.id}/assignments?order_by=due_at&bucket=upcoming&per_page=50`
      );

      // 과목명 추가
      return (assignments || []).map(a => ({
        ...a,
        course_name: course.name,
        course_id: course.id,
      }));
    } catch (error) {
      console.error(`Failed to fetch assignments for course ${course.id}:`, error);
      return [];
    }
  });

  const allAssignments = await Promise.all(assignmentPromises);

  // 3. 평탄화 + 마감일 기준 정렬
  const flattened = allAssignments.flat().filter(a => a.due_at);
  flattened.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

  return flattened;
}

// 필요한 필드만 추출
function formatAssignment(a) {
  return {
    id: a.id,
    name: a.name,
    description: a.description?.substring(0, 500) || '', // 설명 잘라서
    course_name: a.course_name,
    course_id: a.course_id,
    due_at: a.due_at,
    points_possible: a.points_possible,
    html_url: a.html_url,
    submission_types: a.submission_types,
    workflow_state: a.submission?.workflow_state || 'unsubmitted',
    submitted: a.has_submitted_submissions || false,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const student = searchParams.get('student');
  const refresh = searchParams.get('refresh') === 'true';

  if (!student) {
    return NextResponse.json({
      success: false,
      error: 'student parameter is required',
    }, { status: 400 });
  }

  // 캐시 확인 (refresh가 아닌 경우)
  const cacheKey = `canvas_${student}`;
  if (!refresh && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        cached: true,
        cachedAt: new Date(cached.timestamp).toISOString(),
      });
    }
  }

  // Canvas 설정 읽기 (요청에서 받음 - 프론트에서 localStorage에서 읽어서 전달)
  const canvasUrl = searchParams.get('canvasUrl');
  const canvasToken = searchParams.get('canvasToken');

  if (!canvasUrl || !canvasToken) {
    return NextResponse.json({
      success: false,
      error: 'Canvas 설정이 필요합니다. 설정 페이지에서 Canvas를 연동하세요.',
      needsSetup: true,
    }, { status: 400 });
  }

  try {
    const assignments = await fetchAllAssignments(canvasUrl, canvasToken);
    const formatted = assignments.map(formatAssignment);

    // 캐시 저장
    cache.set(cacheKey, {
      data: formatted,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: formatted,
      count: formatted.length,
      cached: false,
    });
  } catch (error) {
    console.error('Canvas API error:', error);

    return NextResponse.json({
      success: false,
      error: 'Canvas에서 과제를 가져오는데 실패했습니다.',
    }, { status: 500 });
  }
}
