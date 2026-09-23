export function isTextEntry(target) {
  return !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export function createWingmanChat({ onSend, onFocus, onCancel, onExit }) {
  const panel = document.createElement('section');
  panel.className = 'wingman-chat'; panel.setAttribute('aria-label', 'Pixy conversation');
  panel.innerHTML = `
    <div class="chat-header"><div class="chat-avatar" aria-label="Pixy callsign placeholder">PX</div>
      <div><strong>PIXY</strong><span>LARRY “PIXY” FOULKE</span></div>
      <button type="button" class="chat-toggle" aria-expanded="false" aria-controls="chat-body">CHAT <kbd>↵</kbd></button></div>
    <div class="chat-status" role="status">COMMS / STANDBY</div>
    <p class="chat-preview" hidden></p>
    <div id="chat-body" hidden>
      <p class="chat-player" hidden></p>
      <p class="chat-response"></p><span class="sr-only chat-announcement" aria-live="polite"></span>
      <button class="chat-reveal" type="button" hidden>REVEAL FULL MESSAGE</button>
      <form class="chat-form"><label for="chat-input">MESSAGE PIXY</label>
        <textarea id="chat-input" rows="2" maxlength="1000" placeholder="Talk to Pixy…" autocomplete="off"></textarea>
        <div class="chat-actions"><span>ENTER SEND · ESC FLIGHT</span><button type="submit">SEND</button>
        <button class="chat-cancel" type="button" hidden>CANCEL</button></div>
      </form>
    </div>`;
  const $ = selector => panel.querySelector(selector);
  const input = $('#chat-input'), body = $('#chat-body'), toggle = $('.chat-toggle');
  const response = $('.chat-response'), preview = $('.chat-preview'), reveal = $('.chat-reveal');
  let timer = 0, fullText = '', lastText = '', pending = false;
  function finishTyping() {
    cancelAnimationFrame(timer); timer = 0;
    response.textContent = fullText; preview.textContent = fullText;
    reveal.hidden = true; $('.chat-announcement').textContent = fullText;
  }
  function type(text) {
    cancelAnimationFrame(timer); fullText = text;
    response.textContent = ''; preview.textContent = ''; $('.chat-announcement').textContent = '';
    reveal.hidden = !text;
    if (!text || matchMedia('(prefers-reduced-motion: reduce)').matches) { finishTyping(); return; }
    const characters = Array.from(text), start = performance.now();
    const duration = Math.min(8000, characters.length * 24);
    function tick(time) {
      const count = Math.min(characters.length, Math.floor((time - start) / duration * characters.length));
      response.textContent = characters.slice(0, count).join(''); preview.textContent = response.textContent;
      if (count < characters.length) timer = requestAnimationFrame(tick); else finishTyping();
    }
    timer = requestAnimationFrame(tick);
  }
  function open() {
    body.hidden = false; preview.hidden = true; toggle.setAttribute('aria-expanded', 'true');
    onFocus(); input.focus({ preventScroll: true }); input.scrollIntoView({ block: 'nearest' });
  }
  function close() {
    body.hidden = true; preview.hidden = !fullText; toggle.setAttribute('aria-expanded', 'false');
    input.blur(); onExit();
  }
  toggle.onclick = () => body.hidden ? open() : close();
  reveal.onclick = finishTyping; response.onclick = finishTyping; preview.onclick = open;
  panel.addEventListener('focusin', onFocus);
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Enter' && e.target === input && !e.shiftKey && !e.isComposing) {
      e.preventDefault(); $('.chat-form').requestSubmit();
    }
  });
  $('.chat-form').onsubmit = e => {
    e.preventDefault();
    if (pending || !input.value.trim()) return;
    const message = input.value.trim(); input.value = ''; void onSend(message);
  };
  $('.chat-cancel').onclick = onCancel;
  return {
    panel, open, close,
    contains: target => panel.contains(target),
    render(state) {
      pending = state.pending;
      $('.chat-form button[type="submit"]').disabled = pending;
      $('.chat-cancel').hidden = !pending;
      $('.chat-status').textContent = state.error || (pending ? 'COMMS / TRANSMITTING…' : state.available ? 'COMMS / CONNECTED' : 'COMMS / STANDBY');
      $('.chat-status').classList.toggle('interrupted', !!state.error);
      $('.chat-player').hidden = !state.player;
      $('.chat-player').textContent = `YOU / ${state.player}`;
      if (state.text !== lastText) { lastText = state.text; type(state.text); }
      preview.hidden = !body.hidden || !state.text;
    },
  };
}
