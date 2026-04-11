#!/usr/bin/env python3
"""
YouTube Video ID Scraper (Web Search)
=====================================
youtube_mapping.json의 video_id가 없는 항목에 대해 웹 검색으로 video_id를 채운다.

Usage:
    python3 youtube_videoid_scrape.py [--limit N] [--dry-run]

    # Background execution:
    nohup python3 scripts/youtube_videoid_scrape.py > videoid_scrape.log 2>&1 &
    caffeinate -i -w $(pgrep -f videoid_scrape) &

Method:
    - YouTube 검색 페이지 HTML에서 videoId 패턴 추출
    - API 불필요, 쿼터 제한 없음
    - 간격 1초로 rate limit 방지

Checkpoint:
    - 100건마다 자동 저장
    - 중단 후 재실행 시 이어서 처리
"""

import json
import os
import re
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any

try:
    import requests
except ImportError:
    print("ERROR: requests 설치 필요")
    print("  pip3 install requests")
    sys.exit(1)

# 경로 설정
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
MAPPING_FILE = PROJECT_ROOT / "public" / "data" / "youtube_mapping.json"
BACKUP_FILE = PROJECT_ROOT / "public" / "data" / "youtube_mapping.backup.json"
CHECKPOINT_FILE = SCRIPT_DIR / "videoid_checkpoint.json"

# YouTube 검색 URL
YOUTUBE_SEARCH_URL = "https://www.youtube.com/results"

# User-Agent (봇 차단 방지)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
}

# videoId 패턴 (JSON 응답 내)
VIDEO_ID_PATTERN = re.compile(r'"videoId":"([a-zA-Z0-9_-]{11})"')


def load_mapping() -> Dict[str, Any]:
    """youtube_mapping.json 로드"""
    if not MAPPING_FILE.exists():
        print(f"ERROR: {MAPPING_FILE} 파일 없음")
        sys.exit(1)

    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_mapping(data: Dict[str, Any]):
    """youtube_mapping.json 저장"""
    with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def backup_mapping():
    """백업 생성"""
    if MAPPING_FILE.exists():
        import shutil
        shutil.copy(MAPPING_FILE, BACKUP_FILE)
        print(f"[BACKUP] {BACKUP_FILE}")


def load_checkpoint() -> set:
    """처리 완료된 항목 로드"""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, 'r') as f:
            data = json.load(f)
            return set(data.get("processed", []))
    return set()


def save_checkpoint(processed: set):
    """체크포인트 저장"""
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump({
            "processed": list(processed),
            "updated_at": datetime.now().isoformat()
        }, f)


def clean_search_query(channel: str, title: str) -> str:
    """검색어 정제: 접두사 제거"""
    clean_title = title
    for prefix in ['YouTube:', 'Watch:', 'youtube:', 'watch:']:
        if clean_title.startswith(prefix):
            clean_title = clean_title[len(prefix):].strip()
    return f"{channel} {clean_title}"


def search_video_id(query: str) -> Optional[str]:
    """YouTube 웹 검색으로 video_id 추출"""
    try:
        params = {"search_query": query}
        response = requests.get(
            YOUTUBE_SEARCH_URL,
            params=params,
            headers=HEADERS,
            timeout=10
        )
        response.raise_for_status()

        # HTML에서 첫 번째 videoId 추출
        matches = VIDEO_ID_PATTERN.findall(response.text)
        if matches:
            # 중복 제거 후 첫 번째 반환
            seen = set()
            for vid in matches:
                if vid not in seen:
                    return vid
                seen.add(vid)
        return None

    except requests.RequestException as e:
        print(f"    [ERROR] Request failed: {e}")
        return None
    except Exception as e:
        print(f"    [ERROR] {e}")
        return None


def find_missing_video_ids(data: Dict[str, Any], processed: set) -> List[Tuple]:
    """video_id가 없는 항목 찾기 (이미 처리된 것 제외)"""
    missing = []

    for concept_id, videos in data.items():
        for lang in ['en', 'ko']:
            if lang not in videos:
                continue
            for idx, video in enumerate(videos[lang]):
                key = f"{concept_id}:{lang}:{idx}"
                if key in processed:
                    continue
                if not video.get('video_id'):
                    missing.append((concept_id, lang, idx, video, key))

    return missing


def main():
    parser = argparse.ArgumentParser(description='YouTube Video ID Scraper')
    parser.add_argument('--dry-run', action='store_true', help='실제 검색 없이 대상만 출력')
    parser.add_argument('--limit', type=int, default=0, help='처리할 최대 항목 수 (0=무제한)')
    parser.add_argument('--delay', type=float, default=1.0, help='검색 간격 (초)')
    parser.add_argument('--reset', action='store_true', help='체크포인트 초기화')
    args = parser.parse_args()

    print(f"[START] {datetime.now().isoformat()}")
    print(f"[CONFIG] delay={args.delay}s, limit={args.limit or 'unlimited'}")

    # 체크포인트 로드/초기화
    if args.reset and CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        print("[RESET] Checkpoint cleared")

    processed = load_checkpoint()
    print(f"[CHECKPOINT] {len(processed)} items already processed")

    # 데이터 로드
    print(f"[LOAD] {MAPPING_FILE}")
    data = load_mapping()

    # 누락 항목 찾기
    missing = find_missing_video_ids(data, processed)
    print(f"[MISSING] {len(missing)} items need video_id")

    if not missing:
        print("[DONE] All items have video_id")
        return

    # 처리 대상 제한
    if args.limit > 0:
        missing = missing[:args.limit]
    print(f"[TARGET] Processing {len(missing)} items")

    if args.dry_run:
        print("\n=== DRY RUN ===")
        for concept_id, lang, idx, video, key in missing[:50]:
            query = clean_search_query(video['channel'], video['title'])
            print(f"  [{key}] {query[:70]}...")
        if len(missing) > 50:
            print(f"  ... and {len(missing) - 50} more")
        return

    # 백업 생성 (최초 1회)
    backup_mapping()

    # 처리
    print("\n=== SCRAPING ===")
    updated_count = 0
    error_count = 0
    start_time = time.time()

    for i, (concept_id, lang, idx, video, key) in enumerate(missing):
        query = clean_search_query(video['channel'], video['title'])
        print(f"[{i+1}/{len(missing)}] {key}")
        print(f"  Q: {query[:60]}...")

        video_id = search_video_id(query)

        if video_id:
            print(f"  -> {video_id}")
            data[concept_id][lang][idx]['video_id'] = video_id
            updated_count += 1
        else:
            print(f"  -> NOT FOUND")
            error_count += 1

        # 처리 완료 기록
        processed.add(key)

        # 체크포인트 저장 (100건마다)
        if (i + 1) % 100 == 0:
            save_mapping(data)
            save_checkpoint(processed)
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed
            remaining = (len(missing) - i - 1) / rate if rate > 0 else 0
            print(f"  [SAVE] {updated_count} updated, {error_count} failed, ETA: {remaining/60:.1f}min")

        # Rate limit
        time.sleep(args.delay)

    # 최종 저장
    save_mapping(data)
    save_checkpoint(processed)

    elapsed = time.time() - start_time
    print(f"\n=== RESULT ===")
    print(f"  Updated: {updated_count}")
    print(f"  Failed: {error_count}")
    print(f"  Time: {elapsed/60:.1f} min")
    print(f"[END] {datetime.now().isoformat()}")


if __name__ == '__main__':
    main()
