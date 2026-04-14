#!/usr/bin/env python3
"""
대학 강의 YouTube transcript 수집 스크립트

범위:
- Math: calculus, linear_algebra, probability_statistics (intro/intermediate)
- Physics: general (intro/intermediate)

사용:
  python3 scripts/collect_transcripts.py
  python3 scripts/collect_transcripts.py --dry-run
  python3 scripts/collect_transcripts.py --limit 10
"""

import json
import os
import re
import sys
import time
import subprocess
import logging
from pathlib import Path
from datetime import datetime

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import (
        TranscriptsDisabled,
        NoTranscriptFound,
        VideoUnavailable,
    )
except ImportError:
    print("Error: youtube-transcript-api not installed")
    print("Run: pip3 install youtube-transcript-api")
    sys.exit(1)

try:
    import yt_dlp
except ImportError:
    print("Error: yt-dlp not installed")
    print("Run: pip3 install yt-dlp")
    sys.exit(1)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# 경로 설정
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / 'data'
TRANSCRIPTS_DIR = DATA_DIR / 'transcripts'
COURSES_FILE = PROJECT_DIR / 'public' / 'data' / 'university_courses.json'

# 필터 조건
FILTER_CONDITIONS = {
    'mathematics': {
        'subcategories': ['calculus', 'linear_algebra', 'probability_statistics'],
        'levels': ['intro', 'intermediate'],
    },
    'physics': {
        'subcategories': ['general'],
        'levels': ['intro', 'intermediate'],
    },
}

# 설정
MAX_VIDEOS_PER_PLAYLIST = 3
DELAY_BETWEEN_REQUESTS = 3  # seconds


