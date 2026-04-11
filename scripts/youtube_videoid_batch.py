#!/usr/bin/env python3
"""
YouTube Video ID Batch Lookup
=============================
youtube_mapping.json의 video_id가 없는 항목에 대해 YouTube Data API로 검색하여 video_id를 채운다.

Usage:
    python youtube_videoid_batch.py [--dry-run] [--limit N]

Requirements:
    - YOUTUBE_API_KEY 환경변수 설정
    - pip install google-api-python-client

Rate Limits:
    - YouTube Data API 무료 할당량: 10,000 units/day
    - search.list = 100 units per request
    - 따라서 하루 최대 100건 검색 가능
"""

import json
import os
import sys
import time
import argparse
from pathlib import Path
from typing import Optional, List, Tuple, Dict, Any

# Google API 클라이언트
try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("ERROR: google-api-python-client 설치 필요")
    print("  pip install google-api-python-client")
    sys.exit(1)

# 경로 설정
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
MAPPING_FILE = PROJECT_ROOT / "public" / "data" / "youtube_mapping.json"
BACKUP_FILE = PROJECT_ROOT / "public" / "data" / "youtube_mapping.backup.json"

def load_mapping():
    """youtube_mapping.json 로드"""
    if not MAPPING_FILE.exists():
        print(f"ERROR: {MAPPING_FILE} 파일 없음")
        sys.exit(1)

    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_mapping(data):
    """youtube_mapping.json 저장 (백업 포함)"""
    # 백업 생성
    if MAPPING_FILE.exists():
        with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
            backup_data = f.read()
        with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
            f.write(backup_data)
        print(f"  백업 저장: {BACKUP_FILE}")

    # 저장
    with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  저장 완료: {MAPPING_FILE}")

def clean_search_query(channel: str, title: str) -> str:
    """검색어 정제: 접두사 제거"""
    clean_title = title
    for prefix in ['YouTube:', 'Watch:', 'youtube:', 'watch:']:
        if clean_title.startswith(prefix):
            clean_title = clean_title[len(prefix):].strip()
    return f"{channel} {clean_title}"

def search_video_id(youtube, channel: str, title: str) -> Optional[str]:
    """YouTube Data API로 video_id 검색"""
    query = clean_search_query(channel, title)

    try:
        response = youtube.search().list(
            q=query,
            part='id,snippet',
            type='video',
            maxResults=1,
            relevanceLanguage='en'  # 언어 힌트
        ).execute()

        items = response.get('items', [])
        if items:
            video_id = items[0]['id'].get('videoId')
            found_title = items[0]['snippet'].get('title', '')
            found_channel = items[0]['snippet'].get('channelTitle', '')
            print(f"    찾음: {video_id} - {found_channel}: {found_title[:50]}...")
            return video_id
        else:
            print(f"    결과 없음: {query[:60]}...")
            return None

    except HttpError as e:
        if e.resp.status == 403:
            print(f"ERROR: API 할당량 초과 또는 권한 없음")
            raise
        print(f"    API 오류: {e}")
        return None

def find_missing_video_ids(data: Dict[str, Any]) -> List[Tuple]:
    """video_id가 없는 항목 찾기"""
    missing = []

    for concept_id, videos in data.items():
        for lang in ['en', 'ko']:
            if lang not in videos:
                continue
            for idx, video in enumerate(videos[lang]):
                if not video.get('video_id'):
                    missing.append((concept_id, lang, idx, video))

    return missing

def main():
    parser = argparse.ArgumentParser(description='YouTube Video ID Batch Lookup')
    parser.add_argument('--dry-run', action='store_true', help='실제 API 호출 없이 대상만 출력')
    parser.add_argument('--limit', type=int, default=50, help='처리할 최대 항목 수 (기본: 50)')
    args = parser.parse_args()

    # API 키 확인
    api_key = os.environ.get('YOUTUBE_API_KEY')
    if not api_key and not args.dry_run:
        print("ERROR: YOUTUBE_API_KEY 환경변수 설정 필요")
        print("  export YOUTUBE_API_KEY='your-api-key'")
        sys.exit(1)

    # 데이터 로드
    print(f"Loading: {MAPPING_FILE}")
    data = load_mapping()

    # 누락 항목 찾기
    missing = find_missing_video_ids(data)
    print(f"\nVideo ID 누락 항목: {len(missing)}건")

    if not missing:
        print("모든 항목에 video_id가 있습니다.")
        return

    # 처리 대상 제한
    to_process = missing[:args.limit]
    print(f"처리 대상: {len(to_process)}건 (limit={args.limit})")

    if args.dry_run:
        print("\n=== DRY RUN (실제 API 호출 없음) ===")
        for concept_id, lang, idx, video in to_process:
            query = clean_search_query(video['channel'], video['title'])
            print(f"  [{concept_id}] ({lang}#{idx}) {query[:70]}...")
        return

    # YouTube API 클라이언트 생성
    youtube = build('youtube', 'v3', developerKey=api_key)

    # 처리
    print("\n=== Video ID 검색 시작 ===")
    updated_count = 0
    error_count = 0

    for i, (concept_id, lang, idx, video) in enumerate(to_process):
        print(f"\n[{i+1}/{len(to_process)}] {concept_id} ({lang}#{idx})")
        print(f"  검색: {video['channel']} - {video['title'][:50]}...")

        try:
            video_id = search_video_id(youtube, video['channel'], video['title'])

            if video_id:
                # 데이터 업데이트
                data[concept_id][lang][idx]['video_id'] = video_id
                updated_count += 1

            # Rate limit 방지 (0.5초 대기)
            time.sleep(0.5)

        except HttpError:
            print("API 할당량 초과로 중단합니다.")
            break
        except Exception as e:
            print(f"  오류: {e}")
            error_count += 1
            continue

    # 결과 저장
    print(f"\n=== 결과 ===")
    print(f"  업데이트: {updated_count}건")
    print(f"  오류: {error_count}건")

    if updated_count > 0:
        save_mapping(data)
    else:
        print("  업데이트 없음, 저장 건너뜀")

if __name__ == '__main__':
    main()
