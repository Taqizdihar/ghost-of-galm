from pathlib import Path

from .config import ROOT

LOREBOOK_PATH = ROOT / 'docs' / 'wingman' / 'lorebook.md'


def load_lorebook(path: Path = LOREBOOK_PATH) -> str:
    """Read the sole canonical source. Never substitute an invented persona."""
    text = path.read_text(encoding='utf-8')
    if '`CANONICAL`' not in text or 'Larry' not in text:
        raise ValueError('Canonical lorebook missing or invalid')
    return text
