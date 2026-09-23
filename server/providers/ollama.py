import json

import httpx

from ..context import GeneratedReply
from .base import ProviderUnavailable


class OllamaProvider:
    def __init__(self, settings, transport=None):
        self.settings = settings
        self.transport = transport

    async def generate(self, messages, *, max_tokens):
        try:
            async with httpx.AsyncClient(timeout=self.settings.timeout, transport=self.transport,
                                         trust_env=False) as client:
                response = await client.post(self.settings.base_url.rstrip('/') + '/api/chat', json={
                    'model': self.settings.model,
                    'messages': messages,
                    'stream': False,
                    'think': False,
                    'format': GeneratedReply.model_json_schema(),
                    # Full canonical lore + bounded dialogue fit without silent truncation.
                    'options': {'num_ctx': 32768, 'num_predict': max_tokens, 'temperature': 0.6},
                })
                response.raise_for_status()
                data = response.json()
                if data.get('done') is not True or data.get('done_reason') == 'length':
                    raise ValueError('Incomplete model response')
                # Deliberately never read message.thinking or raw provider metadata.
                return json.loads(data['message']['content'])
        except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as error:
            raise ProviderUnavailable('LLM unavailable or invalid response') from error
