#!/usr/bin/env python3
"""
대학 강의 README를 파싱하여 university_courses.json 생성
"""

import re
import json
import hashlib
from pathlib import Path

# 경로 설정
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
PUBLIC_DATA_DIR = SCRIPT_DIR.parent / 'public' / 'data'

INPUT_FILE = DATA_DIR / 'university_lectures_raw.md'
OUTPUT_FILE = PUBLIC_DATA_DIR / 'university_courses.json'

# 대학 약자 매핑
UNIVERSITY_ABBREV = {
    'MIT': 'MIT',
    'MIT OCW': 'MIT',
    'Stanford': 'STANFORD',
    'Stanford University': 'STANFORD',
    'Yale': 'YALE',
    'Yale University': 'YALE',
    'Harvard': 'HARVARD',
    'Harvard University': 'HARVARD',
    'Caltech': 'CALTECH',
    'UC Irvine': 'UCI',
    'UC Berkeley': 'UCB',
    'Oxford': 'OXFORD',
    'Oxford University': 'OXFORD',
    'Cambridge': 'CAM',
    'University of Cambridge': 'CAM',
    'Princeton': 'PRINCETON',
    'IIT': 'IIT',
    'IIT Madras': 'IITM',
    'Tata Institute': 'TIFR',
    'TIFR': 'TIFR',
    'NPTEL': 'NPTEL',
    'Santa Barbara City College': 'SBCC',
    'Colorado School of Mines': 'CSM',
    'Rutgers': 'RUTGERS',
}

# 소분류 → subcategory 매핑
SUBCATEGORY_MAP = {
    # Physics
    'General': 'general',
    'General (uncategorized)': 'general',
    'Mathematical Physics': 'mathematical_physics',
    'Quantum Physics': 'quantum',
    'Quantum Mechanics': 'quantum',
    'Relativity': 'relativity',
    'General Relativity': 'relativity',
    'Astronomy/Astrophysics/Cosmology': 'astrophysics',
    'Astrophysics': 'astrophysics',
    'Cosmology': 'astrophysics',
    'Computational Physics': 'computational_physics',
    'String Theory': 'string_theory',
    'Statistical Mechanics': 'statistical_mechanics',
    'Particle Physics': 'particle_physics',
    'Nuclear Physics': 'particle_physics',

    # Mathematics
    'Calculus': 'calculus',
    'Calculus & Analysis': 'calculus',
    'Differential Equations': 'calculus',
    'Linear Algebra': 'linear_algebra',
    'Algebra': 'linear_algebra',
    'Abstract Algebra': 'linear_algebra',
    'Probability & Statistics': 'probability_statistics',
    'Probability and Statistics': 'probability_statistics',
    'Statistics': 'probability_statistics',
    'Discrete Math': 'discrete',
    'Discrete Mathematics': 'discrete',
    'Number Theory': 'number_theory',
    'Geometry and Topology': 'geometry',
    'Geometry': 'geometry',
    'Topology': 'geometry',
    'Mathematical Analysis': 'analysis',
    'Real Analysis': 'analysis',
    'Complex Analysis': 'analysis',
    'Logic and Foundations': 'logic',
    'Applied Mathematics': 'applied',
    'Computational Mathematics': 'computational',

    # Chemistry
    'General Chemistry': 'general',
    'Organic Chemistry': 'organic',
    'Inorganic Chemistry': 'inorganic',
    'Physical Chemistry': 'physical',
    'Biochemistry': 'biochemistry',
    'Analytical Chemistry': 'analytical',
}

