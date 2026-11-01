import { displayName } from '../lib/results.mjs';

export class ResultAudio {
  getContext() {
    if (this.context && this.context.state !== 'closed') return this.context;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    try { this.context = new Audio(); } catch { return null; }
    this.autoplayAttempted = false;
    this.context.onstatechange = () => this.onStateChange?.();
    return this.context;
  }
  prepare(onStateChange) {
    this.onStateChange = onStateChange;
    const c = this.getContext();
    if (!c) return 'unavailable';
    if (c.state !== 'running' && !this.autoplayAttempted) {
      this.autoplayAttempted = true;
      // A blocked resume may stay pending until a click; never await it here.
      try { Promise.resolve(c.resume()).catch(() => {}); } catch {}
    }
    return c.state;
  }
  async enable() {
    if (!this.getContext()) return false;
    try { await this.context.resume(); } catch { return false; }
    return this.context.state === 'running';
  }
  play(tone, volume = 35) {
    const c = this.context; if (!c || c.state !== 'running' || !volume) return;
    const notes = tone === 'success' ? [523.25,659.25,783.99] : [220,164.81];
    const start = c.currentTime;
    notes.forEach((frequency,i)=>{
      const oscillator = c.createOscillator(), gain = c.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      const at = start + i * .09;
      gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(volume / 100 * .16,at + .015); gain.gain.exponentialRampToValueAtTime(.001,at + .22);
      oscillator.connect(gain); gain.connect(c.destination); oscillator.start(at); oscillator.stop(at + .24);
    });
  }
}
export class ResultEffects {
  constructor() { this.cursors = new Map(); this.audio = new ResultAudio(); }
  observe(panel, candidate, settings, snapshot, participant) {
    if (!participant || snapshot.status !== 'live' || snapshot.contest?.frozen && !snapshot.asManager) return;
    const key = JSON.stringify([candidate.id,snapshot.source,participant.handle,participant.type,participant.participationId,participant.partyStartTimeSeconds,settings.style]);
    const events = participant.resultEvents || [], ids = new Set(events.map(e=>e.id));
    const previous = this.cursors.get(key); this.cursors.set(key,ids);
    if (!previous) return;
    for (const event of events) if (!previous.has(event.id) && Date.now() - event.at < 20000) this.show(panel,candidate,settings,event);
  }
  show(panel,candidate,settings,event,test = false) {
    if (settings.sound) this.audio.play(event.tone,settings.volume);
    if (settings.effects === false && !test) return;
    let overlay = panel.node.querySelector('.result-flash');
    if (!overlay) {
      overlay = document.createElement('div'); overlay.className = 'result-flash'; overlay.setAttribute('role','status'); overlay.setAttribute('aria-live','polite');
      overlay.innerHTML = '<div class="result-flash-edge"></div><div class="result-notice"><span class="result-symbol" aria-hidden="true"></span><span><small></small><strong></strong><em hidden></em></span></div>';
      panel.node.append(overlay);
      // Establish the hidden frame once, so the first result also fades in.
      overlay.getBoundingClientRect();
    }
    overlay.dataset.tone = event.tone;
    overlay.querySelector('.result-symbol').textContent = event.tone === 'success' ? '✓' : '×';
    overlay.querySelector('small').textContent = `${test ? 'THỬ HIỆU ỨNG · ' : ''}${displayName(candidate)} · Bài ${event.index}`;
    overlay.querySelector('strong').textContent = event.label;
    const delta = overlay.querySelector('em');
    delta.hidden = !['Tăng điểm','Giảm điểm'].includes(event.label);
    delta.textContent = delta.hidden ? '' : `${event.previousPoints ?? 0} → ${event.points}`;
    overlay.classList.add('visible');
    clearTimeout(panel.effectTimer); panel.effectTimer = setTimeout(()=>overlay.classList.remove('visible'),2600);
  }
}
