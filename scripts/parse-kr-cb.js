/**
 * Korean CB Parser Script
 *
 * Parses Korean Concept Briefing markdown files from knowledge-db-pipeline
 * and outputs JSON files for jubilee-bridge.
 *
 * Usage:
 *   node parse-kr-cb.js              # Parse all subjects
 *   node parse-kr-cb.js --subject kr_math  # Parse specific subject
 *   node parse-kr-cb.js --dry-run    # Test without writing
 */

const fs = require('fs');
const path = require('path');

// Paths
const INPUT_BASE = '/Users/apple/knowledge-db-pipeline/output';
const OUTPUT_DIR = path.join(__dirname, '../public/data');

// Subject mapping: folder name → output file suffix
const SUBJECTS = {
  kr_math: 'math',
  kr_korean: 'korean',
  kr_english: 'english',
  kr_physics: 'physics',
  kr_chemistry: 'chemistry',
  kr_biology: 'biology',
  kr_history: 'history',
  kr_earth_science: 'earth-science',
  kr_ethics: 'ethics',
  kr_society: 'society'
};

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yamlStr = match[1];
  const result = {};

  // Parse line by line
  const lines = yamlStr.split('\n');
  let currentKey = null;
  let currentArray = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) continue;

    // Check for array item (starts with -)
    if (line.match(/^\s+-\s/)) {
      if (currentArray !== null) {
        const value = line.replace(/^\s+-\s*/, '').trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        currentArray.push(cleanValue);
      }
      continue;
    }

    // Check for key: value
    const keyMatch = line.match(/^([a-z_]+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[1];
      let value = keyMatch[2].trim();

      // Handle inline arrays [item1, item2]
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.slice(1, -1);
        if (arrayContent.trim()) {
          result[key] = arrayContent.split(',').map(v => {
            const trimmed = v.trim().replace(/^["']|["']$/g, '');
            // Try to parse as number
            const num = Number(trimmed);
            return isNaN(num) ? trimmed : num;
          });
        } else {
          result[key] = [];
        }
        currentKey = null;
        currentArray = null;
      }
      // Handle empty value followed by array
      else if (value === '' || value === '[]') {
        currentKey = key;
        currentArray = [];
        result[key] = currentArray;
      }
      // Handle boolean
      else if (value === 'true' || value === 'false') {
        result[key] = value === 'true';
        currentKey = null;
        currentArray = null;
      }
      // Handle null
      else if (value === 'null' || value === '~') {
        result[key] = null;
        currentKey = null;
        currentArray = null;
      }
      // Handle quoted string
      else if ((value.startsWith('"') && value.endsWith('"')) ||
               (value.startsWith("'") && value.endsWith("'"))) {
        result[key] = value.slice(1, -1);
        currentKey = null;
        currentArray = null;
      }
      // Handle unquoted value
      else {
        result[key] = value;
        currentKey = null;
        currentArray = null;
      }
    }
  }

  return result;
}

/**
 * Extract body content after frontmatter
 */
