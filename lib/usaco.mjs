import WebSocket from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Awareness, applyAwarenessUpdate } from 'y-protocols/awareness';
import { parseShareLink } from './config.mjs';
import { changedPosition, lineAt } from './position.mjs';

const MAX_MESSAGE = 4 * 1024 * 1024;
export class UsacoReader {
  constructor(candidate, onChange, options = {}) {
    this.candidate = candidate;
    this.onChange = onChange;
    this.fetchMetadata = options.fetchMetadata || (async fileId => {
      const res = await fetch(`https://cp-ide-2-default-rtdb.firebaseio.com/files/${encodeURIComponent(fileId)}/settings.json`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`Không đọc được thông tin chia sẻ (HTTP ${res.status}).`);
      return res.json();
    });
    this.endpoint = options.endpoint || 'wss://yjs.usaco.guide:443';
    this.retryMs = options.retryMs || 3000;
    this.options = options;
    this.channel = options.channel || 'code';
    this.auxiliaryReaders = [];
    this.stopped = false;
    this.snapshot = { id: candidate.id, status: 'connecting', message: 'Đang kiểm tra link chia sẻ…', code: '', input: '', inputStatus: 'connecting', language: 'cpp', offset: 0, editOffset: 0, cursorOffset: null, line: 1, updatedAt: null, syncedAt: null, mode: 'usaco', revision: 0 };
  }
  publish(values) {
    if (this.stopped) return;
    Object.assign(this.snapshot, values);
    this.onChange({ ...this.snapshot });
  }
  async start() {
    try {
      this.fileId = parseShareLink(this.candidate.url).fileId;
      if (this.channel === 'code') {
        this.metadataTimer = setInterval(() => this.checkMetadata(), 30000);
        this.metadataTimer.unref?.();
      }
      const metadata = await this.fetchMetadata(this.fileId);
      if (this.stopped) return;
      this.validateMetadata(metadata);
      this.currentMetadata = metadata;
      this.language = ['cpp', 'java', 'py'].includes(metadata.language) ? metadata.language : 'cpp';
      if (this.candidate.language !== 'auto') this.language = this.candidate.language;
      this.connect();
      this.startAuxiliary();
    } catch (e) {
      this.publish({ status: 'error', message: e.message, code: '', input: '', inputStatus: 'error' });
    }
  }
  validateMetadata(metadata) {
    if (!metadata) throw new Error('Không tìm thấy file. Kiểm tra lại link share USACO IDE.');
    if (!['READ', 'READ_WRITE'].includes(metadata.defaultPermission)) throw new Error('File đang riêng tư. Hãy chọn Share → Anyone with the link → Can view trên USACO IDE.');
  }
  async checkMetadata() {
    try {
      const metadata = await this.fetchMetadata(this.fileId);
      if (this.stopped) return;
      this.validateMetadata(metadata);
      this.currentMetadata = metadata;
      this.metadataFailures = 0;
      const language = this.candidate.language === 'auto' ? (['cpp', 'java', 'py'].includes(metadata.language) ? metadata.language : 'cpp') : this.candidate.language;
      if (language !== this.language || this.snapshot.status === 'error') {
        this.language = language;
        this.disposeSocket();
        this.connect();
        this.startAuxiliary();
      }
    } catch (e) {
      if (this.stopped) return;
      // Permission is checked again during the session. Never keep a private file live.
      if (!/HTTP|fetch|timeout|aborted/i.test(e.message) || (this.metadataFailures = (this.metadataFailures || 0) + 1) >= 2) {
        clearTimeout(this.retryTimer);
        this.disposeSocket();
        this.stopAuxiliary();
        this.publish({ status: 'error', message: e.message, code: '', input: '', inputStatus: 'error', cursorOffset: null, updatedAt: null });
      }
    }
  }
  startAuxiliary() {
    if (this.channel !== 'code' || this.options.includeInput === false || this.auxiliaryReaders.length || this.stopped) return;
    const channels = ['input'];
    for (const channel of channels) {
      const field = 'input';
      const reader = new UsacoReader(this.candidate, snapshot => {
        this.publish({ [field]: snapshot.code, [`${field}Status`]: snapshot.status, [`${field}UpdatedAt`]: snapshot.updatedAt, [`${field}Message`]: snapshot.message });
      }, { ...this.options, channel, fetchMetadata: async () => this.currentMetadata });
      this.auxiliaryReaders.push(reader);
      reader.start();
    }
  }
  stopAuxiliary() {
    for (const reader of this.auxiliaryReaders) reader.stop();
    this.auxiliaryReaders = [];
  }
  connect() {
    if (this.stopped) return;
    this.doc = new Y.Doc();
    this.text = this.doc.getText('monaco');
    this.awareness = new Awareness(this.doc);
    this.awareness.setLocalState(null);
    this.publish({ status: 'connecting', message: 'Đang đồng bộ code…', language: this.language, cursorOffset: null });
    this.text.observe(event => {
      if (this.stopped) return;
      const code = this.text.toString();
      const offset = changedPosition(event.delta, code);
      this.publish({ code, editOffset: offset, offset, line: lineAt(code, offset), updatedAt: Date.now(), revision: this.snapshot.revision + 1 });
    });
    this.awareness.on('change', ({ added, updated, removed }) => {
      for (const id of [...added, ...updated]) {
        const state = this.awareness.getStates().get(id);
        const relative = state?.selection?.head || state?.cursor?.head;
        if (!relative) continue;
        try {
          const pos = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(relative), this.doc);
          if (pos?.type === this.text) {
            this.lastCursorClient = id;
            this.publish({ cursorOffset: pos.index, cursorAt: Date.now() });
          }
        } catch { /* A peer may use a different selection format. Follow edits remains available. */ }
      }
      if (removed.includes(this.lastCursorClient) || (updated.includes(this.lastCursorClient) && !this.awareness.getStates().get(this.lastCursorClient)?.selection && !this.awareness.getStates().get(this.lastCursorClient)?.cursor)) this.publish({ cursorOffset: null });
    });
    const room = `${this.fileId}.${this.channel === 'code' ? this.language : this.channel}`;
    const socket = this.socket = new WebSocket(`${this.endpoint.replace(/\/$/, '')}/${encodeURIComponent(room)}`, { maxPayload: MAX_MESSAGE, handshakeTimeout: 12000 });
    socket.on('open', () => {
      if (this.stopped || this.socket !== socket) return;
      // Read-only wire contract: only request a state vector + remote awareness.
      // Never send sync step 2, document updates, or local awareness to USACO.
      const request = encoding.createEncoder();
      encoding.writeVarUint(request, 0);
      encoding.writeVarUint(request, 0);
      encoding.writeVarUint8Array(request, Y.encodeStateVector(this.doc));
      socket.send(encoding.toUint8Array(request));
      const awarenessQuery = encoding.createEncoder();
      encoding.writeVarUint(awarenessQuery, 3);
      socket.send(encoding.toUint8Array(awarenessQuery));
      this.syncTimer = setTimeout(() => {
        if (this.snapshot.status !== 'live') { this.publish({ status: 'reconnecting', message: 'Chưa nhận được code. Đang thử lại…' }); socket.terminate(); }
      }, 15000);
      this.syncTimer.unref?.();
    });
    socket.on('message', data => {
      if (this.stopped || this.socket !== socket) return;
      try {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const type = decoding.readVarUint(decoder);
        if (type === 0) {
          const syncType = decoding.readVarUint(decoder);
          if (syncType === 1 || syncType === 2) {
            Y.applyUpdate(this.doc, decoding.readVarUint8Array(decoder), 'remote');
            clearTimeout(this.syncTimer);
            this.publish({ status: 'live', message: 'Đã đồng bộ · chỉ đọc', code: this.text.toString(), syncedAt: Date.now() });
          }
          // Ignore upstream sync step 1: responding could write document state.
        } else if (type === 1) applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), socket);
        // Type 100 is a USACO save acknowledgement, irrelevant for a viewer.
      } catch {
        this.publish({ status: 'error', message: 'Dữ liệu đồng bộ không hợp lệ. Hãy kết nối lại.' });
        socket.terminate();
      }
    });
    socket.on('error', () => { if (this.socket === socket) this.publish({ status: 'reconnecting', message: 'Mất kết nối với USACO. Đang thử lại…' }); });
    socket.on('close', () => {
      if (this.stopped || this.socket !== socket) return;
      this.disposeSocket();
      this.publish({ status: 'reconnecting', message: 'Mất kết nối · đang giữ bản code cuối' });
      this.retryTimer = setTimeout(async () => {
        try {
          const metadata = await this.fetchMetadata(this.fileId);
          if (this.stopped) return;
          this.validateMetadata(metadata);
          this.currentMetadata = metadata;
          this.connect();
          this.startAuxiliary();
        } catch (e) { this.stopAuxiliary(); this.publish({ status: 'error', message: e.message, code: '', input: '', inputStatus: 'error' }); }
      }, this.retryMs);
      this.retryTimer.unref?.();
    });
  }
  disposeSocket() {
    clearTimeout(this.syncTimer);
    if (this.socket) { const s = this.socket; this.socket = null; s.removeAllListeners(); s.on('error', () => {}); s.terminate(); }
    this.awareness?.destroy();
    this.doc?.destroy();
    this.awareness = null;
    this.doc = null;
  }
  stop() {
    this.stopped = true;
    clearInterval(this.metadataTimer);
    clearTimeout(this.retryTimer);
    this.stopAuxiliary();
    this.disposeSocket();
  }
}
