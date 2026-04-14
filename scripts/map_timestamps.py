#!/usr/bin/env python3
"""
F-3b: 대학 강의 타임스탬프 → K-12 개념 매핑
Gemini 2.5-flash-lite로 분석
"""

import json
import sys
import time
from pathlib import Path

# lib 모듈 경로 추가
sys.path.insert(0, str(Path(__file__).parent))
from lib.config import load_gemini_api_key

try:
    import google.generativeai as genai
except ImportError:
    print("Error: google-generativeai not installed")
    sys.exit(1)

# 경로 설정
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / 'data'
TRANSCRIPTS_DIR = DATA_DIR / 'transcripts'
OUTPUT_FILE = DATA_DIR / 'timestamp_mappings.json'
CONCEPTS_FILE = PROJECT_DIR / 'public' / 'data' / 'concepts_master_physics.json'

# Gemini 설정
MODEL_ID = 'gemini-2.5-flash-lite'
BATCH_SIZE = 1
DELAY_SECONDS = 3


def load_concepts():
    """물리 개념 목록 로드"""
    if not CONCEPTS_FILE.exists():
        return []
    with open(CONCEPTS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    concepts = data.get('concepts', data) if isinstance(data, dict) else data
    return [{'id': c.get('concept_id', c.get('id', '')),
             'title': c.get('title_en', c.get('title', ''))}
            for c in concepts[:100]]  # 상위 100개만


def load_transcripts():
    """성공한 transcript 로드"""
    transcripts = []
    for f in TRANSCRIPTS_DIR.glob('*.json'):
        with open(f, 'r', encoding='utf-8') as fp:
            data = json.load(fp)
        # transcript가 있는 영상만
        videos_with_transcript = [v for v in data.get('videos', [])
                                  if v.get('transcript') and len(v['transcript']) > 10]
        if videos_with_transcript:
            transcripts.append({
                'course_id': data.get('course_id'),
                'title': data.get('title'),
                'videos': videos_with_transcript
            })
    return transcripts


def transcript_to_text(transcript_segments, max_chars=15000):
    """Transcript 세그먼트를 텍스트로 변환"""
    lines = []
    for seg in transcript_segments:
        start = seg.get('start', 0)
        text = seg.get('text', '')
        lines.append(f"[{int(start)}s] {text}")
    text = '\n'.join(lines)
    if len(text) > max_chars:
        text = text[:max_chars] + "\n... (truncated)"
    return text


def call_gemini(prompt):
    """Gemini API 호출"""
    api_key = load_gemini_api_key()
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL_ID)

    response = model.generate_content(prompt)
    text = response.text

    # JSON 추출
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0]
    elif '```' in text:
        text = text.split('```')[1].split('```')[0]

    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        print(f"  JSON parse error: {text[:200]}")
        return []


def analyze_video(video, concepts_summary):
    """단일 영상 분석"""
    transcript_text = transcript_to_text(video['transcript'])

    prompt = f"""Below is a university lecture transcript. Find segments useful for K-12 students learning physics.

TRANSCRIPT:
{transcript_text}

AVAILABLE PHYSICS CONCEPTS:
{concepts_summary}

For each useful segment, return JSON array:
[
  {{
    "start_time": <seconds>,
    "end_time": <seconds>,
    "topic": "<one-line description>",
    "concept_ids": ["PHY-..."],
    "difficulty": "basic" or "intermediate"
  }}
]

Rules:
- Only include segments with clear explanations suitable for high school level
- Skip advanced mathematical derivations
- Focus on intuitive explanations, analogies, real-world examples
- Typical segment length: 30-180 seconds
- Return empty array if no suitable segments found

Return ONLY the JSON array."""

    return call_gemini(prompt)


def main():
    print("=== F-3b: Timestamp Mapping ===\n")

    # 개념 로드
    concepts = load_concepts()
    concepts_summary = '\n'.join([f"- {c['id']}: {c['title']}" for c in concepts[:50]])
    print(f"Loaded {len(concepts)} physics concepts")

    # Transcript 로드
    transcripts = load_transcripts()
    print(f"Loaded {len(transcripts)} courses with transcripts\n")

    if not transcripts:
        print("No transcripts found!")
        return

    all_mappings = []

    for course in transcripts:
        print(f"\n{'='*50}")
        print(f"Course: {course['course_id']} - {course['title'][:40]}")

        course_mappings = {
            'course_id': course['course_id'],
            'title': course['title'],
            'videos': []
        }

        for video in course['videos']:
            print(f"  Video: {video['video_id']} - {video['title'][:30]}...")

            try:
                segments = analyze_video(video, concepts_summary)

                video_mapping = {
                    'video_id': video['video_id'],
                    'title': video['title'],
                    'segments': segments if isinstance(segments, list) else []
                }

                print(f"    Found {len(video_mapping['segments'])} segments")
                course_mappings['videos'].append(video_mapping)

            except Exception as e:
                print(f"    Error: {e}")
                course_mappings['videos'].append({
                    'video_id': video['video_id'],
                    'title': video['title'],
                    'segments': [],
                    'error': str(e)[:100]
                })

            time.sleep(DELAY_SECONDS)

        all_mappings.append(course_mappings)

    # 저장
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_mappings, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"Saved to: {OUTPUT_FILE}")

    # 통계
    total_segments = sum(
        len(v['segments'])
        for c in all_mappings
        for v in c['videos']
    )
    print(f"Total segments found: {total_segments}")


if __name__ == '__main__':
    main()
