/**
 * 설정 파일에서 API 키 로드
 * config.yaml 또는 환경변수에서 Gemini API 키 가져오기
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function loadGeminiApiKey() {
  // 1. 환경변수 우선
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  // 2. config.yaml 확인
  const configPaths = [
    path.join(__dirname, '../../config.yaml'),  // jubilee-bridge/config.yaml
    path.join(process.env.HOME, 'config.yaml'), // ~/config.yaml
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(content);
        if (config && config.gemini_api_key) {
          return config.gemini_api_key;
        }
      }
    } catch (err) {
      // 파일 읽기 실패 시 다음 경로 시도
    }
  }

  console.error('Error: GEMINI_API_KEY not found.');
  console.error('Set via:');
  console.error('  1) GEMINI_API_KEY env var');
  console.error('  2) config.yaml with gemini_api_key field');
  process.exit(1);
}

module.exports = { loadGeminiApiKey };
