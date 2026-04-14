#!/usr/bin/env python3
"""
F-3c: 대학 강의 첫 영상에서 동기부여 클립 추출
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
OUTPUT_FILE = DATA_DIR / 'motivation_clips.json'

# Gemini 설정
MODEL_ID = 'gemini-2.5-flash-lite'
DELAY_SECONDS = 3


def load_transcripts():
    """성공한 transcript의 첫 영상만 로드"""
    transcripts = []
    for f in TRANSCRIPTS_DIR.glob('*.json'):
        with open(f, 'r', encoding='utf-8') as fp:
            data = json.load(fp)
        # 첫 영상이 transcript 있으면 추가
        videos = data.get('videos', [])
        if videos and videos[0].get('transcript') and len(videos[0]['transcript']) > 10:
            transcripts.append({
                'course_id': data.get('course_id'),
                'title': data.get('title'),
                'first_video': videos[0]
            })
    return transcripts


def transcript_to_text(transcript_segments, max_chars=12000):
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
        return None


def extract_motivation(course):
    """첫 강의에서 동기부여 클립 추출"""
    video = course['first_video']
    transcript_text = transcript_to_text(video['transcript'])

    prompt = f"""Below is the first lecture transcript from a university physics course.
Extract the most motivational segment that would hook a high school student.

TRANSCRIPT:
{transcript_text}

Return JSON:
{{
  "hook": "<one compelling sentence that makes a teen think 'this is cool'>",
  "start_time": <seconds when the hook starts>,
  "end_time": <seconds when the hook ends>,
  "why_cool": "<2-3 sentences explaining why this subject is fascinating, written for high school level>",
  "quote": "<the actual quote or paraphrase from the professor>"
}}

Focus on:
- Moments of wonder, curiosity, or revelation
- Real-world applications that teens relate to
- "Aha!" explanations
- Professor's personal passion for the subject

Return ONLY the JSON object."""

    return call_gemini(prompt)


def main():
    print("=== F-3c: Motivation Clips Extraction ===\n")

    # Transcript 로드
    transcripts = load_transcripts()
    print(f"Loaded {len(transcripts)} courses with first lecture transcripts\n")

    if not transcripts:
        print("No transcripts found!")
        return

    all_clips = []

    for course in transcripts:
        print(f"Processing: {course['course_id']} - {course['title'][:40]}")

        try:
            result = extract_motivation(course)

            if result:
                clip = {
                    'course_id': course['course_id'],
                    'title': course['title'],
                    'video_id': course['first_video']['video_id'],
                    'video_title': course['first_video']['title'],
                    **result
                }
                all_clips.append(clip)
                print(f"  ✓ Hook: {result.get('hook', '')[:50]}...")
            else:
                print(f"  ✗ No motivation clip found")

        except Exception as e:
            print(f"  ✗ Error: {e}")

        time.sleep(DELAY_SECONDS)

    # 저장
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_clips, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"Saved {len(all_clips)} motivation clips to: {OUTPUT_FILE}")


if __name__ == '__main__':
    main()
