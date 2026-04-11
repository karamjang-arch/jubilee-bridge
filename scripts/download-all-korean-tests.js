#!/usr/bin/env node
/**
 * 한국 시험 PDF 종합 다운로드
 *
 * 1. 교육청 모의고사 (horaeng.com) - 이미 완료
 * 2. 평가원 모의평가 6월/9월 (horaeng.com)
 * 3. 수능 본시험 기출 (horaeng.com)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const RAW_DIR = path.join(__dirname, '../public/tests/raw/korean');

if (!fs.existsSync(RAW_DIR)) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const encodedUrl = encodeURI(url);
    const file = fs.createWriteStream(destPath);

    https.get(encodedUrl, (response) => {
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
        // Check if it's a valid PDF
        const header = fs.readFileSync(destPath, { encoding: 'utf8', flag: 'r' }).substring(0, 10);
        if (!header.startsWith('%PDF')) {
          fs.unlinkSync(destPath);
          reject(new Error('Not a valid PDF'));
        } else {
          resolve(true);
        }
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

// URL patterns based on horaeng.com structure
const URL_PATTERNS = {
  // 평가원 6월 모의평가
  june_mock: (year, subject) => [
    `https://horaeng.com/wp-content/uploads/${year}년-6월-모의평가-${subject}-문제.pdf`,
    `https://horaeng.com/wp-content/uploads/${year}년-6월-모의고사-${subject}-문제.pdf`,
    `https://horaeng.com/wp-content/uploads/${year}학년도-6월-모의평가-${subject}-문제.pdf`,
  ],

  // 평가원 9월 모의평가
  sept_mock: (year, subject) => [
    `https://horaeng.com/wp-content/uploads/${year}년-9월-모의평가-${subject}-문제.pdf`,
    `https://horaeng.com/wp-content/uploads/${year}년-9월-모의고사-${subject}-문제.pdf`,
    `https://horaeng.com/wp-content/uploads/${year}학년도-9월-모의평가-${subject}-문제.pdf`,
  ],

  // 수능 본시험
  csat: (year, subject) => [
    `https://horaeng.com/wp-content/uploads/${year}학년도-수능-${subject}-문제.pdf`,
    `https://horaeng.com/wp-content/uploads/${year}년-수능-${subject}-문제.pdf`,
    `https://horaeng.com/wp-content/uploads/${year}학년도-대학수학능력시험-${subject}-문제.pdf`,
  ],
};

const YEARS = ['2020', '2021', '2022', '2023', '2024', '2025'];
const SUBJECTS = ['국어', '수학', '영어'];

async function tryDownload(urls, destPath) {
  for (const url of urls) {
    try {
      await downloadFile(url, destPath);
      return { success: true, url };
    } catch (e) {
      // Try next URL
    }
  }
  return { success: false };
}

async function downloadMockExams() {
  console.log('\n=== 평가원 6월/9월 모의평가 다운로드 ===\n');

  let downloaded = 0;
  let failed = 0;

  for (const year of YEARS) {
    for (const subject of SUBJECTS) {
      // 6월 모의평가
      const juneFile = `평가원-${year}-6월-${subject}-문제.pdf`;
      const junePath = path.join(RAW_DIR, juneFile);

      if (!fs.existsSync(junePath)) {
        const urls = URL_PATTERNS.june_mock(year, subject);
        console.log(`시도: ${juneFile}`);
        const result = await tryDownload(urls, junePath);
        if (result.success) {
          console.log(`  ✓ 성공`);
          downloaded++;
        } else {
          console.log(`  ✗ 실패`);
          failed++;
        }
      }

      // 9월 모의평가
      const septFile = `평가원-${year}-9월-${subject}-문제.pdf`;
      const septPath = path.join(RAW_DIR, septFile);

      if (!fs.existsSync(septPath)) {
        const urls = URL_PATTERNS.sept_mock(year, subject);
        console.log(`시도: ${septFile}`);
        const result = await tryDownload(urls, septPath);
        if (result.success) {
          console.log(`  ✓ 성공`);
          downloaded++;
        } else {
          console.log(`  ✗ 실패`);
          failed++;
        }
      }

      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log(`\n평가원 모의평가: 성공 ${downloaded}, 실패 ${failed}`);
  return { downloaded, failed };
}

async function downloadCSAT() {
  console.log('\n=== 수능 본시험 기출 다운로드 ===\n');

  let downloaded = 0;
  let failed = 0;

  for (const year of YEARS) {
    for (const subject of SUBJECTS) {
      const file = `수능-${year}-${subject}-문제.pdf`;
      const filePath = path.join(RAW_DIR, file);

      if (!fs.existsSync(filePath)) {
        const urls = URL_PATTERNS.csat(year, subject);
        console.log(`시도: ${file}`);
        const result = await tryDownload(urls, filePath);
        if (result.success) {
          console.log(`  ✓ 성공`);
          downloaded++;
        } else {
          console.log(`  ✗ 실패`);
          failed++;
        }
      }

      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log(`\n수능 기출: 성공 ${downloaded}, 실패 ${failed}`);
  return { downloaded, failed };
}

async function main() {
  console.log('=== 한국 시험 PDF 종합 다운로드 ===');

  const mockResult = await downloadMockExams();
  const csatResult = await downloadCSAT();

  console.log('\n=== 전체 결과 ===');
  console.log(`총 다운로드: ${mockResult.downloaded + csatResult.downloaded}`);
  console.log(`총 실패: ${mockResult.failed + csatResult.failed}`);

  // List all files
  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`\n총 PDF 파일: ${files.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
