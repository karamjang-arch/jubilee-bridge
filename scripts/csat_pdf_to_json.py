#!/usr/bin/env python3
"""
수능/평가원 PDF → JSON 변환 스크립트
- Gemini 2.5-flash-lite 사용 (무료)
- 배치 사이즈 1, max_output_tokens=16384
- 503/429 스킵 로직
"""

import json
import os
import sys
import time
import re
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

# 경로 설정
BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "public" / "tests" / "raw" / "korean"
OUTPUT_DIR = BASE_DIR / "public" / "tests" / "json"
CHECKPOINT_PATH = BASE_DIR / "scripts" / ".csat_checkpoint.json"

# Gemini 설정
GEMINI_API_KEY = load_gemini_api_key()
GEMINI_MODEL = "gemini-2.5-flash-lite"
MAX_OUTPUT_TOKENS = 16384
SLEEP_INTERVAL = 1.0  # 1초 간격


def parse_filename(filename):
    """파일명에서 메타데이터 추출"""
    # 수능-2025-국어-문제.pdf
    # 평가원-2024-9월-국어-문제.pdf

    name = filename.replace('.pdf', '')
    parts = name.split('-')

    if parts[0] == '수능':
        return {
            'test_type': 'csat',
            'test_type_ko': '수능',
            'year': int(parts[1]),
            'month': None,
            'subject': parts[2]
        }
    elif parts[0] == '평가원':
        return {
            'test_type': 'mock',
            'test_type_ko': '평가원 모의평가',
            'year': int(parts[1]),
            'month': parts[2].replace('월', ''),
            'subject': parts[3]
        }
    return None


def load_checkpoint():
    """체크포인트 로드"""
    if not CHECKPOINT_PATH.exists():
        return set()
    with open(CHECKPOINT_PATH, 'r') as f:
        data = json.load(f)
    return set(data.get('processed', []))


def save_checkpoint(processed):
    """체크포인트 저장"""
    with open(CHECKPOINT_PATH, 'w') as f:
        json.dump({'processed': list(processed), 'saved_at': datetime.now().isoformat()}, f)


def pdf_to_base64(pdf_path):
    """PDF 파일을 base64로 인코딩"""
    with open(pdf_path, 'rb') as f:
        return base64.standard_b64encode(f.read()).decode('utf-8')


