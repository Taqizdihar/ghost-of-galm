from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Mode = Literal['COMBAT', 'INTERMISSION', 'HANGAR']
Event = Literal['PLAYER_DESTROYED_TARGET', 'PLAYER_HIT', 'WINGMAN_HIT',
                'DETECTED_HOSTILE_DESTROYED', 'COMBAT_STARTED', 'COMBAT_ENDED', 'GAME_OVER']
Emotion = Literal['calm', 'focused', 'urgent', 'concerned', 'amused', 'reflective', 'strained', 'relieved']


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Wingman(StrictModel):
    aircraft: Literal['The Ghost of Galm', "Pixy's Prototype"]
    hp: int = Field(ge=0, le=2000)
    maxHP: int = Field(ge=1, le=2000)
    alive: bool
    state: Literal['FORMATION', 'ENGAGE', 'EVADE', 'REGROUP', 'DESTROYED']
    special: Literal['NONE', 'READY', 'ACTIVE', 'COOLDOWN']

    @model_validator(mode='after')
    def consistent(self):
        maximum = 1500 if self.aircraft == 'The Ghost of Galm' else 2000
        if self.maxHP != maximum or self.hp > maximum or self.alive != (self.hp > 0):
            raise ValueError('Inconsistent wingman condition')
        if (self.state == 'DESTROYED') == self.alive:
            raise ValueError('Inconsistent wingman state')
        return self


class Contact(StrictModel):
    type: Literal['MIG-29', 'SU-27', 'UNKNOWN']
    bearing: int = Field(ge=0, lt=360)
    range: int = Field(ge=0, le=8000)
    selected: bool


class WingmanContext(StrictModel):
    mode: Mode
    wingman: Wingman | None = None
    contacts: list[Contact] = Field(default_factory=list, max_length=16)
    events: list[Event] = Field(default_factory=list, max_length=8)


class HistoryTurn(StrictModel):
    role: Literal['user', 'assistant']
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(StrictModel):
    context: WingmanContext
    message: str = Field(default='', max_length=1000)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=20)
    event: Event | None = None

    @model_validator(mode='after')
    def valid_request(self):
        self.message = self.message.strip()
        if bool(self.message) == bool(self.event):
            raise ValueError('Supply either a message or a confirmed event')
        if self.event and self.event not in self.context.events:
            raise ValueError('Reaction event must be present in approved context')
        return self


class GeneratedReply(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    emotion: Emotion = 'calm'


class ChatResponse(GeneratedReply):
    mode: Mode


def bounded_history(history: list[HistoryTurn]) -> list[dict]:
    """At most 12 messages and 6,000 characters, newest first for budgeting."""
    result, remaining = [], 6000
    for turn in reversed(history[-12:]):
        if len(turn.content) > remaining:
            break
        result.append(turn.model_dump())
        remaining -= len(turn.content)
    return list(reversed(result))
