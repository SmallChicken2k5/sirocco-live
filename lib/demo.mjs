import { lineAt } from './position.mjs';

const cpp = `#include <bits/stdc++.h>
using namespace std;

// Sirocco Cup — dữ liệu minh hoạ, không phải bài thi thật
using ll = long long;
const int MAXN = 200005;
vector<int> adj[MAXN];
int depth[MAXN], parent[MAXN];

void dfs(int u, int p) {
    parent[u] = p;
    for (int v : adj[u]) {
        if (v == p) continue;
        depth[v] = depth[u] + 1;
        dfs(v, u);
    }
}

ll solve(const vector<int>& a) {
    ll best = 0, current = 0;
    for (int x : a) {
        current = max(0LL, current + x);
        best = max(best, current);
    }
    return best;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<int> a(n);
    for (int& x : a) cin >> x;

    cout << solve(a) << '\\n';
    return 0;
}
`;
const python = `# Sirocco Cup — dữ liệu minh hoạ
import sys
from collections import deque

def shortest_path(graph, start):
    distance = [-1] * len(graph)
    distance[start] = 0
    queue = deque([start])

    while queue:
        u = queue.popleft()
        for v in graph[u]:
            if distance[v] != -1:
                continue
            distance[v] = distance[u] + 1
            queue.append(v)

    return distance

def solve():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n, m = data[:2]
    graph = [[] for _ in range(n)]
    for i in range(m):
        u, v = data[2 + i * 2:4 + i * 2]
        graph[u - 1].append(v - 1)
        graph[v - 1].append(u - 1)

    answer = shortest_path(graph, 0)
    print(*answer)

if __name__ == '__main__':
    solve()
`;
export function demoCandidates() {
  return Array.from({ length: 6 }, (_, i) => ({ id: `demo-${i + 1}`, name: `Thí sinh mẫu ${String(i + 1).padStart(2, '0')}`, group: i < 4 ? 'nonpro' : 'pro', language: i === 1 || i === 4 ? 'py' : 'cpp', url: '', enabled: true }));
}
export class DemoReader {
  constructor(candidate, onChange) { this.candidate = candidate; this.onChange = onChange; this.tick = 0; }
  start() {
    const emit = () => {
      const language = this.candidate.language === 'py' ? 'py' : 'cpp';
      const base = language === 'py' ? python : cpp;
      const counter = language === 'py' ? `# Đang thử bố cục · cập nhật ${this.tick}\n` : `// Đang thử bố cục · cập nhật ${this.tick}\n`;
      const code = base + counter;
      const positions = [code.indexOf('distance[v]'), code.indexOf('current ='), code.length - 2, code.indexOf('solve')].filter(x => x >= 0);
      const offset = positions[this.tick % positions.length];
      const input = language === 'py' ? '5 5\n1 2\n2 3\n1 4\n4 5\n3 5\n' : `6\n-2 5 -1 4 -3 ${2 + this.tick % 3}\n`;
      this.onChange({ id: this.candidate.id, status: 'demo', message: 'Minh hoạ · không phải bài thi thật', code, input, inputStatus: 'demo', inputUpdatedAt: Date.now(), language, offset, editOffset: offset, cursorOffset: offset, cursorAt: Date.now(), line: lineAt(code, offset), updatedAt: Date.now(), syncedAt: Date.now(), revision: ++this.tick, mode: 'demo' });
    };
    emit();
    this.timer = setInterval(emit, 2600 + Number(this.candidate.id.replace(/\D/g, '') || 0) * 160);
    this.timer.unref?.();
  }
  stop() { clearInterval(this.timer); }
}
