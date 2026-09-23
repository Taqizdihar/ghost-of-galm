from typing import Protocol


class ProviderUnavailable(Exception):
    """Provider failures are mapped to one public, non-sensitive error."""


class LLMProvider(Protocol):
    async def generate(self, messages: list[dict], *, max_tokens: int) -> dict:
        """Return only structured final dialogue, never reasoning or tool calls."""
        ...
