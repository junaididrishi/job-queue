def get_dashboard_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Queue Dashboard</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
    header{background:#1e293b;border-bottom:1px solid #334155;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}
    header h1{font-size:20px;font-weight:700;color:#f8fafc}
    .live{background:#22c55e;color:#fff;font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:600}
    .container{max-width:1200px;margin:0 auto;padding:24px}
    .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
    .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
    .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px}
    .card-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin-bottom:8px}
    .metric{font-size:36px;font-weight:700;color:#f8fafc;line-height:1}
    .metric.blue{color:#3b82f6}.metric.green{color:#22c55e}.metric.yellow{color:#eab308}
    .section-title{font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:8px 12px;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;border-bottom:1px solid #334155}
    td{padding:10px 12px;border-bottom:1px solid #1e293b;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600}
    .s-pending{background:#1e3a5f;color:#60a5fa}.s-processing{background:#1c2d3a;color:#34d399}
    .s-completed{background:#14532d;color:#86efac}.s-failed{background:#450a0a;color:#fca5a5}
    .s-dead{background:#2d1f1f;color:#f87171}
    .p-high{color:#f87171;font-weight:600}.p-normal{color:#94a3b8}.p-low{color:#475569}
    .bar-wrap{background:#0f172a;border-radius:4px;height:6px;overflow:hidden;margin-top:4px}
    .bar{height:100%;border-radius:4px;transition:width .5s}
    .bar-green{background:#22c55e}.bar-yellow{background:#eab308}.bar-red{background:#ef4444}
    .q-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1e293b}
    .q-row:last-child{border-bottom:none}
    .q-count{font-size:20px;font-weight:700}
    .empty{text-align:center;padding:32px;color:#475569;font-size:14px}
    #ts{font-size:12px;color:#475569}
  </style>
</head>
<body>
<header>
  <h1>⚡ Job Queue Dashboard</h1>
  <div style="display:flex;align-items:center;gap:12px">
    <span id="ts">Loading...</span><span class="live">LIVE</span>
  </div>
</header>
<div class="container">
  <div class="grid-4">
    <div class="card"><div class="card-title">Total Tasks</div><div class="metric blue" id="kpi-total">–</div></div>
    <div class="card"><div class="card-title">Success Rate</div><div class="metric green" id="kpi-sr">–</div></div>
    <div class="card"><div class="card-title">Avg Processing</div><div class="metric" id="kpi-avg">–</div></div>
    <div class="card"><div class="card-title">Queue Depth</div><div class="metric yellow" id="kpi-q">–</div></div>
  </div>
  <div class="grid-3">
    <div class="card"><div class="section-title">Task Status</div><div id="status-bd"></div></div>
    <div class="card">
      <div class="section-title">Queue by Priority</div>
      <div class="q-row"><span class="p-high">🔴 High</span><span class="q-count" id="q-high">–</span></div>
      <div class="q-row"><span class="p-normal">🟡 Normal</span><span class="q-count" id="q-normal">–</span></div>
      <div class="q-row"><span class="p-low">⚪ Low</span><span class="q-count" id="q-low">–</span></div>
      <div class="q-row" style="border-top:1px solid #334155;margin-top:8px;padding-top:8px">
        <span style="color:#ef4444">💀 Dead Letter</span><span class="q-count" id="q-dead">–</span>
      </div>
    </div>
    <div class="card"><div class="section-title">Workers</div><div id="workers"></div></div>
  </div>
  <div class="card"><div class="section-title" style="margin-bottom:16px">Recent Tasks</div><div id="tasks-tbl"></div></div>
</div>
<script>
const TK='jq_token';
async function getToken(){
  let t=localStorage.getItem(TK);
  if(!t){
    const e=prompt('Email (admin@jobqueue.dev):')||'admin@jobqueue.dev';
    const p=prompt('Password (password123):')||'password123';
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})});
    const d=await r.json();
    if(d.access_token){localStorage.setItem(TK,d.access_token);return d.access_token;}
    alert('Login failed');return null;
  }
  return t;
}
function fmt(ms){if(!ms||ms===0)return'–';if(ms<1000)return ms+'ms';if(ms<60000)return(ms/1000).toFixed(1)+'s';return(ms/60000).toFixed(1)+'m';}
function fmtDate(d){return d?new Date(d).toLocaleTimeString():'–';}
function badge(s){return`<span class="badge s-${s}">${s}</span>`;}
async function refresh(token){
  const [sr,tr]=await Promise.all([
    fetch('/api/stats',{headers:{Authorization:'Bearer '+token}}),
    fetch('/api/tasks?limit=15',{headers:{Authorization:'Bearer '+token}}),
  ]);
  if(sr.status===401||tr.status===401){localStorage.removeItem(TK);location.reload();return;}
  const s=await sr.json(),td=await tr.json();
  document.getElementById('kpi-total').textContent=s.tasks.total.toLocaleString();
  document.getElementById('kpi-sr').textContent=s.tasks.success_rate+'%';
  document.getElementById('kpi-avg').textContent=fmt(s.tasks.avg_processing_ms);
  document.getElementById('kpi-q').textContent=s.queue.total.toLocaleString();
  document.getElementById('q-high').textContent=s.queue.high;
  document.getElementById('q-normal').textContent=s.queue.normal;
  document.getElementById('q-low').textContent=s.queue.low;
  document.getElementById('q-dead').textContent=s.queue.dead;
  const t=s.tasks,bd=[
    {l:'Pending',v:t.pending,c:'yellow',pct:t.total?Math.round(t.pending/t.total*100):0},
    {l:'Processing',v:t.processing,c:'green',pct:t.total?Math.round(t.processing/t.total*100):0},
    {l:'Completed',v:t.completed,c:'green',pct:t.total?Math.round(t.completed/t.total*100):0},
    {l:'Failed',v:t.failed,c:'red',pct:t.total?Math.round(t.failed/t.total*100):0},
    {l:'Dead',v:t.dead,c:'red',pct:t.total?Math.round(t.dead/t.total*100):0},
  ];
  document.getElementById('status-bd').innerHTML=bd.map(b=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between"><span style="font-size:13px">${b.l}</span><span style="font-size:13px;font-weight:600">${b.v}</span></div><div class="bar-wrap"><div class="bar bar-${b.c}" style="width:${b.pct}%"></div></div></div>`).join('');
  const wl=s.workers.list;
  document.getElementById('workers').innerHTML=wl.length===0?'<div class="empty">No workers</div>':wl.map(w=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1e293b"><div><div style="font-size:13px;font-weight:500">${w.hostname}</div><div style="font-size:11px;color:#64748b">pid ${w.pid} · ✓${w.tasks_processed} ✗${w.tasks_failed}</div></div><span style="font-size:12px;font-weight:600;color:${w.status==='idle'?'#22c55e':w.status==='busy'?'#eab308':'#475569'}">${w.status.toUpperCase()}</span></div>`).join('');
  const tasks=td.tasks||[];
  document.getElementById('tasks-tbl').innerHTML=tasks.length===0?'<div class="empty">No tasks yet</div>':`<table><thead><tr><th>ID</th><th>Type</th><th>Priority</th><th>Status</th><th>Retries</th><th>Created</th><th>Duration</th></tr></thead><tbody>${tasks.map(t=>{const dur=t.started_at&&t.completed_at?new Date(t.completed_at)-new Date(t.started_at):null;return`<tr><td style="font-family:monospace;font-size:11px;color:#64748b">${t.id.slice(0,8)}…</td><td>${t.type}</td><td><span class="p-${t.priority}">${t.priority}</span></td><td>${badge(t.status)}</td><td style="text-align:center">${t.retry_count}/${t.max_retries}</td><td>${fmtDate(t.created_at)}</td><td>${fmt(dur)}</td></tr>`;}).join('')}</tbody></table>`;
  document.getElementById('ts').textContent='Updated '+new Date().toLocaleTimeString();
}
(async()=>{const t=await getToken();if(!t)return;await refresh(t);setInterval(()=>refresh(t),3000);})();
</script>
</body>
</html>"""
