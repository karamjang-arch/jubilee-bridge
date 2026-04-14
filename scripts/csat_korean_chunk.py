#!/usr/bin/env python3
"""
국어 PDF 분할 처리 스크립트
- 문제를 청크(1-15, 16-30, 31-45)로 나눠 처리
- 결과 병합
"""

import json
import os
import sys
import time
import base64
import urllib.request
import urllib.error
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# lib 모듈 경로 추가
sys.path.insert(0, str(Path(__file__).parent))
from lib.config import load_gemini_api_key

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "public" / "tests" / "raw" / "korean"
OUTPUT_DIR = BASE_DIR / "public" / "tests" / "json"

GEMINI_API_KEY = load_gemini_api_key()
GEMINI_MODEL = "gemini-2.5-flash-lite"

# 처리할 파일
TARGET_FILES = [
    "수능-2022-국어-문제.pdf",
    "수능-2024-국어-문제.pdf",
    "수능-2025-국어-문제.pdf",
]

# 청크 범위
CHUNKS = [
    (1, 15),
    (16, 30),
    (31, 45),
]


def pdf_to_base64(pdf_path):
    with open(pdf_path, 'rb') as f:
        return base64.standard_b64encode(f.read()).decode('utf-8')


def fix_latex_escapes(s):
    valid_escapes = [
        (r'\\\\', '\x00DBL\x00'),
        (r'\\n', '\x00NL\x00'),
        (r'\\t', '\x00TAB\x00'),
        (r'\\r', '\x00CR\x00'),
        (r'\\"', '\x00QT\x00'),
        (r'\\/', '\x00SL\x00'),
    ]
    for pattern, token in valid_escapes:
        s = s.replace(pattern, token)
    s = s.replace('\\', '\\\\')
    for pattern, token in valid_escapes:
        s = s.replace(token, pattern)
    return s


def call_gemini_chunk(pdf_base64, year, start, end):
    """특정 문제 범위만 추출"""

    if GEMINI_MODEL != 'gemini-2.5-flash-lite':
        logger.error(f"⛔ 허용되지 않은 모델: {GEMINI_MODEL}")
        sys.exit(1)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    prompt = f"""이 PDF는 {year}학년도 대학수학능력시험 국어 문제지입니다.

**문제 {start}번부터 {end}번까지만** 추출하여 JSON으로 변환하세요.
다른 문제는 무시하세요.

JSON 형식:
{{
  "questions": [
    {{
      "number": {start},
      "question": "문제 내용",
      "passage": "지문이 있으면 여기에 (독서/문학 지문)",
      "choices": ["① ...", "② ...", "③ ...", "④ ...", "⑤ ..."],
      "answer": null,
      "skill": "핵심 역량"
    }}
  ]
}}

주의:
1. 문제 {start}~{end}번만 추출
2. 지문(passage)은 가능한 전문 포함
3. 지문이 너무 길면 핵심 부분만 포함하고 "[중략]" 표시
4. JSON만 출력 (다른 설명 없이)"""

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "application/pdf", "data": pdf_base64}}
            ]
        }],
        "generationConfig": {
            "maxOutputTokens": 8192,
            "temperature": 0.1
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode('utf-8'))

        text = result['candidates'][0]['content']['parts'][0]['text']
        text = text.strip()
        if text.startswith('```json'):
            text = text[7:]
        if text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
        text = text.strip()
        text = fix_latex_escapes(text)

        return json.loads(text)

    except urllib.error.HTTPError as e:
        if e.code in (429, 503):
            logger.warning(f"  HTTP {e.code} - 재시도 대기")
            time.sleep(5)
            return None
        raise
    except json.JSONDecodeError as e:
        logger.warning(f"  JSON 파싱 실패: {e}")
        return None


def process_korean_pdf(pdf_path):
    """국어 PDF를 청크로 나눠 처리"""
    filename = pdf_path.name
    year = int(filename.split('-')[1])

    logger.info(f"처리 중: {filename} (청크 분할)")

    pdf_base64 = pdf_to_base64(pdf_path)
    logger.info(f"  PDF 크기: {len(pdf_base64) // 1024}KB")

    all_questions = []

    for start, end in CHUNKS:
        logger.info(f"  청크 {start}-{end}번 처리 중...")

        result = call_gemini_chunk(pdf_base64, year, start, end)

        if result and 'questions' in result:
            questions = result['questions']
            all_questions.extend(questions)
            logger.info(f"    ✓ {len(questions)}문제 추출")
        else:
            logger.warning(f"    ✗ 실패")

        time.sleep(1)  # API 간격

    if not all_questions:
        return None

    # 문제 번호 정렬
    all_questions.sort(key=lambda x: x.get('number', 0))

    output = {
        "id": f"csat-{year}-국어",
        "name": f"{year}학년도 대학수학능력시험 국어",
        "source": "한국교육과정평가원",
        "type": "csat_exam",
        "testType": "csat",
        "year": year,
        "month": None,
        "subject": "국어",
        "questions": all_questions
    }

    return output


def main():
    logger.info("=" * 60)
    logger.info("국어 PDF 분할 처리 시작")
    logger.info(f"모델: {GEMINI_MODEL}")
    logger.info(f"대상: {len(TARGET_FILES)}개")
    logger.info("=" * 60)

    success = 0

    for filename in TARGET_FILES:
        pdf_path = RAW_DIR / filename

        if not pdf_path.exists():
            logger.warning(f"파일 없음: {filename}")
            continue

        result = process_korean_pdf(pdf_path)

        if result:
            output_path = OUTPUT_DIR / f"{result['id']}.json"
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            logger.info(f"  ✓ 저장: {output_path.name} ({len(result['questions'])}문제)")
            success += 1
        else:
            logger.error(f"  ✗ 실패: {filename}")

        time.sleep(2)

    logger.info("=" * 60)
    logger.info(f"완료: {success}/{len(TARGET_FILES)} 성공")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
