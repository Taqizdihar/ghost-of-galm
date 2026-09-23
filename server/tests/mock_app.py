"""Explicit test-only server: python -m uvicorn server.tests.mock_app:app.

Never selected by production configuration and never an offline dialogue fallback.
"""
import asyncio
import json

from server.app import create_app


class BrowserTestProvider:
    async def generate(self, messages, *, max_tokens):
        await asyncio.sleep(.35)
        context = json.loads(messages[1]['content'].split('\n')[1])
        if context['mode'] == 'COMBAT':
            return {'text': 'Mock transmission received, Kid.', 'emotion': 'focused'}
        return {'text': 'Mock transmission received, Kid. This is a test of the text channel, with a longer response for the hangar display.', 'emotion': 'calm'}


app = create_app(BrowserTestProvider())
