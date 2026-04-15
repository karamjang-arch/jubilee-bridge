#!/usr/bin/env python3
"""
패치 3: 빈 선택지 복구 - PDF에서 선택지 추출
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
LOG_FILE = BASE_DIR / "data/patch_choices_log.json"

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash-lite")

# patch_missing_answers.py에서 find_pdf_for_json 함수 재사용
from patch_missing_answers import find_pdf_for_json

def extract_choices_from_pdf(pdf_path, question_numbers):
    """PDF에서 특정 문제들의 선택지 추출"""
    with open(pdf_path, "rb") as f:
        pdf_data = base64.b64encode(f.read()).decode("utf-8")

    q_list = ", ".join(str(n) for n in question_numbers[:10])  # 한 번에 최대 10문제

    prompt = f"""이 PDF에서 다음 문제들의 선택지를 추출하세요: {q_list}

JSON 배열로만 반환 (설명 없이):
[{{"question_number": N, "choices": ["① ...", "② ...", "③ ...", "④ ...", "⑤ ..."]}}]

규칙:
- 선택지 번호(①②③④⑤)는 그대로 유지
- 수학 수식이 있으면 원본 그대로 (LaTeX 변환하지 말 것)
- 찾을 수 없는 문제는 제외"""

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

        results = json.loads(text)
        if not isinstance(results, list):
            return None, "Invalid response type"

        valid = [r for r in results if isinstance(r, dict) and "question_number" in r and "choices" in r]
        return valid, None
    except Exception as e:
        return None, str(e)

def main():
    with open(AUDIT_FILE, "r", encoding="utf-8") as f:
        audit = json.load(f)

    files_to_patch = [f for f in audit["by_file"] if f["issues"]["empty_choices"]]
    print(f"선택지 누락 파일: {len(files_to_patch)}개\n")

    log = {"total": len(files_to_patch), "success": 0, "skipped": 0, "failed": 0, "details": []}

    for i, file_info in enumerate(files_to_patch):
        filename = file_info["file"]
        question_nums = file_info["issues"]["empty_choices"]
        json_path = TESTS_JSON_DIR / filename

        print(f"[{i+1}/{len(files_to_patch)}] {filename} ({len(question_nums)}개 문제)")

        pdf_path = find_pdf_for_json(filename)
        if not pdf_path:
            print(f"  → PDF 없음, 스킵")
            log["skipped"] += 1
            log["details"].append({"file": filename, "status": "skipped", "reason": "PDF not found"})
            continue

        # 배치로 처리 (10개씩)
        all_results = []
        for batch_start in range(0, len(question_nums), 10):
            batch = question_nums[batch_start:batch_start+10]
            results, error = extract_choices_from_pdf(pdf_path, batch)
            if results:
                all_results.extend(results)
            time.sleep(2)

        if not all_results:
            print(f"  → 추출 실패")
            log["failed"] += 1
            log["details"].append({"file": filename, "status": "failed"})
            continue

        # JSON 업데이트
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        choices_map = {r["question_number"]: r["choices"] for r in all_results}
        updated = 0
        for q in data.get("questions", []):
            num = q.get("number")
            if num in choices_map:
                current = q.get("choices", [])
                if not current or len([c for c in current if c]) <= 1:
                    q["choices"] = choices_map[num]
                    updated += 1

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"  → {updated}개 선택지 복구 완료")
        log["success"] += 1
        log["details"].append({"file": filename, "status": "success", "updated": updated})

    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"\n완료: 성공 {log['success']}, 스킵 {log['skipped']}, 실패 {log['failed']}")

if __name__ == "__main__":
    main()
