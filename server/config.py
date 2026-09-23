import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    provider: str = 'gemini'
    model: str = 'gemini-3.1-flash-lite'
    base_url: str = 'http://127.0.0.1:11434'
    api_key: str = ''
    timeout: float = 20

    @classmethod
    def from_env(cls):
        load_dotenv(ROOT / '.env', override=False)
        return cls(
            provider=os.getenv('WINGMAN_LLM_PROVIDER', 'gemini').strip().lower(),
            model=os.getenv('WINGMAN_LLM_MODEL', 'gemini-3.1-flash-lite').strip(),
            base_url=os.getenv('WINGMAN_LLM_BASE_URL', 'http://127.0.0.1:11434'),
            api_key=os.getenv('GEMINI_API_KEY', '').strip(),
            timeout=max(1, min(120, float(os.getenv('WINGMAN_LLM_TIMEOUT_SECONDS', '20')))),
        )
