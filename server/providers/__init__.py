from .base import LLMProvider, ProviderUnavailable
from .gemini import GeminiProvider
from .ollama import OllamaProvider


def create_provider(settings):
    if settings.provider == 'gemini':
        if not settings.api_key:
            raise ProviderUnavailable('Gemini API key is not configured')
        return GeminiProvider(settings)
    if settings.provider == 'ollama':
        return OllamaProvider(settings)
    raise ProviderUnavailable('Unsupported provider configuration')
