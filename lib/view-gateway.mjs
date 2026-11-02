import http from 'node:http';

const ASSETS = new Set(['/app.js', '/style.css', '/studio.css', '/favicon.ico', '/app.js.LEGAL.txt',
  '/assets/sirocco-symbol.png', '/assets/sirocco-favicon.png', '/assets/sirocco-original.png', '/assets/icons.svg',
  ...['vietnamese', 'latin-ext', 'latin'].map(s => `/assets/geist-${s}.woff2`)]);

// This projection is used for BOTH the initial request and every live update.
export function viewerState(state, group) {
  const config = state.config || {}, settings = config.groups?.[group];
  const candidates = settings ? (config.candidates || []).filter(c => c.enabled && c.group === group).map(({url, ...c}) => c) : [];
  const ids = new Set(candidates.map(c => c.id));
  const contest = state.contests?.[group];
  return {
    config: {version: config.version, title: config.title, demo: config.demo, groups: settings ? {[group]: settings} : {}, candidates},
    snapshots: Object.fromEntries(Object.entries(state.snapshots || {}).filter(([id]) => ids.has(id))),
    contests: settings && contest ? {[group]: {...contest, participants: Object.fromEntries(Object.entries(contest.participants || {}).filter(([id]) => ids.has(id)))}} : {},
  };
}

export async function createViewGateway({upstream = 'http://127.0.0.1:8765', group = 'nonpro', port = 8766, host = '127.0.0.1', refreshMs = 250} = {}) {
  const origin = new URL(upstream);
  if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Nguồn quản trị phải là HTTP localhost, không kèm đường dẫn.');
  if (!/^[a-z][a-z0-9_-]{0,47}$/.test(group)) throw new Error('Mã khung không hợp lệ.');
  const clients = new Set(), requests = new Set();
  let stopped = false, polling = false;
  async function read(route) {
    const controller = new AbortController(); requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(origin.origin + route, {signal: controller.signal, redirect: 'error'});
      if (!response.ok) throw new Error('Nguồn dữ liệu không sẵn sàng.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {bytes, type: response.headers.get('content-type')};
    } finally { clearTimeout(timeout); requests.delete(controller); }
  }
  async function load() { return viewerState(JSON.parse(new TextDecoder().decode((await read('/api/state')).bytes)), group); }
  const initial = await load();
  if (!initial.config.groups[group]) throw new Error('Không tìm thấy khung được chia sẻ.');
  function send(client, serialized) {
    if (client.res.destroyed || client.res.writableEnded) return;
    if (client.res.writableLength > 2 * 1024 * 1024) { client.res.destroy(); return; }
    if (client.previous !== serialized) { client.res.write(`event: state\ndata: ${serialized}\n\n`); client.previous = serialized; }
  }
  const json = (res, status, body) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 403, {error:'Cổng này chỉ cho phép xem.'});
    try {
      if (!req.url.startsWith('/') || req.url.startsWith('//')) return json(res, 400, {error:'Đường dẫn không hợp lệ.'});
      const url = new URL(req.url, 'http://viewer.local'), route = url.pathname;
      if (route === '/') { res.writeHead(302, {Location:`/view/${group}`}); return res.end(); }
      if (route === '/api/state') return json(res, 200, await load());
      if (route === '/api/events' && req.method === 'GET') {
        const state = await load();
        if (res.destroyed) return;
        res.writeHead(200, {'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});
        const client = {res}; clients.add(client); send(client, JSON.stringify(state));
        res.on('close', () => clients.delete(client)); return;
      }
      // Do not proxy a prefix: only these exact routes can reach the local server.
      if (route !== `/view/${group}` && !ASSETS.has(route)) return json(res, 404, {error:'Trang này không được chia sẻ.'});
      const asset = await read(route);
      res.writeHead(200, {'Content-Type':asset.type || 'application/octet-stream'});
      res.end(req.method === 'HEAD' ? undefined : asset.bytes);
    } catch { if (!res.headersSent) json(res, 503, {error:'Không kết nối được Sirocco Live trên máy chủ.'}); else res.end(); }
  });
  // Read a fresh, scoped state rather than forwarding unfiltered admin SSE frames.
  const timer = setInterval(async () => {
    if (stopped || polling || !clients.size) return;
    polling = true;
    try { const state = JSON.stringify(await load()); for (const client of clients) send(client, state); }
    catch { for (const client of clients) client.res.end(); }
    finally { polling = false; }
  }, refreshMs);
  const heartbeat = setInterval(() => { for (const {res} of clients) if (!res.destroyed) res.write(': keepalive\n\n'); }, 15000);
  timer.unref?.(); heartbeat.unref?.();
  try { await new Promise((resolve,reject) => { server.once('error',reject); server.listen(port,host,resolve); }); }
  catch (error) { clearInterval(timer); clearInterval(heartbeat); throw error; }
  return {server, port:server.address().port, group, async close() {
    stopped = true; clearInterval(timer); clearInterval(heartbeat);
    for (const controller of requests) controller.abort();
    for (const {res} of clients) res.end();
    await new Promise(resolve => server.close(resolve));
  }};
}
