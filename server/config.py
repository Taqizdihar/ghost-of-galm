import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    provider: str = 'ollama'
    model: str = 'qwen3:8b'
    base_url: str = 'http://127.0.0.1:11434'
    timeout: float = 20

    @classmethod
    def from_env(cls):
        load_dotenv(ROOT / '.env', override=False)
        return cls(
            provider=os.getenv('WINGMAN_LLM_PROVIDER', 'ollama'),
            model=os.getenv('WINGMAN_LLM_MODEL', 'qwen3:8b'),
            base_url=os.getenv('WINGMAN_LLM_BASE_URL', 'http://127.0.0.1:11434'),
            timeout=max(1, min(120, float(os.getenv('WINGMAN_LLM_TIMEOUT_SECONDS', '20')))),
        )
