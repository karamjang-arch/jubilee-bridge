import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// CB 데이터 파일 경로 (public/data 폴더 사용 - Vercel 호환)
const CB_DATA_PATH = path.join(process.cwd(), 'public', 'data');

// US CB 파일 (8과목)
const CB_FILES_US = {
  math: 'concepts_master.json',
  english: 'concepts_master_english.json',
  physics: 'concepts_master_physics.json',
  chemistry: 'concepts_master_chemistry.json',
  biology: 'concepts_master_biology.json',
  history: 'concepts_master_history.json',
  economics: 'concepts_master_economics.json',
  cs: 'concepts_master_cs.json',
};

// 한국 CB 파일 (10과목)
const CB_FILES_KR = {
  'kr-math': 'cb-content-kr-math.json',
  'kr-english': 'cb-content-kr-english.json',
  'kr-korean': 'cb-content-kr-korean.json',
  'kr-history': 'cb-content-kr-history.json',
  'kr-society': 'cb-content-kr-society.json',
  'kr-ethics': 'cb-content-kr-ethics.json',
  'kr-physics': 'cb-content-kr-physics.json',
  'kr-chemistry': 'cb-content-kr-chemistry.json',
  'kr-biology': 'cb-content-kr-biology.json',
  'kr-earth-science': 'cb-content-kr-earth-science.json',
};

// 레거시 호환용
const CB_FILES = CB_FILES_US;

// 캐시 (메모리) - 교육과정별로 분리
let conceptsCacheUS = null;
let conceptsCacheKR = null;
let cacheTimeUS = 0;
let cacheTimeKR = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1시간

/**
 * US CB 데이터 로드 (기존 구조)
 */
async function loadUSConcepts() {
  if (conceptsCacheUS && Date.now() - cacheTimeUS < CACHE_TTL) {
    return conceptsCacheUS;
  }

  const allConcepts = {
    curriculum: 'us',
    subjects: {},
    totalCount: 0,
    clusters: {},
  };

  for (const [subject, filename] of Object.entries(CB_FILES_US)) {
    try {
      const filePath = path.join(CB_DATA_PATH, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      const rawConcepts = data.concepts || [];
      const concepts = rawConcepts.filter(c => {
        if (!c.grade_us || c.grade_us.length === 0) return true;
        return c.grade_us.some(g => g >= 5);
      });

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

        const subCluster = c.sub_cluster || 'general';
        if (!allConcepts.clusters[subject][cluster].subClusters[subCluster]) {
          allConcepts.clusters[subject][cluster].subClusters[subCluster] = 0;
        }
        allConcepts.clusters[subject][cluster].subClusters[subCluster]++;
      });
    } catch (error) {
      console.error(`Failed to load US ${subject}:`, error.message);
      allConcepts.subjects[subject] = { count: 0, concepts: [], error: error.message };
    }
  }

  conceptsCacheUS = allConcepts;
  cacheTimeUS = Date.now();
  return allConcepts;
}

/**
 * 한국 CB 데이터 로드 (새 구조)
 */
async function loadKRConcepts() {
  if (conceptsCacheKR && Date.now() - cacheTimeKR < CACHE_TTL) {
    return conceptsCacheKR;
  }

  const allConcepts = {
    curriculum: 'kr',
    subjects: {},
    totalCount: 0,
    clusters: {},
  };

  for (const [subject, filename] of Object.entries(CB_FILES_KR)) {
    try {
      const filePath = path.join(CB_DATA_PATH, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // 한국 CB는 { concept_id: {...} } 형태
      const conceptEntries = Object.entries(data);
      const concepts = conceptEntries.map(([id, c]) => ({
        id: c.concept_id || id,
        title_en: c.title_en || '',
        title_ko: c.title_ko || '',
        cluster: c.cluster || '',
        sub_cluster: c.sub_cluster || '',
        grade_kr: c.grade_kr || [],
        csat_unit: c.csat_unit || '',
        exam_frequency: c.exam_frequency || '',
        exam_difficulty: c.exam_difficulty || '',
        prerequisite_ids: c.prerequisite_ids || [],
        prerequisites: c.prerequisite_ids || [],
        relationships: {
          prerequisites: c.prerequisite_ids || [],
          corequisites: [],
          extends_to: [],
          applies_to: [],
          common_confusions: [],
        },
        learning_pathways: c.learning_pathways || {},
        diagnostic_questions: c.diagnostic_questions || [],
        common_errors: c.common_errors || [],
        bloom_levels: c.bloom_levels || {},
        test_patterns: c.test_patterns || {},
        enrichment: c.enrichment || {},
        ai_era: c.ai_era || {},
        ebs_reference: c.ebs_reference || '',
        textbook_reference: c.textbook_reference || '',
      }));

      allConcepts.subjects[subject] = {
        count: concepts.length,
        concepts,
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

        const subCluster = c.sub_cluster || 'general';
        if (!allConcepts.clusters[subject][cluster].subClusters[subCluster]) {
          allConcepts.clusters[subject][cluster].subClusters[subCluster] = 0;
        }
        allConcepts.clusters[subject][cluster].subClusters[subCluster]++;
      });
    } catch (error) {
      console.error(`Failed to load KR ${subject}:`, error.message);
      allConcepts.subjects[subject] = { count: 0, concepts: [], error: error.message };
    }
  }

  conceptsCacheKR = allConcepts;
  cacheTimeKR = Date.now();
  return allConcepts;
}

/**
 * 교육과정에 따라 데이터 로드
 */
async function loadAllConcepts(curriculum = 'us') {
  if (curriculum === 'kr') {
    return loadKRConcepts();
  }
  return loadUSConcepts();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get('subject');
  const cluster = searchParams.get('cluster');
  const conceptId = searchParams.get('id');
  const summary = searchParams.get('summary') === 'true';
  const curriculum = searchParams.get('curriculum') || 'us';
  const searchQuery = searchParams.get('search');

  try {
    // 개념 ID로 교육과정 자동 감지
    const effectiveCurriculum = conceptId?.startsWith('KR-') ? 'kr' : curriculum;
    const data = await loadAllConcepts(effectiveCurriculum);

    // 검색 쿼리가 있으면 전체 과목에서 검색
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const results = [];
      for (const [subj, subjData] of Object.entries(data.subjects)) {
        const matches = subjData.concepts?.filter(c =>
          c.title_en?.toLowerCase().includes(query) ||
          c.title_ko?.toLowerCase().includes(query) ||
          c.id?.toLowerCase().includes(query)
        ) || [];
        matches.forEach(c => results.push({ ...c, concept_id: c.id, subject: subj }));
      }
      // 상위 10개만 반환
      return NextResponse.json({ concepts: results.slice(0, 10) });
    }

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
        curriculum: data.curriculum || effectiveCurriculum,
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
