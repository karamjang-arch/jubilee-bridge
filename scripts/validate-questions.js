/**
 * Validate generated questions
 *
 * Usage:
 *   node validate-questions.js
 *   node validate-questions.js --subject math
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../public/data');
const SUBJECTS = ['math', 'english', 'physics', 'chemistry', 'biology', 'history', 'economics', 'cs'];

function validateQuestions(targetSubject = null) {
  const subjects = targetSubject ? [targetSubject] : SUBJECTS;

  const stats = {
    totalConcepts: 0,
    totalQuestions: 0,
    bySubject: {},
    issues: {
      missingChoices: 0,
      wrongChoiceCount: 0,
      missingAnswer: 0,
      invalidAnswer: 0,
      missingExplanation: 0,
      emptyQuestion: 0
    }
  };

  for (const subject of subjects) {
    const filePath = path.join(DATA_DIR, `cb-questions-${subject}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`[${subject}] No questions file found`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const conceptCount = Object.keys(data).length;
    let questionCount = 0;
    let subjectIssues = [];

    for (const [conceptId, questions] of Object.entries(data)) {
      if (!Array.isArray(questions)) {
        subjectIssues.push(`${conceptId}: questions is not an array`);
        continue;
      }

      questionCount += questions.length;

      for (const q of questions) {
        // Check choices
        if (!q.choices) {
          stats.issues.missingChoices++;
          subjectIssues.push(`${conceptId} Q${q.id}: missing choices`);
        } else if (q.choices.length !== 4) {
          stats.issues.wrongChoiceCount++;
          subjectIssues.push(`${conceptId} Q${q.id}: has ${q.choices.length} choices (expected 4)`);
        }

        // Check answer
        if (!q.answer) {
          stats.issues.missingAnswer++;
          subjectIssues.push(`${conceptId} Q${q.id}: missing answer`);
        } else if (!['A', 'B', 'C', 'D'].includes(q.answer.toUpperCase().charAt(0))) {
          stats.issues.invalidAnswer++;
          subjectIssues.push(`${conceptId} Q${q.id}: invalid answer "${q.answer}"`);
        }

        // Check explanation
        if (!q.explanation || q.explanation.length < 10) {
          stats.issues.missingExplanation++;
        }

        // Check question text
        if (!q.question || q.question.length < 10) {
          stats.issues.emptyQuestion++;
          subjectIssues.push(`${conceptId} Q${q.id}: empty/short question`);
        }
      }
    }

    stats.totalConcepts += conceptCount;
    stats.totalQuestions += questionCount;
    stats.bySubject[subject] = {
      concepts: conceptCount,
      questions: questionCount,
      avgPerConcept: conceptCount > 0 ? (questionCount / conceptCount).toFixed(1) : 0,
      issues: subjectIssues.length
    };

    console.log(`[${subject.toUpperCase()}] ${conceptCount} concepts, ${questionCount} questions (avg ${(questionCount/conceptCount).toFixed(1)}/concept)`);

    if (subjectIssues.length > 0 && subjectIssues.length <= 10) {
      subjectIssues.forEach(issue => console.log(`  ⚠️ ${issue}`));
    } else if (subjectIssues.length > 10) {
      console.log(`  ⚠️ ${subjectIssues.length} issues (showing first 5):`);
      subjectIssues.slice(0, 5).forEach(issue => console.log(`    ${issue}`));
    }
  }

  console.log('\n=== VALIDATION SUMMARY ===');
  console.log(`Total concepts: ${stats.totalConcepts}`);
  console.log(`Total questions: ${stats.totalQuestions}`);
  console.log(`Average per concept: ${(stats.totalQuestions / stats.totalConcepts).toFixed(1)}`);
  console.log('');
  console.log('Issues found:');
  console.log(`  Missing choices: ${stats.issues.missingChoices}`);
  console.log(`  Wrong choice count: ${stats.issues.wrongChoiceCount}`);
  console.log(`  Missing answer: ${stats.issues.missingAnswer}`);
  console.log(`  Invalid answer: ${stats.issues.invalidAnswer}`);
  console.log(`  Missing/short explanation: ${stats.issues.missingExplanation}`);
  console.log(`  Empty/short question: ${stats.issues.emptyQuestion}`);
  console.log('==========================');

  return stats;
}

// CLI
const args = process.argv.slice(2);
const subjectIdx = args.indexOf('--subject');
const targetSubject = subjectIdx !== -1 ? args[subjectIdx + 1] : null;

validateQuestions(targetSubject);
