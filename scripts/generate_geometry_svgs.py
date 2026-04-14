#!/usr/bin/env python3
"""
Phase 2: Generate SVG visualizations for geometry problems using Gemini.
Target: 121 geometry problems with shape + measurement descriptions.
"""

import json
import os
import time
import re
from pathlib import Path

# Load API key from environment variable or .env.local
def load_api_key():
    key = os.environ.get('GEMINI_API_KEY')
    if key:
        return key

    env_path = Path(__file__).parent.parent / '.env.local'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('GEMINI_API_KEY='):
                    return line.split('=', 1)[1].strip()

    raise ValueError("GEMINI_API_KEY not found in environment or .env.local")


GEMINI_API_KEY = load_api_key()
GEMINI_MODEL = 'gemini-2.5-flash-lite'

PROJECT_ROOT = Path(__file__).parent.parent
INPUT_FILE = PROJECT_ROOT / 'data' / 'geometry_problems_need_svg.json'
OUTPUT_DIR = PROJECT_ROOT / 'public' / 'geometry-svgs'

PROMPT_TEMPLATE = '''Generate a clean SVG diagram for this geometry problem. The SVG should help a student visualize the problem.

Problem: {question}

Requirements:
1. Output ONLY valid SVG code (no markdown, no explanation)
2. SVG dimensions: viewBox="0 0 400 300"
3. Use a white background
4. Draw the shape accurately with:
   - Clean black stroke (stroke-width: 2)
   - Light fill color (e.g., #e3f2fd for shapes)
   - Label all given measurements clearly
   - Use clear, readable fonts (font-size: 14-16px)
5. For triangles: show right angle markers if applicable
6. For rectangles/squares: show equal side marks if applicable
7. Position the shape centered in the viewBox
8. Include measurement labels positioned outside the shape

Example output format:
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="200" height="100" fill="#e3f2fd" stroke="black" stroke-width="2"/>
  <text x="150" y="170" text-anchor="middle" font-size="14">200 cm</text>
</svg>

Generate the SVG now:'''


def call_gemini(prompt: str) -> str:
    """Call Gemini API to generate SVG."""
    import urllib.request
    import urllib.error

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 2048,
            "temperature": 0.3,  # Lower temperature for more consistent output
        }
    }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode('utf-8'))
            text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            return text
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode()}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None


def clean_svg(svg_text: str) -> str:
    """Extract and clean SVG from response."""
    if not svg_text:
        return None

    # Remove markdown code blocks if present
    svg_text = re.sub(r'^```(?:xml|svg)?\s*\n?', '', svg_text, flags=re.IGNORECASE)
    svg_text = re.sub(r'\n?```\s*$', '', svg_text)
    svg_text = svg_text.strip()

    # Extract SVG tag if there's extra text
    svg_match = re.search(r'<svg[^>]*>.*?</svg>', svg_text, re.DOTALL | re.IGNORECASE)
    if svg_match:
        svg_text = svg_match.group(0)

    # Validate it's an SVG
    if not svg_text.lower().startswith('<svg'):
        print("  Warning: Response doesn't look like SVG")
        return None

    return svg_text


def generate_svg_for_problem(problem: dict) -> bool:
    """Generate SVG for a single geometry problem."""
    concept_id = problem['concept_id']
    question_id = problem['question_id']
    question = problem['question']

    file_id = f"{concept_id}_q{question_id}"
    output_path = OUTPUT_DIR / f"{file_id}.svg"

    # Skip if already generated
    if output_path.exists():
        print(f"  [SKIP] {file_id} already exists")
        return True

    prompt = PROMPT_TEMPLATE.format(question=question)
    svg = call_gemini(prompt)

    if not svg:
        print(f"  [FAIL] {file_id} - No response from Gemini")
        return False

    svg = clean_svg(svg)
    if not svg:
        print(f"  [FAIL] {file_id} - Invalid SVG response")
        return False

    # Save SVG file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg)

    size = output_path.stat().st_size
    print(f"  [OK] {file_id} ({size:,} bytes)")

    return True


def main():
    print("=" * 60)
    print("Geometry SVG Generator")
    print("=" * 60)
    print(f"Model: {GEMINI_MODEL}")
    print(f"Output: {OUTPUT_DIR}")

    # Load problems
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    problems = data['problems']
    total = len(problems)
    print(f"Problems: {total}")
    print("=" * 60)

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    success = 0
    failed = 0
    skipped = 0

    for i, problem in enumerate(problems):
        print(f"\n[{i+1}/{total}]", end="")

        output_path = OUTPUT_DIR / f"{problem['concept_id']}_q{problem['question_id']}.svg"
        if output_path.exists():
            skipped += 1
            print(f"  [SKIP] Already exists")
            continue

        if generate_svg_for_problem(problem):
            success += 1
        else:
            failed += 1

        # Rate limiting: 3 second delay between requests
        if i < total - 1:
            time.sleep(3)

    print("\n" + "=" * 60)
    print(f"DONE: {success} generated, {skipped} skipped, {failed} failed")
    print("=" * 60)

    # Update input file with generation status
    for problem in problems:
        file_id = f"{problem['concept_id']}_q{problem['question_id']}"
        svg_path = OUTPUT_DIR / f"{file_id}.svg"
        problem['svg_generated'] = svg_path.exists()
        if svg_path.exists():
            problem['svg_path'] = f"/geometry-svgs/{file_id}.svg"

    data['last_generation'] = time.strftime("%Y-%m-%d %H:%M:%S")
    data['generated_count'] = sum(1 for p in problems if p.get('svg_generated'))

    with open(INPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Updated {INPUT_FILE.name}: {data['generated_count']}/{total} have SVGs")

    # Generate index file
    index = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_problems": total,
        "generated_svgs": data['generated_count'],
        "problems": [
            {
                "concept_id": p['concept_id'],
                "question_id": p['question_id'],
                "svg_path": p.get('svg_path')
            }
            for p in problems if p.get('svg_generated')
        ]
    }
    with open(OUTPUT_DIR / "index.json", 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2)
    print(f"Index saved: {OUTPUT_DIR / 'index.json'}")


if __name__ == "__main__":
    main()