def extract_video_id(url):
    """URL에서 video ID 추출"""
    patterns = [
        r'(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'(?:embed/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_playlist_id(url):
    """URL에서 playlist ID 추출"""
    match = re.search(r'[?&]list=([a-zA-Z0-9_-]+)', url)
    return match.group(1) if match else None


def get_playlist_video_ids(playlist_id, max_videos=3):
    """yt-dlp로 playlist에서 video ID 목록 추출"""
    try:
        ydl_opts = {
            'extract_flat': True,
            'quiet': True,
            'no_warnings': True,
            'playlistend': max_videos,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            url = f'https://www.youtube.com/playlist?list={playlist_id}'
            info = ydl.extract_info(url, download=False)
            if info and 'entries' in info:
                video_ids = []
                for entry in info['entries'][:max_videos]:
                    if entry and entry.get('id'):
                        video_ids.append(entry['id'])
                return video_ids
        return []
    except Exception as e:
        logger.warning(f"yt-dlp error for playlist {playlist_id}: {str(e)[:100]}")
        return []


def get_video_title(video_id):
    """yt-dlp로 video title 추출"""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            url = f'https://www.youtube.com/watch?v={video_id}'
            info = ydl.extract_info(url, download=False)
            if info and info.get('title'):
                return info['title']
    except Exception:
        pass
    return f"Video {video_id}"


def get_transcript(video_id):
    """YouTube transcript 가져오기 (영어 우선)"""
    try:
        api = YouTubeTranscriptApi()

        # 사용 가능한 자막 목록 확인
        transcript_list = api.list(video_id)

        # 영어 자막 우선 시도 (수동 > 자동 > 번역)
        try:
            # 수동 영어 자막
            transcript = transcript_list.find_transcript(['en'])
            segments = list(transcript.fetch())
            return [{'start': s.start, 'duration': s.duration, 'text': s.text} for s in segments], 'manual'
        except NoTranscriptFound:
            pass

        # 자동 생성 영어 자막
        try:
            transcript = transcript_list.find_generated_transcript(['en'])
            segments = list(transcript.fetch())
            return [{'start': s.start, 'duration': s.duration, 'text': s.text} for s in segments], 'auto'
        except NoTranscriptFound:
            pass

        # 다른 언어 자막을 영어로 번역
        try:
            for t in transcript_list:
                if t.is_translatable:
                    translated = t.translate('en')
                    segments = list(translated.fetch())
                    return [{'start': s.start, 'duration': s.duration, 'text': s.text} for s in segments], 'translated'
        except Exception:
            pass

        return None, 'not_found'

    except TranscriptsDisabled:
        return None, 'disabled'
    except VideoUnavailable:
        return None, 'unavailable'
    except Exception as e:
        logger.debug(f"Transcript error for {video_id}: {e}")
        return None, str(e)[:50]


def filter_courses(courses):
    """조건에 맞는 강의 필터링"""
    filtered = []
    for course in courses:
        category = course.get('category', '')
        subcategory = course.get('subcategory', '')
        level = course.get('level', '')
        platform = course.get('platform', '')

        # YouTube만 대상
        if platform != 'YouTube':
            continue

        # 카테고리별 조건 확인
        if category in FILTER_CONDITIONS:
            cond = FILTER_CONDITIONS[category]
            if subcategory in cond['subcategories'] and level in cond['levels']:
                filtered.append(course)

    return filtered


def collect_transcript_for_course(course, dry_run=False):
    """단일 강의의 transcript 수집"""
    course_id = course.get('course_id', 'unknown')
    url = course.get('url', '')
    title = course.get('title', '')

    logger.info(f"Processing: {course_id} - {title[:50]}")

    result = {
        'course_id': course_id,
        'title': title,
        'url': url,
        'collected_at': datetime.now().isoformat(),
        'videos': [],
        'errors': [],
    }

    if dry_run:
        logger.info(f"  [DRY RUN] Would process: {url}")
        return result, 'dry_run'

    # Playlist vs Single Video 구분
    playlist_id = extract_playlist_id(url)
    video_id = extract_video_id(url)

    video_ids = []

    if playlist_id:
        logger.info(f"  Playlist detected: {playlist_id}")
        video_ids = get_playlist_video_ids(playlist_id, MAX_VIDEOS_PER_PLAYLIST)
        if not video_ids:
            result['errors'].append('Failed to get playlist videos')
            return result, 'playlist_error'
        logger.info(f"  Found {len(video_ids)} videos in playlist")
    elif video_id:
        video_ids = [video_id]
    else:
        result['errors'].append('Could not extract video/playlist ID from URL')
        return result, 'url_error'

    # 각 영상의 transcript 수집
    success_count = 0
    for vid in video_ids:
        time.sleep(DELAY_BETWEEN_REQUESTS)

        transcript, status = get_transcript(vid)
        video_title = get_video_title(vid)

        video_data = {
            'video_id': vid,
            'title': video_title,
            'transcript_status': status,
        }

        if transcript:
            video_data['transcript'] = transcript
            success_count += 1
            logger.info(f"    ✓ {vid}: {video_title[:40]}... ({len(transcript)} segments)")
        else:
            video_data['transcript'] = None
            logger.info(f"    ✗ {vid}: {video_title[:40]}... ({status})")

        result['videos'].append(video_data)

    if success_count > 0:
        return result, 'success'
    else:
        return result, 'no_transcripts'


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Collect YouTube transcripts for university courses')
    parser.add_argument('--dry-run', action='store_true', help='Preview without downloading')
    parser.add_argument('--limit', type=int, default=0, help='Limit number of courses to process')
    parser.add_argument('--resume', action='store_true', help='Skip already collected courses')
    args = parser.parse_args()

    # 출력 디렉토리 생성
    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

    # 강의 목록 로드
    logger.info(f"Loading courses from {COURSES_FILE}")
    with open(COURSES_FILE, 'r', encoding='utf-8') as f:
        all_courses = json.load(f)

    # 필터링
    courses = filter_courses(all_courses)
    logger.info(f"Filtered {len(courses)} courses from {len(all_courses)} total")

    # 이미 수집된 강의 확인 (resume 모드)
    if args.resume:
        existing = set()
        for f in TRANSCRIPTS_DIR.glob('*.json'):
            existing.add(f.stem)
        courses = [c for c in courses if c.get('course_id', '') not in existing]
        logger.info(f"After resume filter: {len(courses)} courses remaining")

    # 제한 적용
    if args.limit > 0:
        courses = courses[:args.limit]
        logger.info(f"Limited to {len(courses)} courses")

    if not courses:
        logger.info("No courses to process")
        return

    # 통계
    stats = {
        'total': len(courses),
        'success': 0,
        'partial': 0,
        'failed': 0,
        'skipped': 0,
    }

    # 수집 시작
    logger.info(f"\n{'='*60}")
    logger.info(f"Starting transcript collection: {len(courses)} courses")
    logger.info(f"{'='*60}\n")

    for i, course in enumerate(courses):
        logger.info(f"\n[{i+1}/{len(courses)}] {'='*40}")

        try:
            result, status = collect_transcript_for_course(course, dry_run=args.dry_run)

            if status == 'success':
                stats['success'] += 1
            elif status == 'dry_run':
                stats['skipped'] += 1
            elif status == 'no_transcripts':
                stats['partial'] += 1
            else:
                stats['failed'] += 1

            # 결과 저장 (dry-run이 아닐 때만)
            if not args.dry_run and result['videos']:
                output_file = TRANSCRIPTS_DIR / f"{course['course_id']}.json"
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                logger.info(f"  Saved: {output_file.name}")

        except KeyboardInterrupt:
            logger.info("\n\nInterrupted by user")
            break
        except Exception as e:
            logger.error(f"  Error processing course: {e}")
            stats['failed'] += 1

    # 최종 통계
    logger.info(f"\n{'='*60}")
    logger.info("COLLECTION COMPLETE")
    logger.info(f"{'='*60}")
    logger.info(f"Total courses: {stats['total']}")
    logger.info(f"Success: {stats['success']}")
    logger.info(f"Partial (no transcripts): {stats['partial']}")
    logger.info(f"Failed: {stats['failed']}")
    logger.info(f"Skipped (dry-run): {stats['skipped']}")
    logger.info(f"Output directory: {TRANSCRIPTS_DIR}")


if __name__ == '__main__':
    main()
