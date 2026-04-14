"""
설정 파일에서 API 키 로드
config.yaml 또는 환경변수에서 Gemini API 키 가져오기
"""

import os
from pathlib import Path

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


def load_gemini_api_key():
    """config.yaml 또는 환경변수에서 API 키 로드"""
    # 1. 환경변수 우선
    if os.environ.get('GEMINI_API_KEY'):
        return os.environ['GEMINI_API_KEY']

    # 2. config.yaml 확인
    config_paths = [
        Path(__file__).parent.parent.parent / 'config.yaml',  # jubilee-bridge/config.yaml
        Path.home() / 'config.yaml',  # ~/config.yaml
    ]

    if HAS_YAML:
        for config_path in config_paths:
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config = yaml.safe_load(f)
                    if config and config.get('gemini_api_key'):
                        return config['gemini_api_key']

    raise ValueError(
        "GEMINI_API_KEY not found.\n"
        "Set via:\n"
        "  1) GEMINI_API_KEY env var\n"
        "  2) config.yaml with 'gemini_api_key' field"
    )
