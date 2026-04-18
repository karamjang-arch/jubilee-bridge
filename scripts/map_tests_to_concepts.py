#!/usr/bin/env python3
"""
Phase 1: 한국 모의고사 → CB 개념 매핑 (배치 처리)
- Gemini로 10개 문제를 한 번에 매핑
- API 호출 횟수 10분의 1로 감소
"""

import json
import os
import time
import re
import hashlib
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")

import google.generativeai as genai

# 경로 설정
BASE_DIR = Path(__file__).parent.parent
TESTS_JSON_DIR = BASE_DIR / "public/tests/json"
DATA_DIR = BASE_DIR / "public/data"
CONCEPTS_FILE = DATA_DIR / "concepts_master.json"
LOG_DIR = BASE_DIR / "data"
PROGRESS_FILE = LOG_DIR / "map_progress.json"

# 과목별 개념 파일 매핑
SUBJECT_CONCEPT_FILES = {
    "수학": "concepts_master.json",
    "영어": "concepts_master_english.json",
    "과학": "concepts_master.json",  # physics, chemistry, biology 포함
    "물리": "concepts_master_physics.json",
    "화학": "concepts_master_chemistry.json",
    "생물": "concepts_master_biology.json",
    "한국사": "concepts_master_history.json",
    "사회": "concepts_master_economics.json",
    "도덕": "concepts_master.json",  # 별도 파일 없음
    "국어": "concepts_master.json",  # 별도 파일 없음
}

# Gemini 설정 (유료 모델 - 풀스피드)
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")

# 과목 매핑
SUBJECT_MAP = {
    "수학": {"concept_prefix": "MATH", "output_file": "cb-questions-kr-math.json"},
    "국어": {"concept_prefix": None, "output_file": "cb-questions-kr-korean.json"},  # 별도 처리
    "영어": {"concept_prefix": "ENG", "output_file": "cb-questions-kr-english.json"},
    "과학": {"concept_prefix": ["PHYS", "CHEM", "BIO"], "output_file": "cb-questions-kr-science.json"},
    "사회": {"concept_prefix": "ECON", "output_file": "cb-questions-kr-society.json"},
    "도덕": {"concept_prefix": None, "output_file": "cb-questions-kr-ethics.json"},
    "한국사": {"concept_prefix": "HIST", "output_file": "cb-questions-kr-history.json"},
}

# 처리 순서 (수학 우선)
SUBJECT_ORDER = ["수학", "국어", "영어", "과학", "사회", "도덕", "한국사"]

# 배치 처리 설정
BATCH_SIZE = 10  # 한 번에 10문제씩
DELAY_SECONDS = 1.0  # 배치 사이 딜레이


