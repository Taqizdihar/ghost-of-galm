export const UNAVAILABLE = 'COMMS INTERRUPTED. TEMPORARILY UNAVAILABLE.';
const MODES = ['COMBAT', 'INTERMISSION', 'HANGAR'];
const EMOTIONS = ['calm', 'focused', 'urgent', 'concerned', 'amused', 'reflective', 'strained', 'relieved'];

export async function requestWingman(payload, { signal, timeoutMs = 25000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timeout = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetchImpl('/api/wingman/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    if (!response.ok) throw new Error(UNAVAILABLE);
    const data = await response.json();
    if (!data || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 2000 ||
        !EMOTIONS.includes(data.emotion ?? 'calm') ||
        !MODES.includes(data.mode) || data.mode !== payload.context.mode || /<\s*\/?\s*(think|analysis|reasoning)\b/i.test(data.text)) {
      throw new Error(UNAVAILABLE);
    }
    return { text: data.text.trim(), mode: data.mode, emotion: data.emotion ?? 'calm' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
