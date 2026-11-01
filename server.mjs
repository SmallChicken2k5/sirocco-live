import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { defaultConfig, normalizeConfig, publicConfig } from './lib/config.mjs';
import { UsacoReader } from './lib/usaco.mjs';
import { DemoReader, demoCandidates } from './lib/demo.mjs';
import { createCodeforcesConnection } from './lib/codeforces-connection.mjs';
import { CodeforcesTracker } from './lib/codeforces-tracker.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.woff2':'font/woff2' };
const MAX_BODY = 1024 * 1024;
export async function createStudio({ dataDir = process.env.SIROCCO_DATA_DIR || path.join(ROOT, 'data'), port = Number(process.env.PORT || 8765), readerOptions, codeforcesOptions } = {}) {
  await mkdir(dataDir, { recursive: true });
  let config = defaultConfig();
  try { config = normalizeConfig(JSON.parse(await readFile(path.join(dataDir, 'config.json'), 'utf8'))); }
  catch (e) { if (e.code !== 'ENOENT') console.warn('Không đọc được cấu hình đã lưu; dùng cấu hình trống:', e.message); }
  const codeforces = await createCodeforcesConnection(dataDir, codeforcesOptions);
  const clients = new Set(), readers = new Map(), snapshots = new Map();
  let writeQueue = Promise.resolve();
  const envelope = (admin = false) => ({ config: admin ? config : publicConfig(config), snapshots: Object.fromEntries(snapshots), contests: Object.fromEntries(contestTracker.snapshots) });
  const send = (client, event, data) => {
    if (!client.res.destroyed && !client.res.writableEnded) {
      // A stalled local viewer must not retain unlimited code snapshots.
      if (client.res.writableLength > 2 * 1024 * 1024) { client.res.destroy(); return; }
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };
  const broadcast = (event, data) => { for (const client of clients) send(client, event, data); };
  const contestTracker = new CodeforcesTracker(codeforces, snapshot => broadcast('contest', snapshot));
  const onChange = snapshot => { snapshots.set(snapshot.id, snapshot); broadcast('candidate', snapshot); };
  function reconcile() {
    for (const [id, entry] of readers) {
      const c = config.candidates.find(c => c.id === id && c.enabled);
      const signature = c && JSON.stringify([c.url, c.language, config.demo]);
      if (!c || entry.signature !== signature) { entry.reader.stop(); readers.delete(id); snapshots.delete(id); }
    }
    for (const c of config.candidates) {
      if (!c.enabled || readers.has(c.id)) continue;
      if (!c.url && !config.demo) {
        snapshots.set(c.id, { id: c.id, status: 'waiting', message: 'Chưa có link USACO IDE', code: '', input: '', inputStatus: 'waiting', revision: 0, language: c.language === 'auto' ? 'cpp' : c.language });
        continue;
      }
      const reader = config.demo ? new DemoReader(c, onChange) : new UsacoReader(c, onChange, readerOptions);
      readers.set(c.id, { reader, signature: JSON.stringify([c.url, c.language, config.demo]) });
      reader.start();
    }
    const activeIds = new Set(config.candidates.filter(c => c.enabled).map(c => c.id));
    for (const id of snapshots.keys()) if (!activeIds.has(id)) snapshots.delete(id);
    contestTracker.reconcile(config);
  }
  const persist = next => {
    const task = writeQueue.then(async () => {
      const temp = path.join(dataDir, `config-${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
      await rename(temp, path.join(dataDir, 'config.json'));
    });
    writeQueue = task.catch(() => {});
    return task;
  };
  const json = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('Yêu cầu phải dùng application/json.'), { status: 415 });
    let size = 0, chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw Object.assign(new Error('Dữ liệu quá lớn.'), { status: 413 }); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Object.assign(new Error('JSON không hợp lệ.'), { status: 400 }); }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    try {
      const host = req.headers.host;
      const localPort = server.address()?.port || port;
      if (![ `127.0.0.1:${localPort}`, `localhost:${localPort}` ].includes(host)) return json(res, 403, { error: 'Chỉ truy cập qua localhost.' });
      const url = new URL(req.url, `http://${host}`);
      if (!['GET', 'POST', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Phương thức không được hỗ trợ.' });
      if (req.method === 'POST') {
        if (req.headers.origin && ![`http://127.0.0.1:${localPort}`, `http://localhost:${localPort}`].includes(req.headers.origin)) return json(res, 403, { error: 'Không chấp nhận yêu cầu từ trang bên ngoài.' });
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Không chấp nhận yêu cầu từ trang bên ngoài.' });
      }
      if (url.pathname === '/api/health') return json(res, 200, { ok: true, name: 'Sirocco Live', version: '1.4.0', port: localPort });
      if (url.pathname === '/api/state' && req.method === 'GET') return json(res, 200, envelope());
      if (url.pathname === '/api/config' && req.method === 'GET') return json(res, 200, config);
      if (url.pathname === '/api/codeforces/connection' && req.method === 'GET') return json(res, 200, codeforces.status());
      if (url.pathname === '/api/codeforces/check' && req.method === 'POST') { const result = await codeforces.check(await body(req)); contestTracker.reconcile(config); return json(res, 200, result); }
      if (url.pathname === '/api/codeforces/disconnect' && req.method === 'POST') { await body(req); const result = await codeforces.disconnect(); contestTracker.reconcile(config); return json(res, 200, result); }
      if (url.pathname === '/api/codeforces/refresh' && req.method === 'POST') { const { groupId } = await body(req); if (!Object.hasOwn(config.groups, groupId) || !contestTracker.refresh(groupId)) return json(res, 400, { error: 'Bật contest, kết nối API và nhập handle trước khi cập nhật.' }); return json(res, 200, { ok: true }); }
      if (url.pathname === '/api/export' && req.method === 'GET') return json(res, 200, config, { 'Content-Disposition': 'attachment; filename="sirocco-live-config.json"' });
      if (url.pathname === '/api/config' && req.method === 'POST') {
        const next = normalizeConfig(await body(req));
        await persist(next);
        config = next;
        reconcile();
        broadcast('state', envelope());
        return json(res, 200, config);
      }
      if (url.pathname === '/api/demo' && req.method === 'POST') {
        await body(req);
        if (config.candidates.length && !config.demo) return json(res, 409, { error: 'Chế độ thử chỉ nạp vào danh sách trống, để không thay thế link thật của bạn.' });
        const next = normalizeConfig({ ...config, demo: true, candidates: demoCandidates() });
        await persist(next); config = next; reconcile(); broadcast('state', envelope());
        return json(res, 200, config);
      }
      if (url.pathname === '/api/reconnect' && req.method === 'POST') {
        const { id } = await body(req);
        if (!config.candidates.some(c => c.id === id && c.enabled)) return json(res, 404, { error: 'Không tìm thấy thí sinh đang bật.' });
        readers.get(id)?.reader.stop(); readers.delete(id); snapshots.delete(id); reconcile(); broadcast('state', envelope());
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/archive' && req.method === 'GET') {
        const archive = { title: config.title, exportedAt: new Date().toISOString(), candidates: config.candidates.filter(c => c.enabled).map(c => ({ name: c.name, group: c.group, ...snapshots.get(c.id) })), contests: Object.fromEntries(contestTracker.snapshots) };
        return json(res, 200, archive, { 'Content-Disposition': 'attachment; filename="sirocco-code-snapshot.json"' });
      }
      if (url.pathname === '/api/events' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        const client = { res }; clients.add(client); send(client, 'state', envelope());
        req.on('close', () => clients.delete(client));
        return;
      }
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Không tìm thấy API.' });
      let filename;
      if (['/', '/index.html'].includes(url.pathname) || /^\/view\/[a-z][a-z0-9_-]{0,47}$/.test(url.pathname) || /^\/view\/candidate\/[a-zA-Z0-9_-]+$/.test(url.pathname)) filename = 'index.html';
      else if (['/app.js', '/style.css', '/studio.css', '/app.js.LEGAL.txt'].includes(url.pathname)) filename = url.pathname.slice(1);
      else if (/^\/assets\/(sirocco-(symbol|favicon|original)\.png|icons\.svg|geist-(vietnamese|latin-ext|latin)\.woff2)$/.test(url.pathname)) filename = url.pathname.slice(1);
      else if (url.pathname === '/favicon.ico') filename = 'assets/sirocco-favicon.png';
      else { res.writeHead(404); res.end('Không tìm thấy trang.'); return; }
      const content = await readFile(path.join(ROOT, 'dist', filename));
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filename)] || 'text/plain', 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'" });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (e) { if (!res.headersSent) json(res, e.status || 400, { error: e.message }); else res.end(); }
  });
  const heartbeat = setInterval(() => { for (const c of clients) if (!c.res.destroyed) c.res.write(': keepalive\n\n'); }, 15000);
  heartbeat.unref?.();
  reconcile();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, get config() { return config; }, get snapshots() { return snapshots; }, get contests() { return contestTracker.snapshots; }, port: server.address().port, close: async () => {
    clearInterval(heartbeat);
    contestTracker.close();
    for (const { reader } of readers.values()) reader.stop();
    for (const c of clients) c.res.end();
    await writeQueue;
    await new Promise(resolve => server.close(resolve));
  } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createStudio().then(studio => {
    console.log(`Sirocco Live đang chạy: http://127.0.0.1:${studio.port}`);
    console.log('Nguồn mặc định: /view/nonpro · /view/pro · /view/icpc. Thêm khung tuỳ chọn trong phòng điều khiển.');
    const stop = async () => { await studio.close(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }).catch(e => { console.error(e.code === 'EADDRINUSE' ? 'Cổng đang được dùng. Mở Sirocco Live đang chạy hoặc đổi biến PORT.' : e.message); process.exitCode = 1; });
}
