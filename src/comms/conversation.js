import { EVENTS } from './context.js';
import { requestWingman, UNAVAILABLE } from './wingman-client.js';

export function boundedHistory(history) {
  let size = 0;
  return history.slice(-12).reverse().filter(turn => {
    size += turn.content.length;
    return size <= 6000;
  }).reverse().map(({ role, content }) => ({ role, content }));
}

// Owns network/history only. No access to wingman controls, weapons or game mutation.
export function createConversation({ getContext, onChange = () => {}, onFailure = () => {},
  onCancel = () => {},
  request = requestWingman, now = () => performance.now() }) {
  let history = [], recentEvents = [], seen = new Set(), serial = 0, eventSerial = 0;
  let pending = null, scope = '', available = null;
  let lastPlayer = '', text = '', error = '', mode = 'HANGAR', emotion = 'calm';
  const snapshot = () => ({ pending: !!pending, available, player: lastPlayer, text, error, mode, emotion });
  const emit = () => onChange(snapshot());
  const eventTypes = () => recentEvents.filter(e => now() - e.time < 60000).map(e => e.type);

  function cancel() {
    serial++;
    pending?.controller.abort(); pending = null;
    onCancel();
    emit();
  }
  async function send(message) {
    if (pending || !message?.trim()) return false;
    cancel();
    const controller = new AbortController(), id = ++serial;
    pending = { controller };
    lastPlayer = message.trim().slice(0, 1000);
    text = '';
    error = ''; emit();
    try {
      const context = getContext(eventTypes());
      const reply = await request({ context, message: lastPlayer,
        history: boundedHistory(history) }, { signal: controller.signal });
      if (id !== serial) return false;
      available = true;
      text = reply.text;
      mode = context.mode;
      emotion = reply.emotion;
      history = boundedHistory([...history, { role: 'user', content: lastPlayer }, { role: 'assistant', content: text }]);
      emit();
      return true;
    } catch {
      if (id !== serial) return false;
      available = false; error = UNAVAILABLE; text = '';
      onFailure();
      return false;
    } finally {
      if (id === serial) { pending = null; emit(); }
    }
  }
  return {
    send, cancel,
    snapshot,
    setScope(next) {
      if (scope !== next) { scope = next; cancel(); text = ''; error = available === false ? UNAVAILABLE : ''; emit(); }
    },
    clearEvents() { recentEvents = []; },
    reset() {
      cancel(); history = []; recentEvents = []; seen = new Set();
      lastPlayer = ''; text = ''; error = ''; emit();
    },
    record(type, { id = ++eventSerial } = {}) {
      if (!EVENTS.includes(type) || seen.has(id)) return false;
      seen.add(id); if (seen.size > 64) seen.delete(seen.values().next().value);
      recentEvents = [...recentEvents, { type, time: now() }].slice(-8);
      return true;
    },
  };
}
