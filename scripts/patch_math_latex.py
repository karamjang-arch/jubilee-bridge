#!/usr/bin/env python3
"""
패치 2: 수학 수식 LaTeX 변환 - Gemini로 미변환 수식을 LaTeX로 변환
"""

import json
import os
import time
import re
from pathlib import Path
from dotenv import load_dotenv

# .env.local 로드
load_dotenv(Path(__file__).parent.parent / ".env.local")

import google.generativeai as genai

# 경로 설정
BASE_DIR = Path(__file__).parent.parent
TESTS_JSON_DIR = BASE_DIR / "public/tests/json"
AUDIT_FILE = BASE_DIR / "data/test_quality_audit.json"
LOG_FILE = BASE_DIR / "data/patch_math_log.json"

# Gemini 설정
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash-lite")

# 미변환 수식 패턴
MATH_PATTERNS = [
    r"sqrt\s*\(",
    r"root\s*\(",
    r"frac\s*\(",
    r"\^[0-9a-zA-Z{]",
    r"\\frac\s*\{",
    r"\\sqrt\s*\{",
    r"\\sum",
    r"\\int",
    r"\\lim",
    r"_\{[^}]+\}",
]

def needs_latex_conversion(text):
    """텍스트에 미변환 수식이 있는지 확인"""
    if not text:
        return False
    for pattern in MATH_PATTERNS:
        if re.search(pattern, text):
            return True
    return False

def convert_to_latex(question_text, choices):
    """Gemini로 수식을 LaTeX로 변환"""
    prompt = f"""아래 수학 문제와 선택지의 수식을 LaTeX로 변환하세요.

규칙:
- 일반 텍스트는 그대로 유지
- 수식만 $...$ 로 감싸기 (인라인)
- sqrt(N) → $\\sqrt{{N}}$
- root(N,M) → $\\sqrt[N]{{M}}$
- N^M → $N^{{M}}$
- a/b (수식 맥락에서) → $\\frac{{a}}{{b}}$
- pi → $\\pi$
- * (곱셈) → $\\cdot$
- 이미 $로 감싸진 부분은 그대로

문제:
{question_text}

선택지:
{json.dumps(choices, ensure_ascii=False)}

JSON 형식으로만 응답 (설명 없이):
{{"question": "변환된 문제", "choices": ["변환된 선택지1", ...]}}"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # ```json ... ``` 패턴 제거
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1)

        result = json.loads(text)
        return result, None
    except Exception as e:
        return None, str(e)

def main():
    # Audit 파일 로드
    with open(AUDIT_FILE, "r", encoding="utf-8") as f:
        audit = json.load(f)

    # math_unrendered 이슈가 있는 파일
    files_to_patch = [
        f for f in audit["by_file"]
        if f["issues"]["math_unrendered"]
    ]

    print(f"수식 변환 필요 파일: {len(files_to_patch)}개\n")

    log = {
        "total_files": len(files_to_patch),
        "total_questions": 0,
        "success": 0,
        "failed": 0,
        "details": []
    }

    for i, file_info in enumerate(files_to_patch):
        filename = file_info["file"]
        question_nums = file_info["issues"]["math_unrendered"]
        json_path = TESTS_JSON_DIR / filename

        print(f"[{i+1}/{len(files_to_patch)}] {filename} ({len(question_nums)}개 문제)")

        # JSON 로드
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        updated_count = 0

        for q in data.get("questions", []):
            num = q.get("number")
            if num not in question_nums:
                continue

            log["total_questions"] += 1

            q_text = q.get("question", "")
            choices = q.get("choices", [])

            # 변환 필요 여부 재확인
            all_text = q_text + " " + " ".join(str(c) for c in choices if c)
            if not needs_latex_conversion(all_text):
                continue

            print(f"  문제 {num} 변환 중...")

            result, error = convert_to_latex(q_text, choices)

            if error:
                print(f"    → 실패: {error[:50]}")
                log["failed"] += 1
                time.sleep(2)
                continue

            # 업데이트
            if result:
                q["question"] = result.get("question", q_text)
                new_choices = result.get("choices", [])
                if len(new_choices) == len(choices):
                    q["choices"] = new_choices
                updated_count += 1
                log["success"] += 1

            time.sleep(2)

        # 저장
        if updated_count > 0:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  → {updated_count}개 문제 변환 완료")

        log["details"].append({
            "file": filename,
            "updated": updated_count
        })

    # 로그 저장
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"\n완료: 성공 {log['success']}, 실패 {log['failed']}")
    print(f"로그: {LOG_FILE}")

if __name__ == "__main__":
    main()
