import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { validateCredentials, CodeforcesError } from './codeforces.mjs';

function dpapi(input, decrypt = false) {
  // Secrets enter the child over stdin, never via a command line or environment variable.
  const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; try { $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $result=[Security.Cryptography.ProtectedData]::${decrypt ? 'Unprotect' : 'Protect'}($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result)) } catch { exit 1 }`;
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; const timer = setTimeout(() => { child.kill(); }, 12000);
    child.stdout.on('data', data => { output += data; if (output.length > 131072) child.kill(); });
    child.stderr.resume(); child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(new CodeforcesError('KEY_STORAGE', 'Không mở được khoá bảo vệ của Windows.')); });
    child.on('close', code => { clearTimeout(timer); if (code !== 0 || !/^[A-Za-z0-9+/=]+$/.test(output)) reject(new CodeforcesError('KEY_STORAGE', 'Windows chưa đọc hoặc bảo vệ được API Key của tài khoản này.')); else resolve(Buffer.from(output, 'base64')); });
    child.stdin.end(Buffer.from(input).toString('base64'));
  });
}
export class CodeforcesCredentialStore {
  constructor(dataDir) { this.file = path.join(dataDir, 'codeforces.credentials.json'); this.value = null; this.storage = process.platform === 'win32' ? 'windows-dpapi' : 'file-0600'; this.error = null; this.queue = Promise.resolve(); }
  async load() {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8'));
      if (saved.version !== 1) throw new Error('Unknown storage format');
      let value;
      if (saved.protection === 'windows-dpapi') {
        if (process.platform !== 'win32') throw new Error('Requires original Windows user');
        value = JSON.parse((await dpapi(Buffer.from(saved.payload, 'base64'), true)).toString('utf8'));
      } else if (saved.protection === 'file-0600' && process.platform !== 'win32') value = saved.credentials;
      else throw new Error('Unexpected storage protection');
      this.value = validateCredentials(value); this.error = null;
    } catch (error) { this.value = null; this.error = error.code === 'ENOENT' ? null : 'Không đọc được khoá đã lưu. Nhập lại API Key và Secret trên máy này.'; }
    return this.status();
  }
  status() { return { configured: Boolean(this.value), storage: this.storage, error: this.error }; }
  get() { return this.value; }
  save(value) {
    const credentials = validateCredentials(value);
    const task = this.queue.then(async () => {
      const record = this.storage === 'windows-dpapi' ? { version: 1, protection: this.storage, payload: (await dpapi(Buffer.from(JSON.stringify(credentials)))).toString('base64') } : { version: 1, protection: this.storage, credentials };
      await mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.${randomUUID()}.tmp`;
      try { await writeFile(temp, JSON.stringify(record), { mode: 0o600 }); await rename(temp, this.file); }
      finally { await rm(temp, { force: true }); }
      this.value = credentials; this.error = null;
    });
    this.queue = task.catch(() => {}); return task;
  }
  clear() {
    const task = this.queue.then(async () => { await rm(this.file, { force: true }); this.value = null; this.error = null; });
    this.queue = task.catch(() => {}); return task;
  }
}
