#!/usr/bin/env python3
"""
패치 4: 누락 지문 복구 - PDF에서 지문 추출
"""

import json
import os
import time
import base64
import re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")

import google.generativeai as genai

BASE_DIR = Path(__file__).parent.parent
TESTS_JSON_DIR = BASE_DIR / "public/tests/json"
TESTS_RAW_DIR = BASE_DIR / "public/tests/raw"
AUDIT_FILE = BASE_DIR / "data/test_quality_audit.json"
LOG_FILE = BASE_DIR / "data/patch_passages_log.json"

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash-lite")

from patch_missing_answers import find_pdf_for_json

def extract_passages_from_pdf(pdf_path, question_numbers):
    """PDF에서 특정 문제들의 지문 추출"""
    with open(pdf_path, "rb") as f:
        pdf_data = base64.b64encode(f.read()).decode("utf-8")

    # 한 번에 최대 5문제 (지문은 길어서)
    q_list = ", ".join(str(n) for n in question_numbers[:5])

    prompt = f"""이 PDF에서 다음 문제들의 지문(본문/제시문)을 추출하세요: {q_list}

지문은 문제 앞에 있는 "다음 글을 읽고", "(가)", "[A]" 등으로 표시된 텍스트입니다.

JSON 배열로만 반환 (설명 없이):
[{{"question_number": N, "passage": "지문 전체 텍스트"}}]

규칙:
- 지문이 여러 단락이면 줄바꿈(\\n)으로 연결
- 시, 대화문 등 형식 유지
- 지문이 없으면 해당 문제 제외
- (가), (나) 등 구분자 포함"""

    try:
        response = model.generate_content([
            {"mime_type": "application/pdf", "data": pdf_data},
            prompt
        ])

        text = response.text.strip()
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1)

        # LaTeX 백슬래시 이스케이프
        text = re.sub(r'(?<!\\)\\([a-zA-Z])', r'\\\\\\1', text)

        results = json.loads(text)
        if not isinstance(results, list):
            return None, "Invalid response type"

        valid = [r for r in results if isinstance(r, dict) and "question_number" in r and "passage" in r]
        return valid, None
    except Exception as e:
        return None, str(e)

def main():
    with open(AUDIT_FILE, "r", encoding="utf-8") as f:
        audit = json.load(f)

    files_to_patch = [f for f in audit["by_file"] if f["issues"]["passage_missing"]]
    print(f"지문 누락 파일: {len(files_to_patch)}개\n", flush=True)

    log = {"total": len(files_to_patch), "success": 0, "skipped": 0, "failed": 0, "details": []}

    for i, file_info in enumerate(files_to_patch):
        filename = file_info["file"]
        question_nums = file_info["issues"]["passage_missing"]
        json_path = TESTS_JSON_DIR / filename

        print(f"[{i+1}/{len(files_to_patch)}] {filename} ({len(question_nums)}개 문제)", flush=True)

        pdf_path = find_pdf_for_json(filename)
        if not pdf_path:
            print(f"  → PDF 없음, 스킵", flush=True)
            log["skipped"] += 1
            log["details"].append({"file": filename, "status": "skipped", "reason": "PDF not found"})
            continue

        # 배치로 처리 (5개씩)
        all_results = []
        for batch_start in range(0, len(question_nums), 5):
            batch = question_nums[batch_start:batch_start+5]
            print(f"  문제 {batch} 추출 중...", flush=True)
            results, error = extract_passages_from_pdf(pdf_path, batch)
            if results:
                all_results.extend(results)
            if error:
                print(f"    → 오류: {error[:50]}", flush=True)
            time.sleep(3)

        if not all_results:
            print(f"  → 추출 실패", flush=True)
            log["failed"] += 1
            log["details"].append({"file": filename, "status": "failed"})
            continue

        # JSON 업데이트
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        passage_map = {r["question_number"]: r["passage"] for r in all_results}
        updated = 0
        for q in data.get("questions", []):
            num = q.get("number")
            if num in passage_map:
                current = q.get("passage", "") or ""
                if len(current.strip()) < 10:
                    q["passage"] = passage_map[num]
                    updated += 1

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"  → {updated}개 지문 복구 완료", flush=True)
        log["success"] += 1
        log["details"].append({"file": filename, "status": "success", "updated": updated})

    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"\n완료: 성공 {log['success']}, 스킵 {log['skipped']}, 실패 {log['failed']}", flush=True)

if __name__ == "__main__":
    main()
