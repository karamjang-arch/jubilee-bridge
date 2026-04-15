#!/usr/bin/env python3
"""
패치 1: 정답 복구 - PDF에서 정답표 추출하여 JSON에 삽입
"""

import json
import os
import time
import base64
import re
from pathlib import Path
from dotenv import load_dotenv

# .env.local 로드
load_dotenv(Path(__file__).parent.parent / ".env.local")

import google.generativeai as genai

# 경로 설정
BASE_DIR = Path(__file__).parent.parent
TESTS_JSON_DIR = BASE_DIR / "public/tests/json"
TESTS_RAW_DIR = BASE_DIR / "public/tests/raw"
AUDIT_FILE = BASE_DIR / "data/test_quality_audit.json"
LOG_FILE = BASE_DIR / "data/patch_answers_log.json"

# Gemini 설정 (gemini-2.5-flash-lite 무료 한도 1,000 RPD)
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash-lite")

def find_pdf_for_json(json_filename):
    """JSON 파일명에 매칭되는 PDF 찾기"""
    # 파일명 패턴 분석
    name = json_filename.replace(".json", "")

    # 수능 (csat-YYYY-과목)
    if name.startswith("csat-"):
        parts = name.split("-")
        year = parts[1]
        subject = parts[2]
        # 수능-YYYY-과목-문제.pdf
        pdf_name = f"수능-{year}-{subject}-문제.pdf"
        pdf_path = TESTS_RAW_DIR / "korean" / pdf_name
        if pdf_path.exists():
            return pdf_path

    # 평가원 모의고사 (korean-pyeongwon-YYYY-M-과목)
    if name.startswith("korean-pyeongwon-"):
        parts = name.split("-")
        year = parts[2]
        month = parts[3]
        subject = parts[4]
        pdf_name = f"평가원-{year}-{month}월-{subject}-문제.pdf"
        pdf_path = TESTS_RAW_DIR / "korean" / pdf_name
        if pdf_path.exists():
            return pdf_path

    # 교육청 모의고사 (korean-YYYY-M-g3-과목 또는 mock-YYYY-M-과목)
    if name.startswith("korean-") and "-g3-" in name:
        parts = name.split("-")
        year = parts[1]
        month = parts[2]
        subject = parts[4]
        pdf_name = f"{year}-{month}월-고3-{subject}-문제.pdf"
        pdf_path = TESTS_RAW_DIR / "korean" / pdf_name
        if pdf_path.exists():
            return pdf_path

    if name.startswith("mock-"):
        parts = name.split("-")
        year = parts[1]
        month = parts[2]
        subject = parts[3]
        # 평가원 형식 먼저 시도
        pdf_name = f"평가원-{year}-{month}월-{subject}-문제.pdf"
        pdf_path = TESTS_RAW_DIR / "korean" / pdf_name
        if pdf_path.exists():
            return pdf_path
        # 교육청 형식 시도
        pdf_name = f"{year}-{month}월-고3-{subject}-문제.pdf"
        pdf_path = TESTS_RAW_DIR / "korean" / pdf_name
        if pdf_path.exists():
            return pdf_path

    # 검정고시 (ged-level-YYYY-회차-과목)
    if name.startswith("ged-"):
        parts = name.split("-")
        level = parts[1]  # high, mid, unknown
        year = parts[2]
        session = parts[3]  # 1 or 2
        subject = parts[4]
        pdf_name = f"ged-{level}-{year}-{session}-{subject}.pdf"
        pdf_path = TESTS_RAW_DIR / "ged" / pdf_name
        if pdf_path.exists():
            return pdf_path

    return None