def load_concepts(subject=None):
    """개념 마스터 파일 로드 (과목별)"""
    if subject and subject in SUBJECT_CONCEPT_FILES:
        concept_file = DATA_DIR / SUBJECT_CONCEPT_FILES[subject]
    else:
        concept_file = CONCEPTS_FILE

    if not concept_file.exists():
        print(f"  [WARN] Concept file not found: {concept_file}")
        return []

    with open(concept_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("concepts", [])


def get_concepts_for_subject(all_concepts, subject):
    """과목별 관련 개념 필터링"""
    config = SUBJECT_MAP.get(subject, {})
    prefix = config.get("concept_prefix")

    if prefix is None:
        # 국어, 도덕 등은 별도 처리 필요 - 일단 전체 반환
        return []

    if isinstance(prefix, list):
        # 과학 (물리, 화학, 생물)
        return [c for c in all_concepts if any(c["concept_id"].startswith(p) for p in prefix)]
    else:
        return [c for c in all_concepts if c["concept_id"].startswith(prefix)]


def load_progress():
    """진행 상황 로드"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "processed_questions": [],  # [(file, question_number), ...]
        "daily_count": 0,
        "last_date": None,
        "by_subject": {}
    }


def save_progress(progress):
    """진행 상황 저장"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def get_question_id(filename, question_number):
    """문제 고유 ID 생성"""
    return f"{filename}:{question_number}"


def filter_relevant_concepts(question_text, concepts_list, subject="수학"):
    """문제 키워드 기반으로 관련 개념 필터링"""

    # 비수학 과목이거나 개념이 적으면 전체 반환 (최대 150개)
    if subject not in ["수학"] or len(concepts_list) <= 150:
        import random
        shuffled = concepts_list.copy()
        random.shuffle(shuffled)
        return shuffled[:150]

    # 수능 고등수학 키워드 → csat_unit 매핑
    topic_to_units = {
        "지수로그": ["지수", "로그", "Exponential", "Logarithm"],
        "삼각함수": ["삼각", "Trigonometric"],
        "수열": ["수열", "Sequences"],
        "극한": ["극한", "Limits", "Continuity"],
        "미분": ["미분", "Differentiation", "도함수"],
        "적분": ["적분", "Integration"],
        "벡터": ["벡터", "Vectors"],
        "기하": ["기하", "이차곡선", "평면", "Parametric", "Polar"],
        "확률통계": ["확률", "통계", "Probability", "Inference", "정규분포"],
        "행렬": ["행렬", "Matrices"],
        "복소수": ["복소수", "Complex"],
        "다항식": ["다항식", "Polynomial", "방정식", "부등식"],
        "함수": ["함수", "Function"],
    }

    # 문제 텍스트에서 키워드 추출
    question_lower = question_text.lower()
    matched_topics = set()

    # 특정 패턴 감지
    if "lim" in question_lower or "극한" in question_text:
        matched_topics.add("극한")
    if "\\frac{d" in question_text or "미분" in question_text or "f'" in question_text or "도함수" in question_text:
        matched_topics.add("미분")
    if "\\int" in question_text or "적분" in question_text:
        matched_topics.add("적분")
    if "등비" in question_text or "등차" in question_text or "수열" in question_text or "a_n" in question_text:
        matched_topics.add("수열")
    if "sin" in question_lower or "cos" in question_lower or "tan" in question_lower:
        matched_topics.add("삼각함수")
    if "log" in question_lower or "지수" in question_text or "^" in question_text:
        matched_topics.add("지수로그")
    if "벡터" in question_text or "\\vec" in question_text:
        matched_topics.add("벡터")
    if "확률" in question_text or "P(" in question_text:
        matched_topics.add("확률통계")
    if "타원" in question_text or "포물선" in question_text or "쌍곡선" in question_text:
        matched_topics.add("기하")
    if "함수" in question_text or "f(x)" in question_text:
        matched_topics.add("함수")
    if "다항" in question_text or "인수분해" in question_text:
        matched_topics.add("다항식")

    # 매칭 없으면 고등 수학 전체 (수학I, 수학II, 미적분)
    if not matched_topics:
        matched_topics = {"함수", "미분", "극한", "수열", "지수로그"}

    # csat_unit 기반 필터링
    relevant = []
    for c in concepts_list:
        csat_unit = c.get("csat_unit", "") or ""

        # 고등 수학 관련 csat_unit인지 확인
        is_high_school = any(u in csat_unit for u in [
            "수학I", "수학II", "미적분", "기하", "확률과 통계",
            "수학(고1", "수학 >", "Differentiation", "Integration",
            "Exponential", "Trigonometric", "Vectors"
        ])

        if not is_high_school:
            continue

        # 매칭된 토픽과 관련 있는지 확인
        for topic in matched_topics:
            unit_keywords = topic_to_units.get(topic, [topic])
            for kw in unit_keywords:
                if kw in csat_unit:
                    relevant.append(c)
                    break
            else:
                continue
            break

    # 관련 개념이 너무 적으면 중학교 + 고등 수학 전체 추가
    if len(relevant) < 20:
        more_concepts = [c for c in concepts_list if
            c.get("csat_unit", "") and
            any(u in c.get("csat_unit", "") for u in [
                "수학I", "수학II", "미적분", "수학(고1", "기하 >",
                "중학수학", "초등수학"  # 검정고시용 추가
            ])]
        for c in more_concepts:
            if c not in relevant:
                relevant.append(c)
            if len(relevant) >= 150:
                break

    # 중복 제거
    seen = set()
    unique = []
    for c in relevant:
        if c["concept_id"] not in seen:
            seen.add(c["concept_id"])
            unique.append(c)

    # 중학/초등 개념도 추가 (검정고시용)
    if len(unique) < 100:
        basic_concepts = [c for c in concepts_list if
            c.get("csat_unit", "") and
            any(u in c.get("csat_unit", "") for u in ["중학수학", "초등수학"]) and
            c["concept_id"] not in seen]
        for c in basic_concepts[:50]:
            unique.append(c)
            seen.add(c["concept_id"])

    # 여전히 부족하면 전체 개념에서 랜덤 샘플 추가 (최소 80개 보장)
    if len(unique) < 80:
        import random
        remaining = [c for c in concepts_list if c["concept_id"] not in seen]
        random.shuffle(remaining)
        for c in remaining[:100 - len(unique)]:
            unique.append(c)

    return unique[:150]  # 최대 150개


def map_question_to_concepts(question_text, choices, subject, concepts_list):
    """Gemini로 문제를 개념에 매핑 (단일 문제용 - 호환성 유지)"""

    # 문제 기반 관련 개념 필터링
    relevant_concepts = filter_relevant_concepts(question_text, concepts_list, subject)

    # 개념 목록 축약
    concepts_summary = "\n".join([
        f"- {c['concept_id']}: {c.get('title_ko', c.get('title_en', ''))}"
        for c in relevant_concepts
    ])

    choices_text = "\n".join([f"{i+1}. {c}" for i, c in enumerate(choices)]) if choices else "선택지 없음"

    prompt = f"""아래는 한국 수능/모의고사 문제입니다. 이 문제가 테스트하는 핵심 개념을 판별하세요.
아래 개념 목록에서 가장 관련 높은 concept_id를 1~3개 선택하세요.

문제: {question_text}

선택지:
{choices_text}

과목: {subject}

개념 목록:
{concepts_summary}

JSON으로만 반환 (설명 없이):
{{"concept_ids": ["MATH-1-NBT-B", "MATH-1-OA-C"]}}

관련 개념이 목록에 없으면 빈 배열 반환:
{{"concept_ids": []}}"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # ```json ... ``` 제거
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1)

        # JSON 객체만 추출 (설명 제거)
        json_match = re.search(r'\{[^{}]*"concept_ids"\s*:\s*\[[^\]]*\][^{}]*\}', text)
        if json_match:
            text = json_match.group(0)

        result = json.loads(text)
        return result.get("concept_ids", []), None
    except Exception as e:
        return [], str(e)


def map_questions_batch(questions_batch, subject, concepts_list):
    """Gemini로 여러 문제를 한 번에 매핑 (배치 처리)"""

    if not questions_batch:
        return []

    # 첫 문제 기반으로 관련 개념 필터링 (배치 전체에 적용)
    first_q_text = questions_batch[0].get("question", "")
    relevant_concepts = filter_relevant_concepts(first_q_text, concepts_list, subject)

    # 개념 목록 축약
    concepts_summary = "\n".join([
        f"- {c['concept_id']}: {c.get('title_ko', c.get('title_en', ''))}"
        for c in relevant_concepts
    ])

    # 문제 목록 구성
    questions_text = ""
    for i, q in enumerate(questions_batch):
        q_text = q.get("question", "")[:500]  # 문제당 500자 제한
        choices = q.get("choices", [])
        choices_text = " / ".join([f"{j+1}){c[:30]}" for j, c in enumerate(choices[:5])]) if choices else ""
        questions_text += f"\n[문제 {i}] {q_text}\n선택지: {choices_text}\n"

    prompt = f"""아래 {len(questions_batch)}개의 한국 수능/모의고사 문제를 각각 가장 관련 높은 concept_id에 매핑하세요.

{questions_text}

과목: {subject}

개념 목록:
{concepts_summary}

JSON 배열로만 반환 (설명 없이):
[
  {{"question_index": 0, "concept_ids": ["MATH-HSA-APR-A-1"]}},
  {{"question_index": 1, "concept_ids": ["MATH-HSF-IF-C-7", "MATH-HSF-IF-C-8"]}},
  ...
]

관련 개념이 없으면 빈 배열:
{{"question_index": 2, "concept_ids": []}}"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # ```json ... ``` 제거
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1)

        # JSON 배열 추출
        array_match = re.search(r'\[[\s\S]*\]', text)
        if array_match:
            text = array_match.group(0)

        results = json.loads(text)

        # 결과를 인덱스별로 정리
        mapping = {}
        for r in results:
            idx = r.get("question_index", -1)
            cids = r.get("concept_ids", [])
            if idx >= 0 and idx < len(questions_batch):
                mapping[idx] = cids

        # 순서대로 반환 (누락된 인덱스는 빈 배열)
        return [mapping.get(i, []) for i in range(len(questions_batch))]

    except Exception as e:
        print(f"  [배치 오류] {str(e)[:50]}")
        # 오류 시 빈 배열 반환
        return [[] for _ in questions_batch]


