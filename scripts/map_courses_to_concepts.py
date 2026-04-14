#!/usr/bin/env python3
"""
대학 강의를 K-12 개념에 매핑 (Gemini 2.5 Flash Lite 사용)
gemini-2.5-flash-lite: 무료 1,000 RPD
"""

import json
import os
import time
from pathlib import Path

# YAML 로드 (config.yaml 지원)
try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

# 선택: google.generativeai 또는 requests 직접 호출
try:
    import google.generativeai as genai
    USE_SDK = True
except ImportError:
    import requests
    USE_SDK = False


def load_api_key():
    """config.yaml 또는 환경변수에서 API 키 로드"""
    # 1. 환경변수 우선
    if os.environ.get('GEMINI_API_KEY'):
        return os.environ['GEMINI_API_KEY']

    # 2. config.yaml 확인
    config_paths = [
        Path(__file__).parent.parent / 'config.yaml',  # jubilee-bridge/config.yaml
        Path.home() / 'config.yaml',                    # ~/config.yaml
        Path.home() / '.config' / 'gemini' / 'config.yaml',
    ]

    if HAS_YAML:
        for config_path in config_paths:
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config = yaml.safe_load(f)
                    if config and config.get('gemini_api_key'):
                        print(f"API key loaded from {config_path}")
                        return config['gemini_api_key']

    return None

# 경로 설정
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'public' / 'data'
COURSES_FILE = DATA_DIR / 'university_courses.json'
CONCEPTS_MASTER = DATA_DIR / 'concepts_master.json'
CONCEPTS_PHYSICS = DATA_DIR / 'concepts_master_physics.json'
OUTPUT_FILE = DATA_DIR / 'course_concept_map.json'

# Gemini 설정
MODEL_ID = 'gemini-2.5-flash-lite'
API_KEY = load_api_key()

# 배치 크기 (rate limit 고려)
BATCH_SIZE = 10
DELAY_BETWEEN_BATCHES = 2  # seconds


def load_concepts():
    """개념 목록 로드 및 요약"""
    concepts = []
    concept_summary = {}

    # 마스터 파일에서 수학 개념 로드
    if CONCEPTS_MASTER.exists():
        with open(CONCEPTS_MASTER, 'r', encoding='utf-8') as f:
            master = json.load(f)
            master_concepts = master.get('concepts', master) if isinstance(master, dict) else master
            for c in master_concepts:
                concept_id = c.get('concept_id', c.get('id', ''))
                if concept_id.startswith('MATH-'):
                    concepts.append(c)
                    if 'mathematics' not in concept_summary:
                        concept_summary['mathematics'] = []
                    concept_summary['mathematics'].append({
                        'id': concept_id,
                        'title': c.get('title_en', c.get('title', '')),
                    })

    # 물리 개념 로드
    if CONCEPTS_PHYSICS.exists():
        with open(CONCEPTS_PHYSICS, 'r', encoding='utf-8') as f:
            physics = json.load(f)
            physics_concepts = physics.get('concepts', physics) if isinstance(physics, dict) else physics
            for c in physics_concepts:
                concept_id = c.get('concept_id', c.get('id', ''))
                concepts.append(c)
                if 'physics' not in concept_summary:
                    concept_summary['physics'] = []
                concept_summary['physics'].append({
                    'id': concept_id,
                    'title': c.get('title_en', c.get('title', '')),
                })

    return concepts, concept_summary


