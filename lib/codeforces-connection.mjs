import { CodeforcesClient, CodeforcesError, parseContestReference, parseCodeforcesHandle, summarizeStandings, validateCredentials } from './codeforces.mjs';
import { CodeforcesCredentialStore } from './codeforces-credentials.mjs';

export async function createCodeforcesConnection(dataDir, options = {}) {
  const store = new CodeforcesCredentialStore(dataDir); await store.load();
  const client = new CodeforcesClient(options);
  let busy = false, lastCheck = null, revision = 0;
  return {
    get revision() { return revision; },
    standings: (contest, options) => client.standings(contest, { ...options, credentials: store.get() }),
    submissions: (contest, options) => client.submissions(contest, { ...options, credentials: store.get() }),
    status: () => ({ ...store.status(), busy, lastCheck }),
    async check(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CodeforcesError('INVALID_INPUT', 'Thông tin kết nối Codeforces không hợp lệ.');
      if (busy) throw new CodeforcesError('BUSY', 'Đang kiểm tra kết nối Codeforces. Chờ kết quả hiện tại.', 409);
      const contest = parseContestReference(input.contest);
      const handle = parseCodeforcesHandle(input.handle);
      const hasNewCredentials = Boolean(input.apiKey || input.apiSecret);
      const credentials = hasNewCredentials ? validateCredentials(input) : store.get();
      if (hasNewCredentials && contest.kind !== 'gym') throw new CodeforcesError('GYM_CHECK_REQUIRED', 'Để xác minh API Key, hãy kiểm tra với một contest /gym/ mà tài khoản được quyền xem.');
      busy = true;
      try {
        const raw = await client.standings(contest, { credentials, handle, asManager: input.asManager === true });
        const result = summarizeStandings(raw, contest.id, handle);
        if (hasNewCredentials) { await store.save(credentials); revision++; }
        lastCheck = { ...result, source: contest.url, asManager: input.asManager === true };
        return { ...store.status(), lastCheck };
      } finally { busy = false; }
    },
    async disconnect() {
      if (busy) throw new CodeforcesError('BUSY', 'Đang kiểm tra kết nối Codeforces. Chờ kết quả hiện tại.', 409);
      await store.clear(); lastCheck = null; revision++; return { ...store.status(), lastCheck };
    },
  };
}
