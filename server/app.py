import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import Settings
from .context import ChatRequest, ChatResponse
from .conversation import build_messages, validate_reply
from .lore import load_lorebook
from .providers import create_provider

UNAVAILABLE = 'COMMS INTERRUPTED. TEMPORARILY UNAVAILABLE.'


def create_app(provider=None, settings=None, lore_loader=load_lorebook):
    app = FastAPI(title='Ghost of Galm — Wingman Comms', docs_url=None, redoc_url=None)
    # Local-only service. No wildcard CORS; Vite proxies the relative endpoint.
    busy = False

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request, _error):
        # Do not echo submitted history or arbitrary extra fields in error responses.
        return JSONResponse(status_code=422, content={'detail': 'Invalid conversation request.'})

    @app.post('/api/wingman/chat', response_model=ChatResponse)
    async def chat(request: ChatRequest):
        nonlocal busy
        if busy:
            raise HTTPException(status_code=503, detail=UNAVAILABLE)
        busy = True
        try:
            config = settings or Settings.from_env()
            llm = provider or create_provider(config)
            lorebook = lore_loader()
            limit = 160 if request.event or request.context.mode == 'COMBAT' else 300 if request.context.mode == 'INTERMISSION' else 900
            raw = await asyncio.wait_for(llm.generate(build_messages(request, lorebook), max_tokens=limit), config.timeout)
            return validate_reply(raw, request)
        except Exception:
            # Network/config/lore/provider failures must not leak prompts or internals.
            raise HTTPException(status_code=503, detail=UNAVAILABLE) from None
        finally:
            busy = False

    return app


app = create_app()