def load_existing_output(output_file):
    """기존 출력 파일 로드"""
    output_path = DATA_DIR / output_file
    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_output(output_file, data):
    """출력 파일 저장"""
    output_path = DATA_DIR / output_file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def process_subject(subject, progress):
    """한 과목 처리 (배치 모드)"""
    config = SUBJECT_MAP.get(subject)
    if not config:
        print(f"  [SKIP] {subject}: 설정 없음")
        return 0

    output_file = config["output_file"]

    # 과목별 개념 로드
    all_concepts = load_concepts(subject)
    if not all_concepts:
        print(f"  [SKIP] {subject}: 개념 파일 없음")
        return 0

    concepts_list = get_concepts_for_subject(all_concepts, subject)

    # 필터링된 개념이 없으면 전체 사용
    if not concepts_list:
        concepts_list = all_concepts

    print(f"\n[{subject}] 개념 {len(concepts_list)}개, 출력: {output_file}")

    # 기존 출력 로드
    output_data = load_existing_output(output_file)

    # 테스트 파일 로드
    test_files = sorted(TESTS_JSON_DIR.glob("*.json"))
    processed_count = 0
    processed_set = set(progress["processed_questions"])

    # 처리할 문제들 수집
    pending_questions = []

    for test_file in test_files:
        try:
            with open(test_file, "r", encoding="utf-8") as f:
                test_data = json.load(f)
        except:
            continue

        file_subject = test_data.get("subject", "")
        if file_subject != subject:
            continue

        filename = test_file.name

        # 수학 파일인데 실제 내용이 영어면 스킵 (GED 오분류 문제)
        if subject == "수학" and filename.startswith("ged-"):
            first_q = test_data.get("questions", [{}])[0].get("question", "")
            # 수학 기호가 없으면 스킵
            if not any(c in first_q for c in ["$", "\\", "√", "=", "+", "-", "×", "÷"]):
                print(f"  [SKIP] {filename}: 수학 기호 없음 (잘못된 subject)")
                continue

        questions = test_data.get("questions", [])
        source_name = f"{test_data.get('year', '')}_{test_data.get('month', '')}_{test_data.get('name', filename)}"

        for q in questions:
            q_num = q.get("number", 0)
            q_id = get_question_id(filename, q_num)

            # 이미 처리됨?
            if q_id in processed_set:
                continue

            q_text = q.get("question", "") or ""
            if len(q_text) < 10:
                continue

            pending_questions.append({
                "q_id": q_id,
                "filename": filename,
                "q_num": q_num,
                "question": q_text,
                "choices": q.get("choices", []) or [],
                "answer": q.get("answer"),
                "explanation": q.get("explanation", ""),
                "passage": q.get("passage", ""),
                "source_name": source_name
            })

    print(f"  처리 대기: {len(pending_questions)}개 문제")

    # 배치 처리
    batch_num = 0
    for i in range(0, len(pending_questions), BATCH_SIZE):
        batch = pending_questions[i:i + BATCH_SIZE]
        batch_num += 1

        print(f"  [배치 {batch_num}] {len(batch)}개 문제...", end="", flush=True)

        # Gemini 배치 호출
        results = map_questions_batch(batch, subject, concepts_list)

        mapped_count = 0
        for j, concept_ids in enumerate(results):
            q = batch[j]

            if concept_ids:
                mapped_count += 1
                # 각 개념에 문제 추가
                for cid in concept_ids:
                    if cid not in output_data:
                        output_data[cid] = {"questions": []}

                    question_entry = {
                        "id": len(output_data[cid]["questions"]) + 1,
                        "source": q["source_name"],
                        "question_number": q["q_num"],
                        "question": q["question"],
                        "choices": q["choices"],
                        "answer": q["answer"],
                        "explanation": q["explanation"],
                        "passage": q["passage"],
                        "difficulty": "medium"
                    }
                    output_data[cid]["questions"].append(question_entry)

            # 진행 상황 업데이트
            progress["processed_questions"].append(q["q_id"])
            progress["daily_count"] += 1
            processed_count += 1

        print(f" → {mapped_count}/{len(batch)} 매핑됨", flush=True)

        # 배치마다 저장
        save_output(output_file, output_data)
        save_progress(progress)

        time.sleep(DELAY_SECONDS)

    # 최종 저장
    save_output(output_file, output_data)
    return processed_count