def extract_answers_from_pdf(pdf_path):
    """PDF에서 정답표 추출"""
    with open(pdf_path, "rb") as f:
        pdf_data = base64.b64encode(f.read()).decode("utf-8")

    prompt = """이 PDF는 한국 시험지입니다. 마지막 페이지 또는 별지에 정답표가 있습니다.
정답표를 추출하여 JSON 배열로만 반환하세요 (다른 텍스트 없이):
[{"question_number": 1, "answer": 3}, {"question_number": 2, "answer": 1}, ...]

규칙:
- 정답이 번호(1~5)면 숫자로
- 서술형이면 텍스트로
- 정답표가 없으면 빈 배열 []
- JSON만 출력, 설명 없이"""

    try:
        response = model.generate_content([
            {"mime_type": "application/pdf", "data": pdf_data},
            prompt
        ])

        # JSON 추출
        text = response.text.strip()
        # ```json ... ``` 패턴 제거
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1)

        answers = json.loads(text)

        # 유효성 검사
        if not isinstance(answers, list):
            return None, f"Invalid response type: {type(answers)}"

        # 각 항목이 dict인지 확인
        valid_answers = []
        for a in answers:
            if isinstance(a, dict) and "question_number" in a and "answer" in a:
                valid_answers.append(a)

        if not valid_answers:
            return None, "No valid answers found in response"

        return valid_answers, None
    except json.JSONDecodeError as e:
        return None, f"JSON parse error: {str(e)}"
    except Exception as e:
        return None, str(e)

def update_json_with_answers(json_path, answers_list):
    """JSON 파일에 정답 삽입"""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 정답 매핑 생성 (안전하게)
    answer_map = {}
    for a in answers_list:
        if isinstance(a, dict) and "question_number" in a and "answer" in a:
            answer_map[a["question_number"]] = a["answer"]

    updated_count = 0
    for q in data.get("questions", []):
        num = q.get("number")
        if num and num in answer_map:
            if q.get("answer") is None or q.get("answer") == "":
                q["answer"] = answer_map[num]
                updated_count += 1

    # 저장
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return updated_count

def main():
    # Audit 파일 로드
    with open(AUDIT_FILE, "r", encoding="utf-8") as f:
        audit = json.load(f)

    # missing_answer 이슈가 있는 파일
    files_to_patch = [
        f for f in audit["by_file"]
        if f["issues"]["missing_answer"]
    ]

    print(f"정답 누락 파일: {len(files_to_patch)}개\n")

    log = {
        "total": len(files_to_patch),
        "success": 0,
        "skipped": 0,
        "failed": 0,
        "details": []
    }

    for i, file_info in enumerate(files_to_patch):
        filename = file_info["file"]
        missing_count = len(file_info["issues"]["missing_answer"])
        json_path = TESTS_JSON_DIR / filename

        print(f"[{i+1}/{len(files_to_patch)}] {filename} ({missing_count}개 누락)")

        # PDF 찾기
        pdf_path = find_pdf_for_json(filename)

        if not pdf_path:
            print(f"  → PDF 없음, 스킵")
            log["skipped"] += 1
            log["details"].append({
                "file": filename,
                "status": "skipped",
                "reason": "PDF not found"
            })
            continue

        print(f"  → PDF: {pdf_path.name}")

        # 정답 추출
        answers, error = extract_answers_from_pdf(pdf_path)

        if error:
            print(f"  → 추출 실패: {error}")
            log["failed"] += 1
            log["details"].append({
                "file": filename,
                "status": "failed",
                "reason": error
            })
            time.sleep(2)
            continue

        if not answers:
            print(f"  → 정답표 없음")
            log["skipped"] += 1
            log["details"].append({
                "file": filename,
                "status": "skipped",
                "reason": "No answer table found"
            })
            time.sleep(2)
            continue

        # JSON 업데이트
        updated = update_json_with_answers(json_path, answers)
        print(f"  → {updated}개 정답 삽입 완료")

        log["success"] += 1
        log["details"].append({
            "file": filename,
            "status": "success",
            "answers_found": len(answers),
            "updated": updated
        })

        # Rate limiting
        time.sleep(3)

    # 로그 저장
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"\n완료: 성공 {log['success']}, 스킵 {log['skipped']}, 실패 {log['failed']}")
    print(f"로그: {LOG_FILE}")

if __name__ == "__main__":
    main()
