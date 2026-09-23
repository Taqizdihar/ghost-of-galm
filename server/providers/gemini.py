import json
from urllib.parse import quote

import httpx

from .base import ProviderUnavailable

GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models'
REPLY_SCHEMA = {
    'type': 'object',
    'properties': {
        'text': {'type': 'string'},
        'emotion': {
            'type': 'string',
            'enum': ['calm', 'focused', 'urgent', 'concerned', 'amused',
                     'reflective', 'strained', 'relieved'],
        },
    },
    'required': ['text', 'emotion'],
}


class GeminiProvider:
    def __init__(self, settings, transport=None):
        self.settings = settings
        self.transport = transport

    async def generate(self, messages, *, max_tokens):
        try:
            system_text = '\n\n'.join(
                message['content'] for message in messages
                if message.get('role') == 'system'
            )
            contents = []
            for message in messages:
                role = message.get('role')
                if role == 'system':
                    continue
                if role not in ('user', 'assistant') or not isinstance(message.get('content'), str):
                    raise ValueError('Unsupported conversation message')
                contents.append({
                    'role': 'model' if role == 'assistant' else 'user',
                    'parts': [{'text': message['content']}],
                })
            if not system_text or not contents:
                raise ValueError('Incomplete conversation')

            url = f'{GEMINI_API_ROOT}/{quote(self.settings.model, safe="")}:generateContent'
            request_body = {
                'systemInstruction': {'parts': [{'text': system_text}]},
                'contents': contents,
                'generationConfig': {
                    'maxOutputTokens': max_tokens,
                    'temperature': 0.6,
                    'thinkingConfig': {'thinkingLevel': 'minimal'},
                    'responseMimeType': 'application/json',
                    'responseJsonSchema': REPLY_SCHEMA,
                },
            }
            async with httpx.AsyncClient(timeout=self.settings.timeout, transport=self.transport) as client:
                response = await client.post(url, headers={
                    'x-goog-api-key': self.settings.api_key,
                    'Content-Type': 'application/json',
                }, json=request_body)
                response.raise_for_status()
                data = response.json()

            candidate = data['candidates'][0]
            if candidate.get('finishReason') != 'STOP':
                raise ValueError('Incomplete model response')
            parts = candidate['content']['parts']
            final_text = ''.join(
                part['text'] for part in parts
                if isinstance(part.get('text'), str) and not part.get('thought', False)
            )
            if not final_text:
                raise ValueError('Empty model response')
            return json.loads(final_text)
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, AttributeError) as error:
            raise ProviderUnavailable('LLM unavailable or invalid response') from error
