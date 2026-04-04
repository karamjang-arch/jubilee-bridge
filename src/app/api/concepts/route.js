import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// CB 데이터 파일 경로 (public/data 폴더 사용 - Vercel 호환)
const CB_DATA_PATH = path.join(process.cwd(), 'public', 'data');

const CB_FILES = {
  math: 'concepts_master.json',
  english: 'concepts_master_english.json',
  physics: 'concepts_master_physics.json',
  chemistry: 'concepts_master_chemistry.json',
  biology: 'concepts_master_biology.json',
  history: 'concepts_master_history.json',
  economics: 'concepts_master_economics.json',
  cs: 'concepts_master_cs.json',
};

// 캐시 (메모리)
let conceptsCache = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1시간

async function loadAllConcepts() {
  // 캐시 체크
  if (conceptsCache && Date.now() - cacheTime < CACHE_TTL) {
    return conceptsCache;
  }

  const allConcepts = {
    subjects: {},
    totalCount: 0,
    clusters: {},
  };

  for (const [subject, filename] of Object.entries(CB_FILES)) {
    try {
      const filePath = path.join(CB_DATA_PATH, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // concepts 배열 추출
      const concepts = data.concepts || [];

      allConcepts.subjects[subject] = {
        count: concepts.length,
        concepts: concepts.map(c => ({
          id: c.concept_id,
          title_en: c.title_en,
          title_ko: c.title_ko,
          cluster: c.cluster,
          sub_cluster: c.sub_cluster,
          grade_us: c.grade_us,
          sat_domain: c.sat_domain,
          sat_skill: c.sat_skill,
          prerequisites: c.relationships?.prerequisites || [],
          relationships: {
            prerequisites: c.relationships?.prerequisites || [],
            corequisites: c.relationships?.corequisites || [],
            extends_to: c.relationships?.extends_to || [],
            applies_to: c.relationships?.applies_to || [],
            common_confusions: c.relationships?.common_confusions || [],
          },
          learning_pathways: c.learning_pathways,
          diagnostic_questions: c.mastery?.diagnostic_questions,
          common_errors: c.mastery?.common_errors,
          bloom_levels: c.bloom_levels,
        })),
      };

      allConcepts.totalCount += concepts.length;

      // 클러스터 집계
      concepts.forEach(c => {
        const cluster = c.cluster || 'Uncategorized';
        if (!allConcepts.clusters[subject]) {
          allConcepts.clusters[subject] = {};
        }
        if (!allConcepts.clusters[subject][cluster]) {
          allConcepts.clusters[subject][cluster] = {
            name: cluster,
            count: 0,
            subClusters: {},
          };
        }
        allConcepts.clusters[subject][cluster].count++;

        // Sub-cluster
        const subCluster = c.sub_cluster || 'general';
        if (!allConcepts.clusters[subject][cluster].subClusters[subCluster]) {
          allConcepts.clusters[subject][cluster].subClusters[subCluster] = 0;
        }
        allConcepts.clusters[subject][cluster].subClusters[subCluster]++;
      });
    } catch (error) {
      console.error(`Failed to load ${subject}:`, error.message);
      allConcepts.subjects[subject] = { count: 0, concepts: [], error: error.message };
    }
  }

  // 캐시 저장
  conceptsCache = allConcepts;
  cacheTime = Date.now();

  return allConcepts;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get('subject');
  const cluster = searchParams.get('cluster');
  const conceptId = searchParams.get('id');
  const summary = searchParams.get('summary') === 'true';

  try {
    const data = await loadAllConcepts();

    // 특정 개념 ID 조회
    if (conceptId) {
      for (const [subj, subjData] of Object.entries(data.subjects)) {
        const concept = subjData.concepts?.find(c => c.id === conceptId);
        if (concept) {
          return NextResponse.json({ concept, subject: subj });
        }
      }
      return NextResponse.json({ error: 'Concept not found' }, { status: 404 });
    }

    // 요약만 반환
    if (summary) {
      const summaryData = {
        totalCount: data.totalCount,
        subjects: Object.entries(data.subjects).map(([id, s]) => ({
          id,
          count: s.count,
          clusters: Object.keys(data.clusters[id] || {}).length,
        })),
        clusters: data.clusters,
      };
      return NextResponse.json(summaryData);
    }

    // 특정 과목 조회
    if (subject) {
      const subjectData = data.subjects[subject];
      if (!subjectData) {
        return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
      }

      // 특정 클러스터 필터
      if (cluster) {
        const filteredConcepts = subjectData.concepts.filter(c => c.cluster === cluster);
        return NextResponse.json({
          subject,
          cluster,
          count: filteredConcepts.length,
          concepts: filteredConcepts,
        });
      }

      return NextResponse.json({
        subject,
        ...subjectData,
        clusters: data.clusters[subject],
      });
    }

    // 전체 데이터 (요약 형태)
    return NextResponse.json({
      totalCount: data.totalCount,
      subjects: Object.entries(data.subjects).map(([id, s]) => ({
        id,
        count: s.count,
      })),
    });
  } catch (error) {
    console.error('Concepts API error:', error);
    return NextResponse.json({ error: 'Failed to load concepts' }, { status: 500 });
  }
}