def extract_university(text):
    """텍스트에서 대학명 추출"""
    for uni, abbrev in UNIVERSITY_ABBREV.items():
        if uni.lower() in text.lower():
            return abbrev

    # 패턴 매칭으로 추가 추출
    patterns = [
        r'MIT\b',
        r'Stanford',
        r'Yale',
        r'Harvard',
        r'Caltech',
        r'UC \w+',
        r'University of \w+',
        r'\w+ University',
        r'IIT \w+',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            found = match.group()
            for uni, abbrev in UNIVERSITY_ABBREV.items():
                if uni.lower() in found.lower():
                    return abbrev
            # 약자 생성
            words = found.split()
            if len(words) >= 2:
                return ''.join(w[0].upper() for w in words[:3])
            return found.upper()[:5]

    return 'MISC'

def extract_platform(text, url):
    """플랫폼 추출 (YouTube 우선)"""
    if 'youtube.com' in url.lower() or 'youtu.be' in url.lower():
        return 'YouTube'
    if 'ocw.mit.edu' in url.lower():
        return 'MIT_OCW'
    if 'coursera' in url.lower():
        return 'Coursera'
    if 'edx' in url.lower():
        return 'edX'
    if 'academictorrents' in url.lower():
        return 'AcademicTorrents'
    if 'oyc.yale.edu' in url.lower():
        return 'Yale_OCW'
    if 'ocw.uci.edu' in url.lower():
        return 'UCI_OCW'
    if 'pirsa.org' in url.lower():
        return 'PIRSA'
    return 'Other'

def extract_urls(text):
    """텍스트에서 모든 URL 추출, YouTube 우선"""
    urls = re.findall(r'https?://[^\s\)\]]+', text)
    if not urls:
        return None, None

    # YouTube 우선
    youtube_urls = [u for u in urls if 'youtube' in u.lower() or 'youtu.be' in u.lower()]
    if youtube_urls:
        return youtube_urls[0].rstrip(')'), 'YouTube'

    # OCW 다음
    ocw_urls = [u for u in urls if 'ocw' in u.lower()]
    if ocw_urls:
        platform = 'MIT_OCW' if 'mit' in ocw_urls[0].lower() else 'OCW'
        return ocw_urls[0].rstrip(')'), platform

    return urls[0].rstrip(')'), extract_platform(text, urls[0])

def determine_level(title, course_num=None):
    """난이도 결정"""
    title_lower = title.lower()

    # Advanced 키워드
    advanced_keywords = ['advanced', 'graduate', 'qft', 'quantum field theory',
                        'string theory', 'supersymmetry', 'effective field',
                        'holographic', 'particle physics', 'neutrino', 'black hole']
    if any(kw in title_lower for kw in advanced_keywords):
        return 'advanced'

    # 코스 번호로 판단
    if course_num:
        try:
            num = int(re.search(r'\d+', course_num).group())
            if num >= 500:
                return 'advanced'
            elif num >= 200:
                return 'intermediate'
            else:
                return 'intro'
        except:
            pass

    # Intro 키워드
    intro_keywords = ['introduction', 'introductory', 'fundamentals', 'basic',
                     ' i:', ' i,', ' 1:', ' 1,', 'physics i', 'math i',
                     'intro to', 'intro ']
    if any(kw in title_lower for kw in intro_keywords):
        return 'intro'

    # II, III 등은 intermediate
    if re.search(r'\b(ii|iii|2|3)\b', title_lower):
        return 'intermediate'

    return 'intermediate'  # 기본값

def generate_course_id(university, title):
    """course_id 생성"""
    # 코스 번호 추출 시도
    course_num_match = re.search(r'(\d+[\.\-]?\d*)', title)
    if course_num_match:
        course_num = course_num_match.group().replace('.', '_').replace('-', '_')
        return f"{university}_{course_num}"

    # 없으면 해시 기반
    hash_val = hashlib.md5(title.encode()).hexdigest()[:6]
    return f"{university}_{hash_val.upper()}"

def parse_readme(filepath):
    """README 파싱"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    courses = []
    failed = []

    current_category = None
    current_subcategory = None

    lines = content.split('\n')

    for i, line in enumerate(lines):
        original_line = line
        line_stripped = line.strip()

        # 대분류 (## Physics, ## Mathematics, ## Chemistry)
        if line_stripped.startswith('## '):
            category_text = line_stripped[3:].strip().lower()
            if 'physics' in category_text:
                current_category = 'physics'
            elif 'math' in category_text:
                current_category = 'mathematics'
            elif 'chem' in category_text:
                current_category = 'chemistry'
            elif 'computer' in category_text or 'cs' in category_text:
                current_category = 'cs'
            elif 'biology' in category_text or 'bio' in category_text:
                current_category = 'biology'
            else:
                current_category = None
            continue

        # 소분류 (- **소분류**)
        if line_stripped.startswith('- **') and '**' in line_stripped[4:]:
            subcategory_text = line_stripped[4:line_stripped.index('**', 4)]
            current_subcategory = SUBCATEGORY_MAP.get(subcategory_text, 'general')
            continue

        # 강의 항목 (탭+대시+링크 또는 - [링크])
        # 원본 라인에서 들여쓰기 확인
        is_indented = original_line.startswith('\t') or original_line.startswith('  ')
        has_link = '[' in line_stripped and ']' in line_stripped and '(' in line_stripped
        if is_indented and line_stripped.startswith('- ') and has_link:
            if not current_category:
                continue

            try:
                # 제목 추출
                title_match = re.search(r'\[([^\]]+)\]', line)
                if not title_match:
                    continue

                title = title_match.group(1)

                # URL 추출
                url, platform = extract_urls(line)
                if not url:
                    failed.append(f"Line {i}: No URL - {line[:80]}")
                    continue

                # 대학 추출
                university = extract_university(line)

                # course_id 생성
                course_id = generate_course_id(university, title)

                # 중복 체크 및 고유화
                existing_ids = [c['course_id'] for c in courses]
                if course_id in existing_ids:
                    suffix = 1
                    while f"{course_id}_{suffix}" in existing_ids:
                        suffix += 1
                    course_id = f"{course_id}_{suffix}"

                # 난이도 결정
                level = determine_level(title)

                course = {
                    'course_id': course_id,
                    'title': title,
                    'university': university,
                    'platform': platform,
                    'url': url,
                    'category': current_category,
                    'subcategory': current_subcategory or 'general',
                    'level': level,
                }

                courses.append(course)

            except Exception as e:
                failed.append(f"Line {i}: {e} - {line[:80]}")
                continue

    return courses, failed

def main():
    print("=== University Courses Parser ===")

    if not INPUT_FILE.exists():
        print(f"Error: Input file not found: {INPUT_FILE}")
        return

    courses, failed = parse_readme(INPUT_FILE)

    # 결과 저장
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(courses, f, ensure_ascii=False, indent=2)

    print(f"\n총 강의 수: {len(courses)}")
    print(f"파싱 실패: {len(failed)}")
    print(f"출력 파일: {OUTPUT_FILE}")

    # 카테고리별 통계
    categories = {}
    for c in courses:
        cat = c['category']
        categories[cat] = categories.get(cat, 0) + 1

    print("\n카테고리별:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    # 난이도별 통계
    levels = {}
    for c in courses:
        lvl = c['level']
        levels[lvl] = levels.get(lvl, 0) + 1

    print("\n난이도별:")
    for lvl, count in sorted(levels.items()):
        print(f"  {lvl}: {count}")

    # 실패 로그
    if failed:
        print(f"\n파싱 실패 항목 ({len(failed)}개):")
        for f_msg in failed[:10]:
            print(f"  {f_msg}")
        if len(failed) > 10:
            print(f"  ... 외 {len(failed) - 10}개")

if __name__ == '__main__':
    main()