def main():
    import sys

    # 인자 처리
    subject_filter = None
    if len(sys.argv) > 1:
        subject_filter = sys.argv[1]

    print("=" * 60)
    print("Phase 1: 한국 모의고사 → CB 개념 매핑 (배치 모드)")
    print(f"배치 크기: {BATCH_SIZE}문제, 딜레이: {DELAY_SECONDS}초")
    print("=" * 60)

    # 진행 상황 로드
    progress = load_progress()
    today = datetime.now().strftime("%Y-%m-%d")
    progress["last_date"] = today

    print(f"이미 처리된 문제: {len(progress['processed_questions'])}")

    # 과목별 처리
    subjects_to_process = [subject_filter] if subject_filter else SUBJECT_ORDER

    total_processed = 0
    for subject in subjects_to_process:
        if subject not in SUBJECT_MAP:
            print(f"[SKIP] 알 수 없는 과목: {subject}")
            continue

        count = process_subject(subject, progress)
        total_processed += count

        # 진행 상황 저장
        if subject not in progress["by_subject"]:
            progress["by_subject"][subject] = {"count": 0}
        progress["by_subject"][subject]["count"] += count
        save_progress(progress)

    print("\n" + "=" * 60)
    print(f"완료: {total_processed}개 처리")
    print(f"총 처리: {len(progress['processed_questions'])}개")
    print("=" * 60)


if __name__ == "__main__":
    main()
