#!/usr/bin/env node
/**
 * 검정고시 PDF 다운로드
 *
 * 사이트: https://www.gumsi.or.kr/ged/usr/data/prevexamList.do
 * 구조: 목록 → 상세페이지 → 첨부파일 다운로드
 * 필터: 2020-2025, 고졸/중졸, 핵심 과목
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DOWNLOAD_DIR = path.join(__dirname, '../public/tests/raw/ged');

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// 필터 설정
const TARGET_YEARS = ['2025', '2024', '2023', '2022', '2021', '2020'];
const TARGET_SUBJECTS = ['국어', '영어', '수학', '사회', '과학', '한국사', '도덕'];
const SKIP_SUBJECTS = ['미술', '음악', '체육', '기술', '가정', '정답', '대비연습'];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldDownload(item) {
  const subject = item.title || '';
  const year = item.year || '';

  // Check if subject is a target
  const hasTargetSubject = TARGET_SUBJECTS.some(s => subject.includes(s));
  const hasSkipSubject = SKIP_SUBJECTS.some(s => subject.includes(s));

  // Check year
  const hasTargetYear = TARGET_YEARS.includes(year);

  return hasTargetSubject && !hasSkipSubject && hasTargetYear;
}

function generateFilename(item) {
  // Use structured data from item
  let level = 'unknown';
  if (item.level.includes('고졸')) level = 'high';
  else if (item.level.includes('중졸')) level = 'mid';

  const year = item.year || 'unknown';

  let round = '1';
  if (item.round.includes('2차')) round = '2';

  const subject = item.title || 'unknown';

  return `ged-${level}-${year}-${round}-${subject}.pdf`;
}

async function downloadGED() {
  console.log('=== 검정고시 PDF 다운로드 ===\n');
  console.log(`대상 연도: ${TARGET_YEARS.join(', ')}`);
  console.log(`대상 과목: ${TARGET_SUBJECTS.join(', ')}`);
  console.log(`제외 과목: ${SKIP_SUBJECTS.join(', ')}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set longer timeout
  page.setDefaultTimeout(30000);

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalPages = 1;
  let pageFn = 'fn_egov_link_page';

  try {
    // Go to list page
    console.log('목록 페이지 접속...');
    await page.goto('https://www.gumsi.or.kr/ged/usr/data/prevexamList.do', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for AJAX content to load
    console.log('AJAX 콘텐츠 로딩 대기...');
    await page.waitForSelector('a[onclick*="dtlView"]', { timeout: 15000 }).catch(() => {
      console.log('dtlView 링크 대기 중...');
    });
    await delay(3000);

    // Save screenshot for debugging
    await page.screenshot({ path: '/tmp/ged-list.png', fullPage: true });
    console.log('스크린샷 저장: /tmp/ged-list.png');

    // Get total pages and function name from pagination
    const paginationInfo = await page.evaluate(() => {
      // Find all links with onclick in pagination area
      const allLinks = document.querySelectorAll('a[onclick]');
      let maxPage = 1;
      let functionName = 'pageSearch';
      const allOnclicks = [];

      allLinks.forEach(link => {
        const onclick = link.getAttribute('onclick') || '';
        // Look for patterns like: fn_egov_link_page(5), pageSearch(5), goPage(5), etc
        const patterns = [
          /fn_egov_link_page\s*\(\s*['"]?(\d+)['"]?\s*\)/,
          /pageSearch\s*\(\s*['"]?(\d+)['"]?\s*\)/,
          /goPage\s*\(\s*['"]?(\d+)['"]?\s*\)/,
          /linkPage\s*\(\s*['"]?(\d+)['"]?\s*\)/,
        ];

        for (const pattern of patterns) {
          const match = onclick.match(pattern);
          if (match) {
            allOnclicks.push(onclick);
            const pageNum = parseInt(match[1]);
            if (pageNum > maxPage) {
              maxPage = pageNum;
              // Extract function name
              const fnMatch = onclick.match(/(\w+)\s*\(/);
              if (fnMatch) functionName = fnMatch[1];
            }
          }
        }
      });

      return { maxPage, functionName, sampleOnclicks: allOnclicks.slice(0, 5) };
    });

    console.log('페이지네이션 감지:', paginationInfo);
    pageFn = paginationInfo.functionName || 'fn_egov_link_page';
    totalPages = Math.max(paginationInfo.maxPage, 59); // At least 59 pages as user reported
    console.log(`총 페이지: ${totalPages}\n`);

    // Process each page
    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      console.log(`\n===== 페이지 ${currentPage}/${totalPages} =====`);

      // Navigate to page if not first
      if (currentPage > 1) {
        await page.evaluate((pageNum, fnName) => {
          // Try various function names
          if (typeof window[fnName] === 'function') {
            window[fnName](pageNum);
          } else if (typeof fn_egov_link_page === 'function') {
            fn_egov_link_page(pageNum);
          } else if (typeof pageSearch === 'function') {
            pageSearch(pageNum);
          } else if (typeof goPage === 'function') {
            goPage(pageNum);
          }
        }, currentPage, pageFn);
        await delay(3000);
      }

      // Get all items on current page
      const items = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('a[onclick*="dtlView"]').forEach(a => {
          const onclick = a.getAttribute('onclick') || '';
          const match = onclick.match(/dtlView\s*\(\s*['"]?(\d+)['"]?/);
          if (match) {
            // Get parent li element (not tr - this site uses li.list__item)
            const li = a.closest('li.list__item') || a.closest('li');
            const rowText = li ? li.textContent.trim() : '';

            // Extract data from row text
            let level = '';
            if (rowText.includes('고졸')) level = '고졸';
            else if (rowText.includes('중졸')) level = '중졸';

            let round = '1차';
            if (rowText.includes('2차')) round = '2차';

            // Extract date pattern YYYY-MM-DD from row text
            const dateMatch = rowText.match(/(\d{4})-(\d{2})-(\d{2})/);
            const date = dateMatch ? dateMatch[0] : '';
            const year = dateMatch ? dateMatch[1] : '';

            const subject = a.textContent.trim();

            results.push({
              seqNo: match[1],
              title: subject,
              level: level,
              round: round,
              date: date,
              year: year,
              rowText: rowText.substring(0, 200)
            });
          }
        });
        return results;
      });

      console.log(`항목: ${items.length}개`);

      // Debug: show first few items
      if (currentPage === 1) {
        console.log('\n샘플 항목:');
        for (let i = 0; i < Math.min(3, items.length); i++) {
          const item = items[i];
          console.log(`  ${i+1}. ${item.title} [${item.year}년 ${item.level} ${item.round}]`);
          console.log(`     rowText: ${item.rowText}`);
        }

      }

      // Process each item
      for (const item of items) {
        // Check if we should download this item
        if (!shouldDownload(item)) {
          totalSkipped++;
          // Debug first few skips
          if (totalSkipped <= 5) {
            console.log(`  [스킵] ${item.title} (${item.year}년 ${item.level} ${item.round})`);
          }
          continue;
        }

        console.log(`\n처리: ${item.title} (${item.year}년 ${item.level} ${item.round})`);

        // Generate filename
        const filename = generateFilename(item);
        const filepath = path.join(DOWNLOAD_DIR, filename);

        // Skip if already exists
        if (fs.existsSync(filepath)) {
          console.log(`  [존재] ${filename}`);
          continue;
        }

        // Click on the item to go to detail page
        try {
          // Find the link element with this seqNo
          const linkSelector = `a[onclick*="dtlView(${item.seqNo}"]`;

          // Use Promise.all to wait for navigation after click
          const [response] = await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null),
            page.click(linkSelector).catch(async () => {
              // If click fails, try evaluating the function directly
              await page.evaluate((seqNo) => {
                if (typeof dtlView === 'function') {
                  dtlView(seqNo, '');
                }
              }, item.seqNo);
            }),
          ]);

          await delay(2000);

          // Wait for detail page content to load
          await page.waitForSelector('.view__detail, .view_tbl, .board_view, .attach_file, a[onclick*="fileDown"]', { timeout: 10000 }).catch(() => {});

          // Debug: Save screenshot of detail page
          await page.screenshot({ path: '/tmp/ged-detail.png', fullPage: true });
          console.log(`  현재 URL: ${page.url()}`);

          // Find PDF download links on detail page
          const fileLinks = await page.evaluate(() => {
            const files = [];

            // Look for file download links - specifically atchflDl pattern
            document.querySelectorAll('a[onclick*="atchflDl"]').forEach(a => {
              const onclick = a.getAttribute('onclick') || '';
              const text = a.textContent.trim();

              // Extract file ID from atchflDl(fileId, seq)
              const match = onclick.match(/atchflDl\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
              if (match && text.toLowerCase().includes('.pdf')) {
                files.push({
                  text: text,
                  onclick: onclick,
                  fileId: match[1],
                  fileSeq: match[2]
                });
              }
            });

            // Also check other patterns as fallback
            if (files.length === 0) {
              document.querySelectorAll('a[onclick*="fileDown"], a[href*="FileDown"]').forEach(a => {
                const onclick = a.getAttribute('onclick') || '';
                const href = a.getAttribute('href') || '';
                const text = a.textContent.trim();

                if (text.toLowerCase().includes('.pdf')) {
                  const idMatch = (onclick + href).match(/(?:fileId|atchFileId)[='"]\s*(\d+)/);
                  files.push({
                    text: text,
                    onclick: onclick,
                    href: href,
                    fileId: idMatch ? idMatch[1] : ''
                  });
                }
              });
            }

            return files;
          });

          console.log(`  첨부파일: ${fileLinks.length}개`);

          // Debug first item's file links
          if (fileLinks.length === 0) {
            const debugLinks = await page.evaluate(() => {
              const allLinks = document.querySelectorAll('a');
              const linkInfo = [];
              allLinks.forEach(a => {
                const href = a.getAttribute('href') || '';
                const onclick = a.getAttribute('onclick') || '';
                const text = a.textContent.trim();
                if (text.includes('다운') || text.includes('pdf') || text.includes('PDF') ||
                    href.includes('download') || href.includes('file') ||
                    onclick.includes('download') || onclick.includes('file')) {
                  linkInfo.push({ text: text.substring(0, 50), href: href.substring(0, 80), onclick: onclick.substring(0, 80) });
                }
              });
              return linkInfo.slice(0, 5);
            });
            console.log(`  파일 링크 디버그:`, JSON.stringify(debugLinks));
          }

          // Download first PDF file
          if (fileLinks.length > 0) {
            const file = fileLinks[0]; // Only get first PDF (문제지)
            console.log(`  다운로드: ${file.text}`);

            try {
              // Call atchflDl function and intercept the download
              // First, set up download behavior using CDP
              const client = await page.target().createCDPSession();
              await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: DOWNLOAD_DIR
              });

              // Trigger the download by calling the function
              await page.evaluate((fileId, fileSeq) => {
                if (typeof atchflDl === 'function') {
                  atchflDl(fileId, fileSeq);
                }
              }, file.fileId, file.fileSeq || 1);

              // Wait for download to complete
              await delay(5000);

              // Check if file was downloaded
              const downloadedFiles = fs.readdirSync(DOWNLOAD_DIR).filter(f =>
                f.includes(file.fileId) || f.includes('문제')
              );

              if (downloadedFiles.length > 0) {
                // Rename to our naming convention
                const downloadedFile = downloadedFiles[downloadedFiles.length - 1];
                const srcPath = path.join(DOWNLOAD_DIR, downloadedFile);
                if (fs.existsSync(srcPath) && !fs.existsSync(filepath)) {
                  fs.renameSync(srcPath, filepath);
                  console.log(`    저장: ${filename}`);
                  totalDownloaded++;
                }
              } else {
                // Try alternate method: construct download URL
                const downloadUrl = `https://www.gumsi.or.kr/cmm/fms/AtchFileDown.do?atchFileId=${file.fileId}&fileSn=${file.fileSeq || 1}`;
                console.log(`    직접 다운로드 시도: ${downloadUrl}`);

                const fileData = await page.evaluate(async (url) => {
                  try {
                    const response = await fetch(url, {
                      credentials: 'include',
                      headers: { 'Accept': 'application/pdf,*/*' }
                    });
                    if (!response.ok) return { error: `HTTP ${response.status}` };
                    const blob = await response.blob();
                    const reader = new FileReader();
                    return new Promise(resolve => {
                      reader.onloadend = () => resolve({
                        data: reader.result,
                        size: blob.size
                      });
                      reader.readAsDataURL(blob);
                    });
                  } catch (e) {
                    return { error: e.message };
                  }
                }, downloadUrl);

                if (fileData.data && fileData.size > 1000) {
                  const base64 = fileData.data.split(',')[1];
                  const buffer = Buffer.from(base64, 'base64');
                  const header = buffer.toString('utf8', 0, 5);
                  if (header.includes('%PDF')) {
                    fs.writeFileSync(filepath, buffer);
                    console.log(`    저장: ${filename} (${Math.round(fileData.size/1024)}KB)`);
                    totalDownloaded++;
                  }
                }
              }
            } catch (e) {
              console.log(`    다운로드 에러: ${e.message}`);
            }
          }

          // Go back to list
          await page.goBack({ waitUntil: 'networkidle2' }).catch(() => {});
          await delay(1500);

          // Re-navigate to current page if needed
          if (currentPage > 1) {
            await page.evaluate((pageNum, fnName) => {
              if (typeof window[fnName] === 'function') window[fnName](pageNum);
              else if (typeof fn_egov_link_page === 'function') fn_egov_link_page(pageNum);
            }, currentPage, pageFn);
            await delay(2000);
          }

        } catch (e) {
          console.log(`  처리 에러: ${e.message}`);
          // Try to recover by going back to list
          await page.goto('https://www.gumsi.or.kr/ged/usr/data/prevexamList.do', {
            waitUntil: 'networkidle2'
          }).catch(() => {});
          await delay(2000);

          if (currentPage > 1) {
            await page.evaluate((pageNum, fnName) => {
              if (typeof window[fnName] === 'function') window[fnName](pageNum);
              else if (typeof fn_egov_link_page === 'function') fn_egov_link_page(pageNum);
            }, currentPage, pageFn);
            await delay(2000);
          }
        }
      }

      // Break early if we've gone past 2020 items (optimization)
      const hasOldItems = items.some(item => {
        const year = parseInt(item.year);
        return year > 0 && year < 2020;
      });
      if (hasOldItems) {
        console.log('\n2019년 이전 항목 발견 - 종료');
        break;
      }
    }

  } catch (error) {
    console.error('\n전체 오류:', error.message);
    await page.screenshot({ path: '/tmp/ged-error.png', fullPage: true });
  } finally {
    await browser.close();
  }

  console.log(`\n========== 완료 ==========`);
  console.log(`다운로드: ${totalDownloaded}개`);
  console.log(`스킵: ${totalSkipped}개`);

  const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`저장된 PDF: ${files.length}개`);

  return totalDownloaded;
}

async function main() {
  await downloadGED();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
