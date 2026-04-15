#!/usr/bin/env python3
"""
한국 모의고사 + 검정고시 JSON 품질 감사 스크립트
"""

import json
import re
import os
from pathlib import Path
from collections import defaultdict

# 경로 설정
BASE_DIR = Path(__file__).parent.parent
TESTS_DIR = BASE_DIR / "public/tests/json"
OUTPUT_FILE = BASE_DIR / "data/test_quality_audit.json"

# 지문 참조 패턴
PASSAGE_REF_PATTERNS = [
    r"윗글", r"위 글", r"다음 글", r"제시문", r"지문",
    r"\(가\)", r"\(나\)", r"\(다\)",
    r"<보기>", r"\[A\]", r"\[B\]", r"\[C\]",
    r"위의 글", r"본문"
]

# LaTeX 미변환 수식 패턴
MATH_UNRENDERED_PATTERNS = [
    r"sqrt\s*\(",      # sqrt(
    r"root\s*\(",      # root(
    r"frac\s*\(",      # frac(
    r"\^[0-9a-zA-Z{]", # ^2, ^{n}
    r"\\frac\s*\{",    # \frac{
    r"\\sqrt\s*\{",    # \sqrt{
    r"\\sum",          # \sum
    r"\\int",          # \int
    r"\\lim",          # \lim
    r"_\{[^}]+\}",     # _{subscript}
]

# 듣기 참조 패턴
LISTENING_PATTERNS = [
    r"듣고", r"들으시오", r"들어보", r"대화를 듣", r"방송을 듣",
    r"Listen", r"listening", r"audio"
]

def check_passage_missing(question):
    """지문 참조가 있는데 passage가 비어있는지 체크"""
    q_text = question.get("question", "") or ""
    passage = question.get("passage", "") or ""

    # 지문 참조 패턴 확인
    has_ref = any(re.search(p, q_text, re.IGNORECASE) for p in PASSAGE_REF_PATTERNS)

    # passage가 비어있거나 너무 짧음
    passage_empty = len(passage.strip()) < 10

    return has_ref and passage_empty

def check_math_unrendered(question):
    """LaTeX 미변환 수식 패턴 체크"""
    q_text = question.get("question", "") or ""
    choices = question.get("choices", []) or []

    all_text = q_text + " " + " ".join(str(c) for c in choices if c)

    for pattern in MATH_UNRENDERED_PATTERNS:
        if re.search(pattern, all_text):
            return True
    return False

def check_listening_no_script(question):
    """듣기 참조가 있는데 script 필드가 없는지 체크"""
    q_text = question.get("question", "") or ""
    script = question.get("script", "") or question.get("audio_script", "") or ""
    passage = question.get("passage", "") or ""

    has_listening_ref = any(re.search(p, q_text, re.IGNORECASE) for p in LISTENING_PATTERNS)
    has_script = len(script.strip()) > 10 or "듣기" not in q_text.lower()

    # passage에 듣기 스크립트가 포함되어 있을 수도 있음
    if len(passage.strip()) > 50:
        has_script = True

    return has_listening_ref and not has_script

def check_empty_choices(question):
    """선택지가 비었거나 1개 이하인지 체크"""
    choices = question.get("choices", []) or []
    valid_choices = [c for c in choices if c and str(c).strip()]
    return len(valid_choices) <= 1

def check_missing_answer(question):
    """정답 필드가 없는지 체크"""
    answer = question.get("answer") or question.get("correct") or question.get("correct_answer")
    return answer is None or answer == ""

