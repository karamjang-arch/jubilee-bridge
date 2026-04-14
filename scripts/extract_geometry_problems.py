#!/usr/bin/env python3
"""
Phase 1: Extract geometry problems that need SVG visualization.
Target: Problems involving shapes, triangles, circles, angles, coordinates.
"""

import json
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
QUESTIONS_FILE = PROJECT_ROOT / 'public' / 'data' / 'cb-questions-math.json'
OUTPUT_FILE = PROJECT_ROOT / 'data' / 'geometry_problems_need_svg.json'

# Keywords indicating geometry problems that benefit from visualization
# Primary shape keywords (must have one of these)
SHAPE_KEYWORDS = [
    'triangle', 'rectangle', 'square', 'circle', 'hexagon', 'pentagon',
    'quadrilateral', 'polygon', 'rhombus', 'trapezoid', 'parallelogram',
    'right triangle', 'isosceles', 'equilateral', 'scalene'
]

# Measurement indicators (must have numeric values)
import re
HAS_MEASUREMENT = re.compile(r'\d+\s*(cm|inches?|feet|foot|meters?|units?|degrees?|°)')


def needs_svg(question_text: str) -> bool:
    """
    Determine if a question would benefit from SVG visualization.
    Strict filter: Must have a shape AND measurements.
    """
    text_lower = question_text.lower()

    # Must mention a specific shape
    has_shape = any(shape in text_lower for shape in SHAPE_KEYWORDS)
    if not has_shape:
        return False

    # Must have numeric measurements
    has_measurement = bool(HAS_MEASUREMENT.search(question_text))

    return has_measurement


def extract_geometry_problems():
    """Extract all geometry problems from the math questions file."""

    with open(QUESTIONS_FILE, 'r', encoding='utf-8') as f:
        questions_data = json.load(f)

    geometry_problems = []
    concept_count = 0

    for concept_id, questions in questions_data.items():
        # Focus ONLY on geometry concepts (have -G- in ID)
        is_geometry_concept = '-G-' in concept_id
        if not is_geometry_concept:
            continue

        concept_count += 1

        for q in questions:
            question_text = q.get('question', '')

            # Only include if the question actually needs SVG (shape + measurements)
            if needs_svg(question_text):
                problem = {
                    'concept_id': concept_id,
                    'question_id': q.get('id'),
                    'question': question_text,
                    'choices': q.get('choices', []),
                    'answer': q.get('answer'),
                    'explanation': q.get('explanation', ''),
                    'difficulty': q.get('difficulty', 'medium'),
                    'needs_svg': True,
                    'svg_generated': False
                }
                geometry_problems.append(problem)

    # Create output
    output = {
        'generated_at': __import__('datetime').datetime.now().isoformat(),
        'total_problems': len(geometry_problems),
        'geometry_concepts': concept_count,
        'problems': geometry_problems
    }

    # Save to file
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Extracted {len(geometry_problems)} geometry problems from {concept_count} geometry concepts")
    print(f"Output saved to: {OUTPUT_FILE}")

    # Print sample
    if geometry_problems:
        print("\n--- Sample problems ---")
        for p in geometry_problems[:3]:
            print(f"  [{p['concept_id']}] {p['question'][:80]}...")

    return geometry_problems


if __name__ == "__main__":
    extract_geometry_problems()
