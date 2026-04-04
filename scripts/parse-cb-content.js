#!/usr/bin/env node
/**
 * CB MD 파일 파서
 * ~/knowledge-db-pipeline/output/[과목]/CB_*.md → cb-content-[과목].json
 */

const fs = require('fs');
const path = require('path');

// 과목 폴더 매핑
const SUBJECT_FOLDERS = {
  math: 'Math',
  english: 'english',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  history: 'history',
  economics: 'economics',
  cs: 'cs',
};

const INPUT_DIR = path.join(process.env.HOME, 'knowledge-db-pipeline/output');
const OUTPUT_DIR = path.join(__dirname, '../public/data');

// YAML frontmatter 파싱
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const yamlStr = match[1];
  const body = content.slice(match[0].length).trim();

  // 간단한 YAML 파싱 (gray-matter 없이)
  const frontmatter = {};
  const lines = yamlStr.split('\n');
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 배열 항목
    if (trimmed.startsWith('- ')) {
      if (currentArray !== null) {
        frontmatter[currentKey].push(trimmed.slice(2).trim());
      }
      continue;
    }

    // 키: 값
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      let value = trimmed.slice(colonIdx + 1).trim();

      // 따옴표 제거
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // 배열 시작 감지
      if (value === '' || value === '[]') {
        frontmatter[key] = [];
        currentKey = key;
        currentArray = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // 인라인 배열 [1, 2, 3]
        try {
          frontmatter[key] = JSON.parse(value);
        } catch {
          frontmatter[key] = value;
        }
        currentKey = null;
        currentArray = null;
      } else if (value === 'null') {
        frontmatter[key] = null;
        currentKey = null;
        currentArray = null;
      } else if (value === 'true') {
        frontmatter[key] = true;
        currentKey = null;
        currentArray = null;
      } else if (value === 'false') {
        frontmatter[key] = false;
        currentKey = null;
        currentArray = null;
      } else {
        frontmatter[key] = value;
        currentKey = null;
        currentArray = null;
      }
    }
  }

  return { frontmatter, body };
}

// 섹션 추출
function extractSections(body) {
  const sections = {};
  const sectionRegex = /^## (.+)$/gm;
  let match;
  const matches = [];

  while ((match = sectionRegex.exec(body)) !== null) {
    matches.push({ title: match[1].trim(), index: match.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i < matches.length - 1 ? matches[i + 1].index : body.length;
    const sectionContent = body.slice(start, end);
    const title = matches[i].title.toLowerCase().replace(/\s+/g, '_');
    sections[title] = sectionContent;
  }

  return sections;
}

// Learning Pathways 파싱
function parseLearningPathways(section) {
  if (!section) return {};

  const pathways = {};
  const pathwayTypes = ['real_life', 'visual', 'procedural', 'analogy', 'error_correction'];

  for (const type of pathwayTypes) {
    // - **type**: content 패턴
    const regex = new RegExp(`-\\s*\\*\\*${type}\\*\\*:\\s*(.+?)(?=\\n-\\s*\\*\\*|$)`, 's');
    const match = section.match(regex);
    if (match) {
      pathways[type] = match[1].trim();
    }
  }

  return pathways;
}

// Diagnostic Questions 파싱
function parseDiagnosticQuestions(section) {
  if (!section) return [];

  const questions = [];

  // - **diagnostic_questions (3)**: 섹션 찾기
  const diagMatch = section.match(/diagnostic_questions[^:]*:\s*([\s\S]*?)(?=\n-\s*\*\*[a-z]|$)/i);
  if (!diagMatch) return [];

  const diagSection = diagMatch[1];

  // 각 질문 줄 추출 (- 로 시작하는 줄들)
  const questionLines = diagSection.split('\n').filter(line => line.trim().startsWith('-'));

  for (const line of questionLines) {
    const questionText = line.replace(/^-\s*/, '').trim();
    if (!questionText) continue;

    // 인라인 선택지 패턴 감지: (is/are), (likes/like) 등
    const inlineChoiceMatch = questionText.match(/\(([^)]+\/[^)]+)\)/);

    if (inlineChoiceMatch) {
      // 선택지 추출
      const choicesStr = inlineChoiceMatch[1];
      const choices = choicesStr.split('/').map(c => c.trim());

      // 정답 추론 (보통 첫 번째 또는 문맥에 따라)
      // 여기서는 단순히 선택지만 추출
      questions.push({
        question: questionText,
        choices: choices,
        answer: choices[0], // 기본값, 실제로는 정답 필요
        explanation: '',
        type: 'inline_choice'
      });
    } else {
      // 옵션이 ① ② ③ ④ 형태인 경우
      const numberedMatch = questionText.match(/[①②③④⑤]/);
      if (numberedMatch) {
        const optionRegex = /[①②③④⑤]\s*([^①②③④⑤]+)/g;
        const choices = [];
        let m;
        while ((m = optionRegex.exec(questionText)) !== null) {
          choices.push(m[1].trim().replace(/,\s*$/, ''));
        }

        // 질문 부분 추출
        const qPart = questionText.split(/[①②③④⑤]/)[0].trim();

        questions.push({
          question: qPart,
          choices: choices,
          answer: '', // 정답 정보 없음
          explanation: '',
          type: 'numbered_choice'
        });
      } else {
        // 일반 텍스트 질문
        questions.push({
          question: questionText,
          choices: [],
          answer: '',
          explanation: '',
          type: 'open_ended'
        });
      }
    }
  }

  return questions;
}

