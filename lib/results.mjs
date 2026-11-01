export const resultStyle = (settings, contest) => ['ICPC', 'IOI'].includes(settings?.style) ? settings.style : contest?.type === 'ICPC' ? 'ICPC' : 'IOI';
export const displayName = candidate => candidate.realName?.trim() || candidate.name;
export const problemAccepted = (problem, contest) => contest?.type === 'ICPC' ? problem.points > 0 : problem.maxPoints > 0 && problem.points >= problem.maxPoints;
export function problemLabel(problem, style) {
  if (problem.pending) return '…';
  if (style === 'ICPC') return problem.points > 0 ? 'AC' : problem.rejectedAttempts > 0 ? `−${problem.rejectedAttempts}` : '—';
  return Number.isFinite(problem.points) ? String(problem.points) : '—';
}
export function classifyResult(submission, previousPoints, style, maxPoints = 100) {
  if (submission.testing || ['TESTING','SUBMITTED','QU','P','G'].includes(submission.verdict)) return null;
  const accepted = ['OK', 'AC'].includes(submission.verdict);
  const verdict = ({WRONG_ANSWER:'WA',TIME_LIMIT_EXCEEDED:'TLE',MEMORY_LIMIT_EXCEEDED:'MLE',RUNTIME_ERROR:'RE',COMPILATION_ERROR:'CE',FAILED:'Lỗi chấm',NOT_AC:'Chưa AC',RTE:'RE'})[submission.verdict] || submission.verdict;
  if (style === 'ICPC') return { tone: accepted ? 'success' : 'failure', label: accepted ? 'AC' : verdict };
  const points = submission.points;
  if (!Number.isFinite(points)) return accepted ? { tone: 'success', label: 'AC' } : { tone: 'failure', label: verdict };
  const full = points >= (maxPoints > 0 ? maxPoints : 100);
  if (full || points > (previousPoints ?? 0)) return { tone: 'success', label: full ? 'Trọn điểm' : 'Tăng điểm' };
  if (previousPoints != null && points < previousPoints) return { tone: 'failure', label: 'Giảm điểm' };
  if (points === 0 && !accepted) return { tone: 'failure', label: verdict };
  return null;
}
// A journal is scoped to a single contest + handle + participation + display style.
// Existing submissions establish a baseline. Only new final results become events.
export class BoardJournal {
  constructor() { this.previous = null; this.events = []; this.sequence = 0; }
  consume(participant, style, now) {
    if (this.previous) for (const p of participant.problems) {
      const prior = this.previous.find(x=>x.index === p.index);
      if (!prior || p.pending) continue;
      const increased = p.points > prior.points;
      const accepted = p.points >= (p.maxPoints || 1);
      const improved = increased && (style !== 'ICPC' || accepted);
      const failed = p.rejectedAttempts > prior.rejectedAttempts || style === 'ICPC' && increased && !accepted;
      if (improved || failed) this.events.push({ id: `board:${++this.sequence}`, index: p.index, tone: improved ? 'success' : 'failure', label: improved ? style === 'ICPC' ? 'AC' : 'Tăng điểm' : 'Chưa AC', points: p.points, previousPoints: prior.points, at: now, evidence: 'BXH' });
    }
    this.previous = structuredClone(participant.problems); this.events = this.events.slice(-24); return this.events;
  }
}
export class ResultJournal {
  constructor() { this.seen = new Set(); this.history = new Map(); this.baseline = new Map(); this.events = []; this.ready = false; this.maxId = 0; this.pending = new Set(); }
  consume(submissions, style, problems, now = Date.now(), baselineProblems = []) {
    const sorted = [...submissions].sort((a,b) => a.id - b.id);
    const initial = !this.ready;
    if(initial) for(const p of baselineProblems) if(Number.isFinite(p.points)) this.baseline.set(p.index,p.points);
    for (const sub of sorted) {
      if (sub.testing || !sub.verdict || this.seen.has(String(sub.id))) continue;
      // Old final rows appearing later (pagination/cache) must not be celebrated.
      const fresh = !initial && (sub.id > this.maxId || this.pending.has(sub.id));
      const prior = [...this.history.values()].filter(s => s.index === sub.index && s.id < sub.id && Number.isFinite(s.points)).sort((a,b)=>b.id-a.id)[0]?.points ?? this.baseline.get(sub.index);
      const result = classifyResult(sub, prior, style, problems.find(p => p.index === sub.index)?.maxPoints);
      if (fresh && result) this.events.push({ id: `submission:${sub.id}`, submissionId: sub.id, index: sub.index, ...result, points: sub.points, previousPoints: prior ?? null, at: now });
      this.seen.add(String(sub.id));
      this.history.set(sub.id, sub);
    }
    // A pending row may finalize later even if newer IDs already finished.
    const pending = submissions.filter(s=>s.testing).map(s=>s.id);
    this.maxId = Math.max(this.maxId, ...sorted.filter(s=>!s.testing).map(s=>s.id), 0);
    this.pending = new Set(pending); this.ready = true; this.events = this.events.slice(-24);
    return this.events;
  }
}
