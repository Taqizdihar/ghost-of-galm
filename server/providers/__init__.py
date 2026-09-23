from .base import LLMProvider, ProviderUnavailable
from .ollama import OllamaProvider


def create_provider(settings):
    if settings.provider != 'ollama':
        raise ProviderUnavailable('Unsupported provider configuration')
    return OllamaProvider(settings)
