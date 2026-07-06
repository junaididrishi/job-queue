"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardHTML = getDashboardHTML;
function getDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Queue Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
    header { background: #1e293b; border-bottom: 1px solid #334155; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    header h1 { font-size: 20px; font-weight: 700; color: #f8fafc; letter-spacing: -0.3px; }
    header .badge { background: #22c55e; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 9999px; font-weight: 600; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; }
    .card-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 8px; }
    .metric { font-size: 36px; font-weight: 700; color: #f8fafc; line-height: 1; }
    .metric-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .metric.green { color: #22c55e; }
    .metric.yellow { color: #eab308; }
    .metric.red { color: #ef4444; }
    .metric.blue { color: #3b82f6; }
    .section-title { font-size: 15px; font-weight: 600; color: #f1f5f9; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #334155; }
    td { padding: 10px 12px; border-bottom: 1px solid #1e293b; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .status-pending { background: #1e3a5f; color: #60a5fa; }
    .status-processing { background: #1c2d3a; color: #34d399; }
    .status-completed { background: #14532d; color: #86efac; }
    .status-failed { background: #450a0a; color: #fca5a5; }
    .status-dead { background: #2d1f1f; color: #f87171; }
    .priority-high { color: #f87171; font-weight: 600; }
    .priority-normal { color: #94a3b8; }
    .priority-low { color: #475569; }
    .worker-idle { color: #22c55e; }
    .worker-busy { color: #eab308; }
    .worker-offline { color: #475569; }
    .bar-container { background: #0f172a; border-radius: 4px; height: 6px; overflow: hidden; }
    .bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
    .bar-green { background: #22c55e; }
    .bar-yellow { background: #eab308; }
    .bar-red { background: #ef4444; }
    .queue-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #1e293b; }
    .queue-row:last-child { border-bottom: none; }
    .queue-label { font-size: 13px; font-weight: 500; }
    .queue-count { font-size: 20px; font-weight: 700; }
    #last-updated { font-size: 12px; color: #475569; }
    .spinner { display: inline-block; width: 8px; height: 8px; border: 2px solid #334155; border-top-color: #22c55e; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty { text-align: center; padding: 32px; color: #475569; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ Job Queue Dashboard</h1>
    <div style="display:flex;align-items:center;gap:12px">
      <span id="last-updated">Loading...</span>
      <span class="badge" id="live-badge">LIVE</span>
    </div>
  </header>

  <div class="container">
    <!-- KPI row -->
    <div class="grid-4">
      <div class="card">
        <div class="card-title">Total Tasks</div>
        <div class="metric blue" id="kpi-total">–</div>
        <div class="metric-sub">all time</div>
      </div>
      <div class="card">
        <div class="card-title">Success Rate</div>
        <div class="metric green" id="kpi-success">–</div>
        <div class="metric-sub">completed / (completed + failed)</div>
      </div>
      <div class="card">
        <div class="card-title">Avg Processing</div>
        <div class="metric" id="kpi-avg">–</div>
        <div class="metric-sub">across completed tasks</div>
      </div>
      <div class="card">
        <div class="card-title">Queue Depth</div>
        <div class="metric yellow" id="kpi-queue">–</div>
        <div class="metric-sub">tasks waiting</div>
      </div>
    </div>

    <div class="grid-3">
      <!-- Status breakdown -->
      <div class="card">
        <div class="section-title">Task Status</div>
        <div id="status-breakdown"></div>
      </div>
      <!-- Queue depth by priority -->
      <div class="card">
        <div class="section-title">Queue Depth by Priority</div>
        <div class="queue-row">
          <span class="queue-label priority-high">🔴 High</span>
          <span class="queue-count" id="q-high">–</span>
        </div>
        <div class="queue-row">
          <span class="queue-label priority-normal">🟡 Normal</span>
          <span class="queue-count" id="q-normal">–</span>
        </div>
        <div class="queue-row">
          <span class="queue-label priority-low">⚪ Low</span>
          <span class="queue-count" id="q-low">–</span>
        </div>
        <div class="queue-row" style="margin-top:8px;padding-top:8px;border-top:1px solid #334155">
          <span class="queue-label" style="color:#ef4444">💀 Dead Letter</span>
          <span class="queue-count" id="q-dead">–</span>
        </div>
      </div>
      <!-- Workers -->
      <div class="card">
        <div class="section-title">Workers</div>
        <div id="workers-list"><div class="empty">No workers registered</div></div>
      </div>
    </div>

    <!-- Recent tasks table -->
    <div class="card">
      <div class="section-title" style="margin-bottom:16px">Recent Tasks</div>
      <div id="tasks-table"><div class="empty">No tasks yet</div></div>
    </div>
  </div>

  <script>
    const TOKEN_KEY = 'jq_token';

    async function getToken() {
      let token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        const email = prompt('Email (default: admin@jobqueue.dev):') || 'admin@jobqueue.dev';
        const password = prompt('Password (default: password123):') || 'password123';
        const r = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const d = await r.json();
        if (d.token) { localStorage.setItem(TOKEN_KEY, d.token); return d.token; }
        alert('Login failed: ' + (d.error || 'unknown'));
        return null;
      }
      return token;
    }

    function fmtDuration(ms) {
      if (!ms || ms === 0) return '–';
      if (ms < 1000) return ms + 'ms';
      if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
      return (ms / 60000).toFixed(1) + 'm';
    }

    function fmtDate(d) {
      if (!d) return '–';
      return new Date(d).toLocaleTimeString();
    }

    function statusBadge(s) {
      return '<span class="status-badge status-' + s + '">' + s + '</span>';
    }

    function priorityLabel(p) {
      return '<span class="priority-' + p + '">' + p + '</span>';
    }

    async function refresh(token) {
      const [statsRes, tasksRes] = await Promise.all([
        fetch('/api/stats', { headers: { Authorization: 'Bearer ' + token } }),
        fetch('/api/tasks?limit=15', { headers: { Authorization: 'Bearer ' + token } }),
      ]);

      if (statsRes.status === 401 || tasksRes.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        location.reload();
        return;
      }

      const stats = await statsRes.json();
      const tasksData = await tasksRes.json();

      // KPIs
      document.getElementById('kpi-total').textContent = stats.tasks.total.toLocaleString();
      document.getElementById('kpi-success').textContent = stats.tasks.success_rate + '%';
      document.getElementById('kpi-avg').textContent = fmtDuration(stats.tasks.avg_processing_ms);
      document.getElementById('kpi-queue').textContent = stats.queue.total.toLocaleString();

      // Queue depth
      document.getElementById('q-high').textContent = stats.queue.high;
      document.getElementById('q-normal').textContent = stats.queue.normal;
      document.getElementById('q-low').textContent = stats.queue.low;
      document.getElementById('q-dead').textContent = stats.queue.dead;

      // Status breakdown
      const t = stats.tasks;
      const breakdown = [
        { label: 'Pending', val: t.pending, cls: 'yellow', pct: t.total ? Math.round(t.pending/t.total*100) : 0 },
        { label: 'Processing', val: t.processing, cls: 'green', pct: t.total ? Math.round(t.processing/t.total*100) : 0 },
        { label: 'Completed', val: t.completed, cls: 'green', pct: t.total ? Math.round(t.completed/t.total*100) : 0 },
        { label: 'Failed', val: t.failed, cls: 'red', pct: t.total ? Math.round(t.failed/t.total*100) : 0 },
        { label: 'Dead', val: t.dead, cls: 'red', pct: t.total ? Math.round(t.dead/t.total*100) : 0 },
      ];
      document.getElementById('status-breakdown').innerHTML = breakdown.map(b => \`
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px">\${b.label}</span>
            <span style="font-size:13px;font-weight:600">\${b.val}</span>
          </div>
          <div class="bar-container">
            <div class="bar bar-\${b.cls}" style="width:\${b.pct}%"></div>
          </div>
        </div>
      \`).join('');

      // Workers
      const wList = stats.workers.list;
      document.getElementById('workers-list').innerHTML = wList.length === 0
        ? '<div class="empty">No workers registered</div>'
        : wList.map(w => \`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1e293b">
            <div>
              <div style="font-size:13px;font-weight:500">\${w.hostname}</div>
              <div style="font-size:11px;color:#64748b">pid \${w.pid} · ✓\${w.tasks_processed} ✗\${w.tasks_failed}</div>
            </div>
            <span class="worker-\${w.status}" style="font-size:12px;font-weight:600">\${w.status.toUpperCase()}</span>
          </div>
        \`).join('');

      // Recent tasks
      const tasks = tasksData.tasks || [];
      document.getElementById('tasks-table').innerHTML = tasks.length === 0
        ? '<div class="empty">No tasks yet — POST to /api/tasks to create one</div>'
        : \`<table>
          <thead><tr>
            <th>ID</th><th>Type</th><th>Priority</th><th>Status</th>
            <th>Retries</th><th>Created</th><th>Duration</th>
          </tr></thead>
          <tbody>\${tasks.map(task => {
            const dur = task.started_at && task.completed_at
              ? new Date(task.completed_at) - new Date(task.started_at) : null;
            return \`<tr>
              <td style="font-family:monospace;font-size:11px;color:#64748b">\${task.id.slice(0,8)}…</td>
              <td>\${task.type}</td>
              <td>\${priorityLabel(task.priority)}</td>
              <td>\${statusBadge(task.status)}</td>
              <td style="text-align:center">\${task.retry_count}/\${task.max_retries}</td>
              <td>\${fmtDate(task.created_at)}</td>
              <td>\${fmtDuration(dur)}</td>
            </tr>\`;
          }).join('')}</tbody>
        </table>\`;

      document.getElementById('last-updated').textContent =
        '<span class="spinner"></span>Updated ' + new Date().toLocaleTimeString();
    }

    (async () => {
      const token = await getToken();
      if (!token) return;
      await refresh(token);
      setInterval(() => refresh(token), 3000);
    })();
  </script>
</body>
</html>`;
}
//# sourceMappingURL=index.js.map