def load_courses():
    """대학 강의 목록 로드"""
    with open(COURSES_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def create_mapping_prompt(courses_batch, concept_summary):
    """매핑 프롬프트 생성"""
    # 관련 과목만 필터 (physics, math → 해당 개념만)
    relevant_subjects = set()
    for c in courses_batch:
        cat = c.get('category', '')
        if 'physics' in cat:
            relevant_subjects.add('physics')
        if 'math' in cat:
            relevant_subjects.add('mathematics')

    # 개념 목록 문자열화
    concepts_str = ""
    for subj in relevant_subjects:
        if subj in concept_summary:
            concepts_str += f"\n## {subj.upper()} Concepts:\n"
            for con in concept_summary[subj][:50]:  # 상위 50개만
                concepts_str += f"- {con['id']}: {con['title']}\n"

    # 강의 목록 문자열화
    courses_str = ""
    for i, c in enumerate(courses_batch):
        courses_str += f"{i+1}. [{c['course_id']}] {c['title']} ({c['category']}, {c['level']})\n"

    prompt = f"""You are mapping university courses to K-12 educational concepts.

COURSES TO MAP:
{courses_str}

AVAILABLE K-12 CONCEPTS:
{concepts_str}

For each course, identify 1-3 most relevant K-12 concept IDs that the course covers or extends.
Consider:
- A calculus course might map to algebra and pre-calculus concepts
- A quantum mechanics course might map to physics wave/energy concepts
- An advanced course might map to foundational concepts it builds upon

Return JSON array in this exact format:
[
  {{"course_id": "...", "concept_ids": ["CONCEPT-1", "CONCEPT-2"], "relevance": "high/medium/low"}},
  ...
]

Only return the JSON array, no explanation."""

    return prompt


def call_gemini(prompt):
    """Gemini API 호출"""
    if USE_SDK:
        genai.configure(api_key=API_KEY)
        model = genai.GenerativeModel(MODEL_ID)
        response = model.generate_content(prompt)
        text = response.text
    else:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent"
        headers = {"Content-Type": "application/json"}
        data = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        response = requests.post(f"{url}?key={API_KEY}", headers=headers, json=data)
        result = response.json()
        text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '[]')

    # JSON 파싱
    try:
        # JSON 블록 추출
        if '```json' in text:
            text = text.split('```json')[1].split('```')[0]
        elif '```' in text:
            text = text.split('```')[1].split('```')[0]
        return json.loads(text.strip())
    except json.JSONDecodeError:
        print(f"Failed to parse JSON: {text[:200]}")
        return []


def map_courses(dry_run=False):
    """전체 매핑 실행"""
    # API 키 확인
    if not API_KEY:
        print("Error: GEMINI_API_KEY not found.")
        print("Set via:")
        print("  1) GEMINI_API_KEY env var")
        print("  2) config.yaml with 'gemini_api_key' field")
        print(f"\nCreate config.yaml at: {SCRIPT_DIR.parent / 'config.yaml'}")
        print("Example:")
        print("  gemini_api_key: \"YOUR_API_KEY_HERE\"")
        return

    courses = load_courses()
    concepts, concept_summary = load_concepts()

    print(f"Loaded {len(courses)} courses")
    print(f"Loaded {len(concepts)} concepts")

    if dry_run:
        print("\n=== DRY RUN: Sample prompt ===")
        sample_prompt = create_mapping_prompt(courses[:3], concept_summary)
        print(sample_prompt)
        return

    all_mappings = []

    for i in range(0, len(courses), BATCH_SIZE):
        batch = courses[i:i+BATCH_SIZE]
        print(f"\nProcessing batch {i//BATCH_SIZE + 1}/{(len(courses)-1)//BATCH_SIZE + 1}...")

        prompt = create_mapping_prompt(batch, concept_summary)
        mappings = call_gemini(prompt)
        all_mappings.extend(mappings)

        print(f"  Mapped {len(mappings)} courses")

        # Rate limit 대응
        if i + BATCH_SIZE < len(courses):
            time.sleep(DELAY_BETWEEN_BATCHES)

    # 결과 저장
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_mappings, f, ensure_ascii=False, indent=2)

    print(f"\n=== Complete ===")
    print(f"Total mappings: {len(all_mappings)}")
    print(f"Output: {OUTPUT_FILE}")

    # 통계
    high_relevance = sum(1 for m in all_mappings if m.get('relevance') == 'high')
    medium_relevance = sum(1 for m in all_mappings if m.get('relevance') == 'medium')
    print(f"High relevance: {high_relevance}")
    print(f"Medium relevance: {medium_relevance}")


if __name__ == '__main__':
    import sys
    dry_run = '--dry-run' in sys.argv
    map_courses(dry_run=dry_run)
