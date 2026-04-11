#!/usr/bin/env node
/**
 * 한국 시험 PDF 다운로드
 * - 교육청 모의고사 (horaeng.com)
 * - 고3 국어/수학/영어 2020-2025
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const RAW_DIR = path.join(__dirname, '../public/tests/raw/korean');

// Ensure directory exists
if (!fs.existsSync(RAW_DIR)) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

// 교육청 모의고사 시험 월
const EXAM_MONTHS = ['3', '6', '9', '11'];

// 과목
const SUBJECTS = ['국어', '수학', '영어'];

// 학년
const GRADES = ['고3'];

// 년도
const YEARS = ['2020', '2021', '2022', '2023', '2024', '2025'];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    // URL encode Korean characters
    const encodedUrl = encodeURI(url);

    const protocol = encodedUrl.startsWith('https') ? https : http;

    const file = fs.createWriteStream(destPath);

    protocol.get(encodedUrl, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

// Try multiple URL patterns
function getUrlPatterns(year, month, grade, subject, type) {
  return [
    // Pattern 1: 2025년-9월-고1-모의고사-국어-문제.pdf
    `https://horaeng.com/wp-content/uploads/${year}년-${month}월-${grade}-모의고사-${subject}-${type}.pdf`,
    // Pattern 2: 2026년-고3-3월-모의고사-국어-문제.pdf
    `https://horaeng.com/wp-content/uploads/${year}년-${grade}-${month}월-모의고사-${subject}-${type}.pdf`,
    // Pattern 3: 2024년-3월-고3-모의고사-국어-문제지.pdf (문제지 suffix)
    `https://horaeng.com/wp-content/uploads/${year}년-${month}월-${grade}-모의고사-${subject}-${type === '문제' ? '문제지' : type}.pdf`,
    // Pattern 4: 2024년-고3-3월-모의고사-국어-문제지.pdf
    `https://horaeng.com/wp-content/uploads/${year}년-${grade}-${month}월-모의고사-${subject}-${type === '문제' ? '문제지' : type}.pdf`,
  ];
}

async function tryDownload(urls, destPath) {
  for (const url of urls) {
    try {
      await downloadFile(url, destPath);
      // Check if it's a valid PDF
      const header = fs.readFileSync(destPath, { encoding: 'utf8', flag: 'r' }).substring(0, 10);
      if (header.startsWith('%PDF')) {
        return { success: true, url };
      }
      fs.unlinkSync(destPath);
    } catch (e) {
      // Try next pattern
    }
  }
  return { success: false };
}

async function downloadKoreanTests() {
  console.log('=== 한국 시험 PDF 다운로드 ===\n');

  let downloaded = 0;
  let failed = 0;

  for (const year of YEARS) {
    for (const grade of GRADES) {
      for (const month of EXAM_MONTHS) {
        for (const subject of SUBJECTS) {
          const baseFile = `${year}-${month}월-${grade}-${subject}`;

          // 문제 PDF
          const problemFile = `${baseFile}-문제.pdf`;
          const problemPath = path.join(RAW_DIR, problemFile);

          if (!fs.existsSync(problemPath)) {
            const urls = getUrlPatterns(year, month, grade, subject, '문제');
            console.log(`시도: ${problemFile}`);
            const result = await tryDownload(urls, problemPath);
            if (result.success) {
              console.log(`  ✓ 성공`);
              downloaded++;
            } else {
              console.log(`  ✗ 모든 패턴 실패`);
              failed++;
            }
          } else {
            console.log(`존재함: ${problemFile}`);
          }

          // 해설 PDF
          const answerFile = `${baseFile}-해설.pdf`;
          const answerPath = path.join(RAW_DIR, answerFile);

          if (!fs.existsSync(answerPath)) {
            const urls = getUrlPatterns(year, month, grade, subject, '해설');
            console.log(`시도: ${answerFile}`);
            const result = await tryDownload(urls, answerPath);
            if (result.success) {
              console.log(`  ✓ 성공`);
              downloaded++;
            } else {
              console.log(`  ✗ 모든 패턴 실패`);
              failed++;
            }
          } else {
            console.log(`존재함: ${answerFile}`);
          }

          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`다운로드 성공: ${downloaded}`);
  console.log(`실패: ${failed}`);

  // List downloaded files
  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`\n총 PDF 파일: ${files.length}`);

  return files.length;
}

downloadKoreanTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