def call_gemini_with_pdf(pdf_base64, meta):
    """Gemini API로 PDF 분석"""

    # 금지된 모델 체크
    if GEMINI_MODEL in ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']:
        logger.error(f"⛔ 금지된 모델: {GEMINI_MODEL}")
        sys.exit(1)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    test_name = f"{meta['year']}학년도 "
    if meta['test_type'] == 'csat':
        test_name += f"대학수학능력시험 {meta['subject']}"
    else:
        test_name += f"{meta['month']}월 평가원 모의평가 {meta['subject']}"

    prompt = f"""이 PDF는 [{test_name}] 시험 문제지입니다.

모든 문제를 추출하여 다음 JSON 형식으로 변환하세요:

{{
  "questions": [
    {{
      "number": 1,
      "question": "문제 전문 (지문이 있으면 포함)",
      "passage": "긴 지문이 있는 경우 여기에 (국어 독서/문학, 영어 독해 등)",
      "choices": ["① 선택지1", "② 선택지2", "③ 선택지3", "④ 선택지4", "⑤ 선택지5"],
      "answer": null,
      "skill": "이 문제가 측정하는 핵심 역량"
    }}
  ]
}}

주의사항:
1. 모든 문제를 빠짐없이 추출
2. 지문(passage)이 있는 문제는 반드시 passage 필드에 전문 포함
3. 수학 수식은 LaTeX 형식으로 (예: $x^2 + y^2 = 1$)
4. 보기/조건이 있으면 question에 포함
5. answer는 PDF에 정답이 없으므로 null
6. skill은 한국어로 작성 (예: "어휘력", "추론적 이해", "함수의 극한")

JSON만 출력하세요. 다른 설명 없이."""

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {
                    "inline_data": {
                        "mime_type": "application/pdf",
                        "data": pdf_base64
                    }
                }
            ]
        }],
        "generationConfig": {
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
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

        # JSON 추출
        text = text.strip()
        if text.startswith('```json'):
            text = text[7:]
        if text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
        text = text.strip()

        # LaTeX 이스케이프 처리: \를 \\로 변환 (JSON 파싱 전)
        # 단, 이미 유효한 JSON 이스케이프(\n, \t, \", \\, \/)는 제외
        def fix_latex_escapes(s):
            import re
            # 유효한 JSON 이스케이프 시퀀스를 임시 토큰으로 대체
            valid_escapes = [
                (r'\\\\', '\x00DOUBLE_BACKSLASH\x00'),
                (r'\\n', '\x00NEWLINE\x00'),
                (r'\\t', '\x00TAB\x00'),
                (r'\\r', '\x00CR\x00'),
                (r'\\"', '\x00QUOTE\x00'),
                (r'\\/', '\x00SLASH\x00'),
                (r'\\b', '\x00BACKSPACE\x00'),
                (r'\\f', '\x00FORMFEED\x00'),
            ]
            for pattern, token in valid_escapes:
                s = s.replace(pattern, token)

            # 남은 백슬래시를 이중 백슬래시로 변환
            s = s.replace('\\', '\\\\')

            # 임시 토큰을 원래 이스케이프로 복원
            for pattern, token in valid_escapes:
                s = s.replace(token, pattern)

            return s

        text = fix_latex_escapes(text)

        return json.loads(text)

    except urllib.error.HTTPError as e:
        if e.code in (429, 503):
            logger.warning(f"  HTTP {e.code} - 스킵")
            return None
        raise
    except json.JSONDecodeError as e:
        logger.warning(f"  JSON 파싱 실패: {e}")
        # 디버그용: 실패한 텍스트 저장
        debug_path = BASE_DIR / "scripts" / f".debug_json_error_{datetime.now().strftime('%H%M%S')}.txt"
        with open(debug_path, 'w') as f:
            f.write(text[:5000])
        logger.warning(f"  디버그 파일: {debug_path}")
        return None


def process_pdf(pdf_path, meta):
    """단일 PDF 처리"""
    logger.info(f"처리 중: {pdf_path.name}")

    # PDF를 base64로 인코딩
    pdf_base64 = pdf_to_base64(pdf_path)
    logger.info(f"  PDF 크기: {len(pdf_base64) // 1024}KB (base64)")

    # Gemini 호출
    result = call_gemini_with_pdf(pdf_base64, meta)

    if not result:
        return None

    # 메타데이터 추가
    if meta['test_type'] == 'csat':
        test_id = f"csat-{meta['year']}-{meta['subject']}"
        test_name = f"{meta['year']}학년도 대학수학능력시험 {meta['subject']}"
    else:
        test_id = f"mock-{meta['year']}-{meta['month']}-{meta['subject']}"
        test_name = f"{meta['year']}학년도 {meta['month']}월 평가원 모의평가 {meta['subject']}"

    output = {
        "id": test_id,
        "name": test_name,
        "source": "한국교육과정평가원",
        "type": f"{meta['test_type']}_exam",
        "testType": meta['test_type'],
        "year": meta['year'],
        "month": meta.get('month'),
        "subject": meta['subject'],
        "questions": result.get('questions', [])
    }

    return output


def main():
    logger.info("=" * 60)
    logger.info("수능/평가원 PDF → JSON 변환 시작")
    logger.info(f"모델: {GEMINI_MODEL}")
    logger.info("=" * 60)

    # 모델 확인
    if GEMINI_MODEL != 'gemini-2.5-flash-lite':
        logger.error(f"⛔ 허용되지 않은 모델: {GEMINI_MODEL}")
        logger.error("gemini-2.5-flash-lite만 허용됩니다.")
        sys.exit(1)

    # PDF 목록
    pdfs = []
    for pdf in sorted(RAW_DIR.glob("수능-*.pdf")):
        if '해설' not in pdf.name:
            meta = parse_filename(pdf.name)
            if meta:
                pdfs.append((pdf, meta))

    for pdf in sorted(RAW_DIR.glob("평가원-*.pdf")):
        if '해설' not in pdf.name:
            meta = parse_filename(pdf.name)
            if meta:
                pdfs.append((pdf, meta))

    logger.info(f"발견된 PDF: {len(pdfs)}개")

    # 체크포인트 로드
    processed = load_checkpoint()
    logger.info(f"이미 처리됨: {len(processed)}개")

    # 처리할 목록
    to_process = [(p, m) for p, m in pdfs if p.name not in processed]
    logger.info(f"처리할 PDF: {len(to_process)}개")
    logger.info("-" * 60)

    if not to_process:
        logger.info("처리할 PDF가 없습니다.")
        return

    success_count = 0
    skip_count = 0

    for i, (pdf_path, meta) in enumerate(to_process):
        logger.info(f"[{i+1}/{len(to_process)}] {pdf_path.name}")

        try:
            result = process_pdf(pdf_path, meta)

            if result:
                # JSON 저장
                output_path = OUTPUT_DIR / f"{result['id']}.json"
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)

                logger.info(f"  ✓ 저장: {output_path.name} ({len(result['questions'])}문제)")
                success_count += 1
            else:
                skip_count += 1

            processed.add(pdf_path.name)
            save_checkpoint(processed)

            time.sleep(SLEEP_INTERVAL)

        except KeyboardInterrupt:
            logger.info("\n중단됨. 체크포인트 저장...")
            save_checkpoint(processed)
            sys.exit(0)

        except Exception as e:
            logger.error(f"  ✗ 오류: {e}")
            skip_count += 1
            processed.add(pdf_path.name)

    save_checkpoint(processed)

    logger.info("=" * 60)
    logger.info(f"완료: {success_count}개 성공, {skip_count}개 스킵")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