def audit_file(filepath):
    """단일 파일 감사"""
    issues = {
        "passage_missing": [],
        "math_unrendered": [],
        "listening_no_script": [],
        "empty_choices": [],
        "missing_answer": []
    }

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        return None, str(e)

    questions = data.get("questions", [])
    if not questions:
        return None, "no questions"

    for q in questions:
        num = q.get("number", q.get("id", "?"))

        if check_passage_missing(q):
            issues["passage_missing"].append(num)

        if check_math_unrendered(q):
            issues["math_unrendered"].append(num)

        if check_listening_no_script(q):
            issues["listening_no_script"].append(num)

        if check_empty_choices(q):
            issues["empty_choices"].append(num)

        if check_missing_answer(q):
            issues["missing_answer"].append(num)

    return {
        "total_questions": len(questions),
        "issues": issues
    }, None

def main():
    # 대상 파일 수집 (한국 관련 테스트만)
    patterns = ["ged-*.json", "korean-*.json", "csat-*.json", "mock-*.json", "pyeongwon-*.json"]

    all_files = []
    for pattern in patterns:
        all_files.extend(TESTS_DIR.glob(pattern))

    # 중복 제거 및 정렬
    all_files = sorted(set(all_files))

    print(f"대상 파일: {len(all_files)}개\n")

    # 감사 실행
    results = {
        "summary": {
            "total_files": 0,
            "total_questions": 0,
            "passage_missing": 0,
            "math_unrendered": 0,
            "listening_no_script": 0,
            "empty_choices": 0,
            "missing_answer": 0
        },
        "by_file": [],
        "by_issue_type": {
            "passage_missing": {"files": 0, "questions": 0},
            "math_unrendered": {"files": 0, "questions": 0},
            "listening_no_script": {"files": 0, "questions": 0},
            "empty_choices": {"files": 0, "questions": 0},
            "missing_answer": {"files": 0, "questions": 0}
        }
    }

    for filepath in all_files:
        filename = filepath.name
        audit_result, error = audit_file(filepath)

        if error:
            print(f"  [ERROR] {filename}: {error}")
            continue

        results["summary"]["total_files"] += 1
        results["summary"]["total_questions"] += audit_result["total_questions"]

        file_entry = {
            "file": filename,
            "total_questions": audit_result["total_questions"],
            "issues": audit_result["issues"]
        }
        results["by_file"].append(file_entry)

        # 이슈 집계
        for issue_type, question_nums in audit_result["issues"].items():
            count = len(question_nums)
            results["summary"][issue_type] += count

            if count > 0:
                results["by_issue_type"][issue_type]["files"] += 1
                results["by_issue_type"][issue_type]["questions"] += count

    # 결과 저장
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 콘솔 출력
    print("=" * 80)
    print("품질 감사 요약")
    print("=" * 80)
    print(f"총 파일: {results['summary']['total_files']}개")
    print(f"총 문제: {results['summary']['total_questions']}개")
    print()

    print("이슈 유형별 현황:")
    print("-" * 60)
    print(f"{'이슈 유형':<25} {'파일 수':>10} {'문제 수':>10}")
    print("-" * 60)

    for issue_type, counts in results["by_issue_type"].items():
        if counts["questions"] > 0:
            print(f"{issue_type:<25} {counts['files']:>10} {counts['questions']:>10}")

    print("-" * 60)
    print()

    # 파일별 이슈 요약 (이슈 있는 파일만)
    print("파일별 이슈 현황 (이슈 있는 파일만):")
    print("-" * 80)
    print(f"{'파일명':<45} {'문제수':>6} {'passage':>8} {'math':>6} {'listen':>7} {'choice':>7} {'answer':>7}")
    print("-" * 80)

    for entry in results["by_file"]:
        issues = entry["issues"]
        total_issues = sum(len(v) for v in issues.values())

        if total_issues > 0:
            print(f"{entry['file']:<45} {entry['total_questions']:>6} "
                  f"{len(issues['passage_missing']):>8} "
                  f"{len(issues['math_unrendered']):>6} "
                  f"{len(issues['listening_no_script']):>7} "
                  f"{len(issues['empty_choices']):>7} "
                  f"{len(issues['missing_answer']):>7}")

    print("-" * 80)
    print(f"\n결과 저장: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
