#!/usr/bin/env python3
"""
수능-2025-국어 전용 - 5문제씩 초소형 청크
"""

import json
import sys
import time
import base64
import urllib.request
import urllib.error
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
PDF_PATH = BASE_DIR / "public/tests/raw/korean/수능-2025-국어-문제.pdf"
OUTPUT_PATH = BASE_DIR / "public/tests/json/csat-2025-국어.json"

GEMINI_API_KEY = "AIzaSyDUiCcoHc-Nc4an3TGJLROvwNJJz1X15ak"
GEMINI_MODEL = "gemini-2.5-flash-lite"

# 5문제씩 9개 청크
CHUNKS = [(i, min(i+4, 45)) for i in range(1, 46, 5)]


def pdf_to_base64(path):
    with open(path, 'rb') as f:
        return base64.standard_b64encode(f.read()).decode('utf-8')


def fix_escapes(s):
    for old, new in [(r'\\\\', '\x00A\x00'), (r'\\n', '\x00B\x00'), (r'\\t', '\x00C\x00'), (r'\\"', '\x00D\x00')]:
        s = s.replace(old, new)
    s = s.replace('\\', '\\\\')
    for old, new in [(r'\\\\', '\x00A\x00'), (r'\\n', '\x00B\x00'), (r'\\t', '\x00C\x00'), (r'\\"', '\x00D\x00')]:
        s = s.replace(new, old)
    return s


def call_gemini(pdf_b64, start, end):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    prompt = f"""2025학년도 수능 국어 문제지입니다.
**{start}번~{end}번 문제만** 추출하세요.

JSON 형식:
{{"questions": [{{"number": {start}, "question": "...", "passage": "지문(있으면, 핵심만)", "choices": ["①...", "②...", "③...", "④...", "⑤..."], "answer": null, "skill": "..."}}]}}

- 지문이 길면 [중략] 사용하여 핵심만
- JSON만 출력"""

    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": "application/pdf", "data": pdf_b64}}]}],
        "generationConfig": {"maxOutputTokens": 4096, "temperature": 0.1}
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.loads(resp.read().decode())
        text = result['candidates'][0]['content']['parts'][0]['text'].strip()
        if text.startswith('```json'): text = text[7:]
        if text.startswith('```'): text = text[3:]
        if text.endswith('```'): text = text[:-3]
        return json.loads(fix_escapes(text.strip()))
    except Exception as e:
        logger.warning(f"  실패: {e}")
        return None


def main():
    logger.info("=" * 50)
    logger.info("수능-2025-국어 초소형 청크 처리")
    logger.info("=" * 50)

    pdf_b64 = pdf_to_base64(PDF_PATH)
    logger.info(f"PDF: {len(pdf_b64)//1024}KB")

    all_q = []

    for start, end in CHUNKS:
        logger.info(f"  [{start}-{end}] 처리 중...")
        result = call_gemini(pdf_b64, start, end)
        if result and 'questions' in result:
            all_q.extend(result['questions'])
            logger.info(f"    ✓ {len(result['questions'])}문제")
        else:
            logger.warning(f"    ✗ 실패")
        time.sleep(1.5)

    if all_q:
        all_q.sort(key=lambda x: x.get('number', 0))
        output = {
            "id": "csat-2025-국어",
            "name": "2025학년도 대학수학능력시험 국어",
            "source": "한국교육과정평가원",
            "type": "csat_exam",
            "testType": "csat",
            "year": 2025,
            "subject": "국어",
            "questions": all_q
        }
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        logger.info(f"✓ 저장: {len(all_q)}문제")
    else:
        logger.error("✗ 모든 청크 실패")

    logger.info("=" * 50)


if __name__ == "__main__":
    main()