function getBodyContent(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

/**
 * Parse a section from markdown body by heading
 */
function parseSection(body, heading) {
  const regex = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = body.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Parse Learning Pathways section into object
 */
function parseLearningPathways(body) {
  const section = parseSection(body, 'Learning Pathways');
  if (!section) return {};

  const pathways = {};
  const types = ['real_life', 'visual', 'procedural', 'analogy', 'error_correction'];

  for (const type of types) {
    const regex = new RegExp(`- \\*\\*${type}\\*\\*:\\s*(.+?)(?=\\n- \\*\\*|$)`, 's');
    const match = section.match(regex);
    if (match) {
      pathways[type] = match[1].trim();
    }
  }

  return pathways;
}

/**
 * Parse Bloom Levels section into object
 */
function parseBloomLevels(body) {
  const section = parseSection(body, 'Bloom Levels');
  if (!section) return {};

  const levels = {};
  const types = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

  for (const type of types) {
    const regex = new RegExp(`- \\*\\*${type}\\*\\*:\\s*(.+?)(?=\\n- \\*\\*|$)`, 's');
    const match = section.match(regex);
    if (match) {
      levels[type] = match[1].trim();
    }
  }

  return levels;
}

/**
 * Parse Enrichment section
 */
function parseEnrichment(body) {
  const section = parseSection(body, 'Enrichment');
  if (!section) return {};

  const enrichment = {};

  // Parse history
  const historyMatch = section.match(/- \*\*history\*\*:\s*(.+?)(?=\n- \*\*|$)/s);
  if (historyMatch) enrichment.history = historyMatch[1].trim();

  // Parse real_world (may have multiple items)
  const realWorldMatch = section.match(/- \*\*real_world\*\*:\s*([\s\S]*?)(?=\n- \*\*faq\*\*|$)/);
  if (realWorldMatch) {
    const items = realWorldMatch[1].split(/\n-\s+/).filter(s => s.trim());
    enrichment.real_world = items.map(s => s.trim());
  }

  // Parse faq (may have multiple items)
  const faqMatch = section.match(/- \*\*faq\*\*:\s*([\s\S]*?)(?=\n- \*\*test_patterns|$)/);
  if (faqMatch) {
    const items = faqMatch[1].split(/\n-\s+/).filter(s => s.trim() && !s.startsWith('**'));
    enrichment.faq = items.map(s => s.trim().replace(/^["']|["']$/g, ''));
  }

  // Parse test_patterns
  const satMatch = section.match(/- \*\*test_patterns\.sat\*\*:\s*(.+?)(?=\n- \*\*|$)/s);
  const csatMatch = section.match(/- \*\*test_patterns\.csat\*\*:\s*(.+?)(?=\n- \*\*|$)/s);
  if (satMatch || csatMatch) {
    enrichment.test_patterns = {};
    if (satMatch) enrichment.test_patterns.sat = satMatch[1].trim();
    if (csatMatch) enrichment.test_patterns.csat = csatMatch[1].trim();
  }

  // Parse visual_resources
  const visualMatch = section.match(/- \*\*visual_resources\*\*:\s*([\s\S]*?)(?=\n## |$)/);
  if (visualMatch) {
    const items = visualMatch[1].split(/\n-\s+/).filter(s => s.trim());
    enrichment.visual_resources = items.map(s => s.trim());
  }

  return enrichment;
}

/**
 * Parse Mastery section (diagnostic_questions, common_errors)
 */
function parseMastery(body) {
  const section = parseSection(body, 'Mastery');
  if (!section) return { diagnostic_questions: [], common_errors: [] };

  const mastery = {
    diagnostic_questions: [],
    common_errors: []
  };

  // Parse diagnostic questions
  const dqMatch = section.match(/- \*\*diagnostic_questions[^*]*\*\*:\s*([\s\S]*?)(?=\n- \*\*common_errors|$)/);
  if (dqMatch) {
    const items = dqMatch[1].split(/\n-\s+/).filter(s => s.trim());
    mastery.diagnostic_questions = items.map(q => ({
      question: q.trim(),
      type: q.includes('①') || q.includes('(객관식)') ? 'multiple_choice' : 'open_ended'
    }));
  }

  // Parse common errors
  const ceMatch = section.match(/- \*\*common_errors\*\*:\s*([\s\S]*?)(?=\n## |$)/);
  if (ceMatch) {
    const items = ceMatch[1].split(/\n-\s+/).filter(s => s.trim());
    mastery.common_errors = items.map(s => s.trim());
  }

  return mastery;
}

/**
 * Parse Meta Cognition section
 */
function parseMetaCognition(body) {
  const section = parseSection(body, 'Meta Cognition');
  if (!section) return {};

  const meta = {};

  const cuesMatch = section.match(/- \*\*problem_type_cues\*\*:\s*(.+?)(?=\n- \*\*|$)/s);
  if (cuesMatch) meta.problem_type_cues = cuesMatch[1].trim();

  const diagMatch = section.match(/- \*\*stuck_diagnosis\*\*:\s*([\s\S]*?)(?=\n- \*\*self_check|$)/);
  if (diagMatch) {
    const items = diagMatch[1].split(/\n-\s+/).filter(s => s.trim() && !s.startsWith('**'));
    meta.stuck_diagnosis = items.length > 1 ? items.map(s => s.trim()) : diagMatch[1].trim();
  }

  const checkMatch = section.match(/- \*\*self_check\*\*:\s*(.+?)(?=\n## |$)/s);
  if (checkMatch) meta.self_check = checkMatch[1].trim();

  return meta;
}

/**
 * Parse Transfer Contexts section
 */
function parseTransferContexts(body) {
  const section = parseSection(body, 'Transfer Contexts');
  if (!section) return [];

  const items = section.split(/\n-\s+/).filter(s => s.trim());
  return items.map(s => s.trim());
}

/**
 * Parse AI Era section
 */
function parseAIEra(body) {
  const section = parseSection(body, 'AI Era');
  if (!section) return {};

  const aiEra = {};

  const canDoMatch = section.match(/- \*\*ai_can_do\*\*:\s*(.+?)(?=\n- \*\*|$)/s);
  if (canDoMatch) aiEra.ai_can_do = canDoMatch[1].trim();

  const mustDoMatch = section.match(/- \*\*human_must_do\*\*:\s*(.+?)(?=\n- \*\*|$)/s);
  if (mustDoMatch) aiEra.human_must_do = mustDoMatch[1].trim();

  const promptMatch = section.match(/- \*\*ai_prompt_example\*\*:\s*(.+?)(?=\n## |$)/s);
  if (promptMatch) aiEra.ai_prompt_example = promptMatch[1].trim();

  return aiEra;
}

/**
 * Parse Time Benchmarks section
 */
function parseTimeBenchmarks(body) {
  const section = parseSection(body, 'Time Benchmarks');
  if (!section) return [];

  const items = section.split('\n').filter(s => s.trim() && s.includes('/'));
  return items.map(s => s.replace(/^-\s*/, '').trim());
}

/**
 * Parse a single Korean CB markdown file
 */
function parseKoreanCB(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatter = parseFrontmatter(content);
  const body = getBodyContent(content);

  // Parse all sections
  const learningPathways = parseLearningPathways(body);
  const bloomLevels = parseBloomLevels(body);
  const enrichment = parseEnrichment(body);
  const mastery = parseMastery(body);
  const metaCognition = parseMetaCognition(body);
  const transferContexts = parseTransferContexts(body);
  const aiEra = parseAIEra(body);
  const timeBenchmarks = parseTimeBenchmarks(body);

  // Build output object
  return {
    // Core fields (compatible with US CB)
    concept_id: frontmatter.concept_id || '',
    title_ko: frontmatter.title_ko || '',
    title_en: frontmatter.title_en || '',
    cluster: frontmatter.cluster || '',
    learning_pathways: learningPathways,
    diagnostic_questions: mastery.diagnostic_questions,
    common_errors: mastery.common_errors,
    test_patterns: enrichment.test_patterns || {},
    faq: enrichment.faq || [],
    meta_cognition: metaCognition,
    core_description: learningPathways.real_life || '',

    // Korean-specific fields
    sub_cluster: frontmatter.sub_cluster || '',
    csat_unit: frontmatter.csat_unit || '',
    grade_kr: frontmatter.grade_kr || [],
    prerequisite_ids: frontmatter.prerequisite_ids || [],  // ★ Skill map essential
    exam_frequency: frontmatter.exam_frequency || '',
    exam_difficulty: frontmatter.exam_difficulty || '',
    ebs_reference: frontmatter.ebs_reference || '',
    textbook_reference: frontmatter.textbook_reference || '',
    us_equivalent: frontmatter.us_equivalent || null,

    // Extended content
    bloom_levels: bloomLevels,
    enrichment: {
      history: enrichment.history || '',
      real_world: enrichment.real_world || [],
      visual_resources: enrichment.visual_resources || []
    },
    transfer_contexts: transferContexts,
    ai_era: aiEra,
    time_benchmarks: timeBenchmarks
  };
}

/**
 * Process a subject folder
 */
function processSubject(folderName, outputSuffix, dryRun = false) {
  const inputDir = path.join(INPUT_BASE, folderName);
  const outputFile = path.join(OUTPUT_DIR, `cb-content-kr-${outputSuffix}.json`);

  console.log(`\nProcessing ${folderName}...`);

  // Check input directory exists
  if (!fs.existsSync(inputDir)) {
    console.log(`  ⚠️ Directory not found: ${inputDir}`);
    return { success: 0, failed: 0 };
  }

  // Get all .md files
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.md') && f.startsWith('CB_'));
  console.log(`  Found ${files.length} CB files`);

  const result = {};
  let success = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    try {
      const parsed = parseKoreanCB(filePath);
      if (parsed.concept_id) {
        result[parsed.concept_id] = parsed;
        success++;
      } else {
        console.log(`  ⚠️ No concept_id: ${file}`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ Error parsing ${file}: ${error.message}`);
      failed++;
    }
  }

  console.log(`  ✅ Parsed: ${success}, ❌ Failed: ${failed}`);

  // Write output
  if (!dryRun && success > 0) {
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`  📁 Saved: ${outputFile}`);
  }

  return { success, failed };
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const subjectArg = args.find(a => a.startsWith('--subject='));
  const specificSubject = subjectArg ? subjectArg.split('=')[1] : null;

  console.log('='.repeat(60));
  console.log('Korean CB Parser');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log(`Input: ${INPUT_BASE}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let totalSuccess = 0;
  let totalFailed = 0;

  // Process subjects
  const subjectsToProcess = specificSubject
    ? { [specificSubject]: SUBJECTS[specificSubject] }
    : SUBJECTS;

  for (const [folder, suffix] of Object.entries(subjectsToProcess)) {
    if (!suffix) {
      console.log(`\n⚠️ Unknown subject: ${folder}`);
      continue;
    }
    const { success, failed } = processSubject(folder, suffix, dryRun);
    totalSuccess += success;
    totalFailed += failed;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total parsed: ${totalSuccess}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`Success rate: ${((totalSuccess / (totalSuccess + totalFailed)) * 100).toFixed(1)}%`);

  if (dryRun) {
    console.log('\n⚠️ DRY RUN - No files were written');
  }
}

// Run
main();
