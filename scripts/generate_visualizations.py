#!/usr/bin/env python3
"""
Generate interactive HTML visualizations for concepts using Gemini.
Target: 20 concepts (10 math + 10 physics)
"""

import json
import os
import time
import re
from pathlib import Path

# Load config
try:
    from lib.config import get_gemini_api_key
    GEMINI_API_KEY = get_gemini_api_key()
except ImportError:
    import yaml
    config_path = Path(__file__).parent.parent / 'config.yaml'
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
            GEMINI_API_KEY = config.get('gemini_api_key', os.environ.get('GEMINI_API_KEY'))
    else:
        GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

GEMINI_MODEL = 'gemini-2.5-flash-lite'
OUTPUT_DIR = Path(__file__).parent.parent / 'public' / 'visualizations'

# Target concepts for visualization (manually curated for best visual impact)
TARGET_CONCEPTS = [
    # Math - Interactive Visualizations
    {"id": "MATH-SLOPE-001", "title": "Slope of a Line", "description": "Interactive slope calculator with two draggable points"},
    {"id": "MATH-QUAD-001", "title": "Quadratic Function Graph", "description": "Parabola with sliders for a, b, c coefficients"},
    {"id": "MATH-LINEAR-001", "title": "Linear Equations", "description": "y = mx + b with interactive slope and intercept"},
    {"id": "MATH-CIRCLE-001", "title": "Circle Area and Circumference", "description": "Circle with adjustable radius showing area/circumference"},
    {"id": "MATH-TRIANGLE-001", "title": "Triangle Area", "description": "Triangle with draggable vertices showing area calculation"},
    {"id": "MATH-PROB-001", "title": "Probability Basics", "description": "Interactive dice roller with histogram"},
    {"id": "MATH-COORD-001", "title": "Coordinate Plane", "description": "Plot points and see coordinates in all quadrants"},
    {"id": "MATH-PYTHAGOREAN-001", "title": "Pythagorean Theorem", "description": "Right triangle with squares on each side"},
    {"id": "MATH-SINE-001", "title": "Sine Wave", "description": "Interactive sine wave with amplitude and frequency controls"},
    {"id": "MATH-EXPO-001", "title": "Exponential Growth", "description": "Exponential function with base slider"},

    # Physics - Interactive Simulations
    {"id": "PHY-FORCE-001", "title": "Force and Motion (Newton's Second Law)", "description": "Ball with adjustable force and mass, shows F=ma"},
    {"id": "PHY-GRAVITY-001", "title": "Projectile Motion", "description": "Projectile with angle and velocity sliders"},
    {"id": "PHY-WAVE-001", "title": "Wave Properties", "description": "Wave with wavelength and frequency controls"},
    {"id": "PHY-PENDULUM-001", "title": "Simple Pendulum", "description": "Pendulum with length and angle controls"},
    {"id": "PHY-SPRING-001", "title": "Spring Oscillation (Hooke's Law)", "description": "Spring with mass and spring constant"},
    {"id": "PHY-CIRCUIT-001", "title": "Simple Circuit (Ohm's Law)", "description": "Circuit with voltage and resistance controls"},
    {"id": "PHY-MOMENTUM-001", "title": "Conservation of Momentum", "description": "Two balls collision simulation"},
    {"id": "PHY-ENERGY-001", "title": "Kinetic and Potential Energy", "description": "Ball on ramp showing energy conversion"},
    {"id": "PHY-REFRACTION-001", "title": "Light Refraction", "description": "Light beam entering different media"},
    {"id": "PHY-DOPPLER-001", "title": "Doppler Effect", "description": "Moving source with wave visualization"},
]

PROMPT_TEMPLATE = '''Create a self-contained HTML widget (single file, no external dependencies except CDN libraries) that visually explains the concept: {title}

Description: {description}

Requirements:
- Interactive: sliders, buttons, or drag to manipulate parameters
- Visual: use Canvas or SVG to draw the concept
- Educational: show how changing inputs affects outputs
- Size: max 300 lines of code
- Style: clean, modern design with white background
- Include a brief text explanation (2-3 sentences) at the top
- Use inline CSS (no external stylesheets)
- Make it responsive (works in 400px width container)

Technical requirements:
- Use vanilla JavaScript only (no frameworks)
- For math rendering, you may use simple HTML/CSS (no KaTeX needed for simple formulas)
- Canvas preferred for animations, SVG for static diagrams
- Include comments explaining key parts

Return ONLY the HTML code, no markdown wrapping, no explanation before or after.'''


def call_gemini(prompt: str) -> str:
    """Call Gemini API to generate HTML."""
    import urllib.request
    import urllib.error

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 4096,
            "temperature": 0.7,
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


def clean_html(html: str) -> str:
    """Clean up HTML response from Gemini."""
    if not html:
        return None

    # Remove markdown code blocks if present
    html = re.sub(r'^```html?\s*\n?', '', html, flags=re.IGNORECASE)
    html = re.sub(r'\n?```\s*$', '', html)
    html = html.strip()

    # Basic validation
    if not html.startswith('<!DOCTYPE') and not html.startswith('<html') and not html.startswith('<'):
        print("Warning: Response doesn't look like HTML")
        return None

    # Ensure it has basic HTML structure
    if '<html' not in html.lower():
        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visualization</title>
</head>
<body>
{html}
</body>
</html>'''

    return html


def generate_visualization(concept: dict) -> bool:
    """Generate visualization for a single concept."""
    concept_id = concept['id']
    title = concept['title']
    description = concept['description']

    print(f"\n[{concept_id}] Generating: {title}")

    prompt = PROMPT_TEMPLATE.format(title=title, description=description)
    html = call_gemini(prompt)

    if not html:
        print(f"  ❌ Failed to generate")
        return False

    html = clean_html(html)
    if not html:
        print(f"  ❌ Invalid HTML response")
        return False

    # Save to file
    output_path = OUTPUT_DIR / f"{concept_id}.html"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    # Check file size
    size = output_path.stat().st_size
    print(f"  ✅ Saved ({size:,} bytes)")

    return True


def main():
    print("=" * 60)
    print("Concept Visualization Generator")
    print("=" * 60)
    print(f"Model: {GEMINI_MODEL}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Concepts: {len(TARGET_CONCEPTS)}")
    print("=" * 60)

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    success = 0
    failed = 0

    for i, concept in enumerate(TARGET_CONCEPTS):
        print(f"\n[{i+1}/{len(TARGET_CONCEPTS)}]", end="")

        if generate_visualization(concept):
            success += 1
        else:
            failed += 1

        # Rate limiting: 5 second delay between requests
        if i < len(TARGET_CONCEPTS) - 1:
            print("  ⏳ Waiting 5 seconds...")
            time.sleep(5)

    print("\n" + "=" * 60)
    print(f"DONE: {success} success, {failed} failed")
    print("=" * 60)

    # Generate index file
    index = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "concepts": [c['id'] for c in TARGET_CONCEPTS if (OUTPUT_DIR / f"{c['id']}.html").exists()]
    }
    with open(OUTPUT_DIR / "index.json", 'w') as f:
        json.dump(index, f, indent=2)
    print(f"Index saved: {len(index['concepts'])} visualizations")


if __name__ == "__main__":
    main()