// Common Errors 파싱
function parseCommonErrors(section) {
  if (!section) return [];

  const errors = [];
  const errorMatch = section.match(/common_errors[^:]*:\s*([\s\S]*?)(?=\n##|$)/i);
  if (!errorMatch) return [];

  const errorSection = errorMatch[1];
  const lines = errorSection.split('\n').filter(line => line.trim().startsWith('-'));

  for (const line of lines) {
    const error = line.replace(/^-\s*/, '').trim();
    if (error) errors.push(error);
  }

  return errors;
}

// Test Patterns 파싱
function parseTestPatterns(section) {
  if (!section) return {};

  const patterns = {};

  // SAT 패턴
  const satMatch = section.match(/test_patterns\.sat[^:]*:\s*(.+?)(?=\n-\s*\*\*|$)/s);
  if (satMatch) {
    patterns.sat = satMatch[1].trim();
  }

  // CSAT 패턴
  const csatMatch = section.match(/test_patterns\.csat[^:]*:\s*(.+?)(?=\n-\s*\*\*|$)/s);
  if (csatMatch) {
    patterns.csat = csatMatch[1].trim();
  }

  return patterns;
}

// Free Resources 파싱 (visual_resources에서)
function parseFreeResources(section) {
  if (!section) return [];

  const resources = [];
  const resourceMatch = section.match(/visual_resources[^:]*:\s*([\s\S]*?)(?=\n##|$)/i);
  if (!resourceMatch) return [];

  const resourceSection = resourceMatch[1];
  const lines = resourceSection.split('\n').filter(line => line.trim().startsWith('-'));

  for (const line of lines) {
    const resource = line.replace(/^-\s*-?\s*/, '').trim();
    if (resource) {
      // URL 추출 시도
      const urlMatch = resource.match(/(https?:\/\/[^\s]+)/);
      resources.push({
        title: resource.replace(urlMatch?.[0] || '', '').trim(),
        url: urlMatch?.[1] || '',
        source: resource.includes('Khan') ? 'Khan Academy' :
                resource.includes('YouTube') ? 'YouTube' :
                resource.includes('OpenStax') ? 'OpenStax' :
                resource.includes('PhET') ? 'PhET' : 'Other'
      });
    }
  }

  return resources;
}

// Meta Cognition 파싱
function parseMetaCognition(section) {
  if (!section) return {};

  const meta = {};

  // stuck_diagnosis
  const stuckMatch = section.match(/stuck_diagnosis[^:]*:\s*([\s\S]*?)(?=\n-\s*\*\*|$)/i);
  if (stuckMatch) {
    // 줄바꿈된 내용 합치기
    const lines = stuckMatch[1].split('\n')
      .filter(l => l.trim())
      .map(l => l.replace(/^-\s*/, '').trim())
      .join(' ');
    meta.stuck_diagnosis = lines;
  }

  // self_check
  const selfMatch = section.match(/self_check[^:]*:\s*(.+?)(?=\n##|$)/s);
  if (selfMatch) {
    meta.self_check = selfMatch[1].trim();
  }

  return meta;
}

// Bloom Level 추출 (첫 번째 레벨 기준)
function parseBloomLevel(section) {
  if (!section) return 3; // 기본값: apply

  const levels = {
    'remember': 1,
    'understand': 2,
    'apply': 3,
    'analyze': 4,
    'evaluate': 5,
    'create': 6
  };

  // 첫 번째로 나오는 레벨 찾기
  for (const [level, num] of Object.entries(levels)) {
    if (section.toLowerCase().includes(`**${level}**`)) {
      return num;
    }
  }

  return 3;
}

// 단일 CB MD 파일 파싱
function parseCBFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);
    const sections = extractSections(body);

    const conceptId = frontmatter.concept_id || path.basename(filePath, '.md').replace('CB_', '');

    return {
      concept_id: conceptId,
      title_ko: frontmatter.title_ko || '',
      title_en: frontmatter.title_en || '',
      cluster: frontmatter.cluster || '',
      learning_pathways: parseLearningPathways(sections.learning_pathways),
      diagnostic_questions: parseDiagnosticQuestions(sections.mastery),
      common_errors: parseCommonErrors(sections.mastery),
      test_patterns: parseTestPatterns(sections.enrichment),
      free_resources: parseFreeResources(sections.enrichment),
      meta_cognition: parseMetaCognition(sections.meta_cognition),
      bloom_level: parseBloomLevel(sections.bloom_levels),
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}: ${error.message}`);
    return null;
  }
}

// 과목별 파싱 및 저장
function parseSubject(subjectId) {
  const folderName = SUBJECT_FOLDERS[subjectId];
  const folderPath = path.join(INPUT_DIR, folderName);

  if (!fs.existsSync(folderPath)) {
    console.error(`Folder not found: ${folderPath}`);
    return { success: 0, failed: 0, failedFiles: [] };
  }

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md') && f.startsWith('CB_'));
  const result = {};
  let success = 0;
  let failed = 0;
  const failedFiles = [];

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const parsed = parseCBFile(filePath);

    if (parsed && parsed.concept_id) {
      result[parsed.concept_id] = parsed;
      success++;
    } else {
      failed++;
      failedFiles.push(file);
    }
  }

  // 저장
  const outputPath = path.join(OUTPUT_DIR, `cb-content-${subjectId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`[${subjectId}] Parsed: ${success}, Failed: ${failed}`);
  if (failedFiles.length > 0 && failedFiles.length <= 10) {
    console.log(`  Failed files: ${failedFiles.join(', ')}`);
  }

  return { success, failed, failedFiles };
}

// 메인 실행
function main() {
  console.log('CB Content Parser');
  console.log('=================');
  console.log(`Input: ${INPUT_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('');

  // output 디렉토리 확인
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const stats = {
    total: { success: 0, failed: 0 },
    bySubject: {}
  };

  for (const subjectId of Object.keys(SUBJECT_FOLDERS)) {
    const result = parseSubject(subjectId);
    stats.bySubject[subjectId] = result;
    stats.total.success += result.success;
    stats.total.failed += result.failed;
  }

  console.log('');
  console.log('=================');
  console.log(`Total: ${stats.total.success} parsed, ${stats.total.failed} failed`);
  console.log(`Success rate: ${((stats.total.success / (stats.total.success + stats.total.failed)) * 100).toFixed(1)}%`);

  // 통계 저장
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'cb-content-stats.json'),
    JSON.stringify(stats, null, 2)
  );
}

main();
