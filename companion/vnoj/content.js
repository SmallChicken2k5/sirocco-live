// Same-origin reads use the current login in the browser. Credentials never leave VNOJ.
let running = false;
async function sync() {
  if (running) return; running = true;
  try {
    if (!(await chrome.storage.local.get('pairToken')).pairToken) return;
    const contest = /^\/contest\/([\w-]+)/.exec(location.pathname)?.[1]; if (!contest) return;
    const response = await fetch(`/contest/${contest}/ranking/?data`, { credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
    const data = await response.json(), own = data.own;
    if (!own?.id || !own.user?.username || !Array.isArray(own.subs)) { await chrome.storage.local.set({ lastStatus: 'Hãy mở contest của phiên thi ảo đang tham gia bằng tài khoản thí sinh.' }); return; }
    const problems = new Map(data.problems.map(p=>[String(p.id),p]));
    const submissions = own.subs.map(([id, points, elapsed], i) => {
      const p = problems.get(String(id)); if (!p) return null;
      const submittedAt = Math.round((own.real_start + elapsed) * 1000);
      return { id: submittedAt * 100 + i % 100, index: p.label, points, verdict: points >= p.points ? 'AC' : points > 0 ? 'PARTIAL' : 'NOT_AC', submittedAt, testing: false };
    }).filter(Boolean);
    // Include compiler errors absent from own.subs, bounded to the active virtual window.
    const list = await fetch(`/contest/${contest}/submissions/${encodeURIComponent(own.user.username)}/`, { credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
    if (list.ok) {
      const doc = new DOMParser().parseFromString(await list.text(), 'text/html');
      for (const row of doc.querySelectorAll('.submission-row')) {
        const verdict = row.querySelector('.status')?.textContent.trim();
        const submittedAt = Date.parse(row.querySelector('[data-iso]')?.getAttribute('data-iso'));
        if (!(submittedAt >= own.real_start * 1000 && submittedAt <= (own.real_start + data.contest.replay_duration) * 1000)) continue;
        const code = row.querySelector('.name a')?.getAttribute('href')?.split('/').pop();
        const p = data.problems.find(p=>p.code === code); if (!p) continue;
        const known=submissions.find(s=>s.index===p.label&&Math.abs(s.submittedAt-submittedAt)<1100);
        if(known){if(['AC','WA','TLE','MLE','RE','RTE','CE','IE','AB'].includes(verdict))known.verdict=verdict;continue;}
        if (!['CE','IE','AB'].includes(verdict)) continue;
        submissions.push({ id: submittedAt * 100, index: p.label, points: 0, verdict, submittedAt, testing: false });
      }
    }
    await chrome.runtime.sendMessage({ type: 'sirocco-vnoj', payload: { contest, username: own.user.username, participationId: own.id, submissions } });
  } catch { /* Keep polling; no sensitive error text is sent or logged. */ }
  finally { running = false; }
}
sync(); setInterval(sync, 10000);
