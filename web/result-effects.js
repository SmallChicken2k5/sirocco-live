import { esc } from './common.js';
import { displayName } from '../lib/results.mjs';

export class ResultAudio {
  async enable() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    this.context ||= new Audio();
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
    if (!overlay) { overlay = document.createElement('div'); overlay.className = 'result-flash'; overlay.setAttribute('role','status'); overlay.setAttribute('aria-live','polite'); panel.node.append(overlay); }
    overlay.dataset.tone = event.tone;
    overlay.innerHTML = `<div class="result-flash-edge"></div><div class="result-notice"><span class="result-symbol" aria-hidden="true">${event.tone === 'success' ? '✓' : '×'}</span><span><small>${test ? 'THỬ HIỆU ỨNG · ' : ''}${esc(displayName(candidate))} · Bài ${esc(event.index)}</small><strong>${esc(event.label)}</strong>${event.label === 'Tăng điểm' || event.label === 'Giảm điểm' ? `<em>${event.previousPoints ?? 0} → ${event.points}</em>` : ''}</span></div>`;
    overlay.classList.add('visible');
    clearTimeout(panel.effectTimer); panel.effectTimer = setTimeout(()=>overlay.classList.remove('visible'),2600);
  }
}
