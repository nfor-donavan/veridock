import { useEffect, useMemo, useState, useRef } from 'react';
import { api, fileUrl, TRACKER, fmtN, money, TYPES } from './api.js';
import Tariff from './Tariff.jsx';
import Analytics from './Analytics.jsx';

const STEPS = ['Manifest registered', 'Declaration lodged', 'Duties assessed', 'Duties paid', 'Inspection', 'Gate pass issued'];
const RISK = {
  SAFE: { label: 'Safe', cls: 'safe' }, WARNING: { label: 'Nearing limit', cls: 'warn' },
  CRITICAL_RISK: { label: 'Critical', cls: 'crit' }, FINES_ACCUMULATING: { label: 'Fines accruing', cls: 'fine' }, CLEARED: { label: 'Cleared', cls: 'done' }
};
const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function Logo({ size = 34 }) {
  return (<svg width={size} height={size} viewBox="0 0 180 180" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#12A5B0" /><stop offset="1" stopColor="#0A1B2E" /></linearGradient></defs>
    <path d="M90 0 172 45v90L90 180 8 135V45z" fill="url(#lg)" /><path d="M90 14 160 52v76L90 166 20 128V52z" fill="none" stroke="#C9A24B" strokeWidth="3" />
    <g fill="#F3F5F4" opacity=".92"><rect x="52" y="58" width="36" height="22" rx="2" /><rect x="92" y="58" width="36" height="22" rx="2" /><rect x="72" y="84" width="36" height="22" rx="2" /></g>
    <path d="M56 128 82 112 98 124 134 92" fill="none" stroke="#C9A24B" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}

function Login({ onDone }) {
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    try { const r = await api('/auth/login', { method: 'POST', body: f }); localStorage.setItem('vd_token', r.token); localStorage.setItem('vd_me', JSON.stringify(r)); onDone(r); }
    catch (e) { setErr(e.message); } setBusy(false);
  };
  return (
    <div className="login">
      <div className="login-art">
        <Logo size={64} />
        <h1>Every stamp, every receipt, on the record.</h1>
        <p>Veridock gives importers live, document-backed visibility into customs clearance at Douala and Kribi.</p>
        <div className="quay" aria-hidden="true">{Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ height: 30 + ((i * 37) % 70), background: ['#12A5B0', '#C9A24B', '#2E6F95', '#9B3D2F'][i % 4] }} />)}</div>
      </div>
      <div className="login-form">
        <h2>Transit Desk sign in</h2>
        <label>Email<input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoFocus /></label>
        <label>Password<input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && submit()} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </div>
    </div>
  );
}

function NewModal({ onClose, onSaved, port }) {
  const [f, setF] = useState({ billOfLading: '', containerNumber: '', camcisReference: '', importerName: '', importerPhone: '', shippingLine: 'Maersk', containerType: '20DRY', demurrageFreeDays: 11, arrivalDate: new Date().toISOString().slice(0, 10), port });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { await api('/consignments', { method: 'POST', body: f }); onSaved(); } catch (e) { setErr(e.message); } };
  return (
    <div className="overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Register container">
      <h3>Register a container</h3>
      <div className="grid2">
        <label>Bill of lading<input value={f.billOfLading} onChange={set('billOfLading')} /></label>
        <label>Container number<input value={f.containerNumber} onChange={set('containerNumber')} placeholder="MSKU9876543" /></label>
        <label>CAMCIS reference (optional)<input value={f.camcisReference} onChange={set('camcisReference')} /></label>
        <label>Importer name<input value={f.importerName} onChange={set('importerName')} /></label>
        <label>Importer phone<input value={f.importerPhone} onChange={set('importerPhone')} placeholder="6XX XXX XXX" /></label>
        <label>Container type<select value={f.containerType} onChange={set('containerType')}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Shipping line<select value={f.shippingLine} onChange={set('shippingLine')}>{['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'COSCO', 'Other'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Free demurrage days<input type="number" min="0" value={f.demurrageFreeDays} onChange={set('demurrageFreeDays')} /></label>
        <label>Arrival date<input type="date" value={f.arrivalDate} onChange={set('arrivalDate')} /></label>
        <label>Port<select value={f.port} onChange={set('port')}><option value="DOUALA">Douala</option><option value="KRIBI">Kribi</option></select></label>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row end"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Register container</button></div>
    </div></div>
  );
}

function Drawer({ id, me, onClose, onChanged }) {
  const [c, setC] = useState(null); const [sms, setSms] = useState([]);
  const [file, setFile] = useState(null); const [notes, setNotes] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  const inp = useRef();
  const load = async () => { setC(await api('/consignments/' + id)); setSms(await api(`/consignments/${id}/sms`)); };
  useEffect(() => { load(); }, [id]);
  if (!c) return <aside className="drawer"><p>Loading…</p></aside>;
  const next = STEPS[c.step]; const link = `${TRACKER}/bl/${c.publicToken}`;
  const advance = async () => {
    setBusy(true); setErr('');
    try { const form = new FormData(); if (file) form.append('proof', file); form.append('notes', notes); await api(`/consignments/${id}/advance`, { method: 'POST', form }); setFile(null); setNotes(''); await load(); onChanged(); }
    catch (e) { setErr(e.message); } setBusy(false);
  };
  const setCamcis = async () => {
    const v = prompt('CAMCIS declaration reference'); if (!v) return;
    try { await api(`/consignments/${id}/camcis`, { method: 'PATCH', body: { camcisReference: v } }); await load(); onChanged(); } catch (e) { setErr(e.message); }
  };
  const revert = async () => {
    const reason = prompt('Why is this milestone being reversed? (recorded in the audit trail)'); if (!reason) return;
    try { await api(`/consignments/${id}/revert`, { method: 'POST', body: { reason } }); await load(); onChanged(); } catch (e) { setErr(e.message); }
  };
  const r = RISK[c.riskLevel];
  return (
    <aside className="drawer" aria-label="Container details">
      <div className="row between"><div><h3>{c.containerNumber}</h3><p className="muted">B/L {c.billOfLading} · {c.shippingLine}</p></div><button className="btn" onClick={onClose}>Close</button></div>
      <div className={`banner ${r.cls}`}><b>{r.label}</b>{c.riskLevel !== 'CLEARED' && <span>{c.daysRemaining >= 0 ? `${c.daysRemaining} free day(s) left of ${c.demurrageFreeDays}` : `${Math.abs(c.daysRemaining)} day(s) past the free period`}</span>}</div>
      <div className="dm"><b>Estimated storage charges (demurrage)</b><span>{c.demurrage.estMax ? `${money(c.demurrage)} XAF` : 'None so far'}</span>
        <small>{TYPES[c.containerType]} · {c.demurrage.chargeableDays} chargeable day(s){c.demurrage.tier2Days > 0 && `, ${c.demurrage.tier2Days} at the extended-stay rate`}{c.riskLevel !== 'CLEARED' && c.demurrage.currentDailyMax > 0 && ` · now adding ${fmtN(c.demurrage.currentDailyMin)} to ${fmtN(c.demurrage.currentDailyMax)} XAF per day`}</small></div>
      <dl className="facts"><dt>Importer</dt><dd>{c.importerName}</dd><dt>Phone</dt><dd>{c.importerPhone}</dd><dt>CAMCIS ref</dt><dd>{c.camcisReference || <em className="muted">Not recorded</em>} <button className="btn link inline" onClick={setCamcis}>{c.camcisReference ? 'Change' : 'Add'}</button></dd><dt>Arrived</dt><dd>{fmt(c.arrivalDate)} at {c.port === 'KRIBI' ? 'Kribi' : 'Douala'}</dd></dl>
      <div className="row"><input readOnly value={link} className="grow" onFocus={e => e.target.select()} /><button className="btn" onClick={() => navigator.clipboard.writeText(link)}>Copy tracking link</button></div>

      <h4>Clearance record</h4>
      <ol className="stepper">
        {STEPS.map((s, i) => {
          const h = c.milestoneHistory.filter(x => x.action === 'ADVANCE' && x.milestone === ['SGS_MANIFEST_ENTRY', 'CUSTOMS_DECLARATION', 'LIQUIDATION_SETTLED', 'BANK_DUTY_PAYMENT', 'PORT_PHYSICAL_INSPECTION', 'GATE_PASS_ISSUED'][i]).slice(-1)[0];
          return (<li key={s} className={i + 1 < c.step ? 'done' : i + 1 === c.step ? 'cur' : ''}><span className="dot" />
            <div><b>{s}</b>{h && <small>{fmt(h.updatedAt)} · {h.updatedByName}{h.proofDocumentUrl && <> · <a href={fileUrl(h.proofDocumentUrl)} target="_blank" rel="noreferrer">View proof</a></>}</small>}</div></li>);
        })}
      </ol>

      {next ? (
        <div className="advance">
          <h4>Move to: {next}</h4>
          <div className={`drop ${drag ? 'over' : ''}`} onClick={() => inp.current.click()} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0]); }} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && inp.current.click()}>
            <input ref={inp} type="file" accept="image/*,application/pdf" hidden onChange={e => setFile(e.target.files[0])} />
            {file ? <b>{file.name}</b> : <span>Drop the stamped document here, or tap to take a photo</span>}
          </div>
          <input placeholder="Note for the record (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn primary" disabled={busy || !file} onClick={advance}>{busy ? 'Saving…' : 'Confirm milestone and notify importer'}</button>
        </div>
      ) : <p className="muted">All milestones complete. The demurrage clock stopped at gate pass.</p>}
      {me.user.role === 'MANAGER' && c.step > 1 && <button className="btn link" onClick={revert}>Reverse last milestone (manager)</button>}

      <h4>Audit trail</h4>
      <ul className="audit">{[...c.milestoneHistory].reverse().map(h => <li key={h._id}><b>{h.action === 'REVERT' ? 'Reversed' : 'Advanced'}</b> {h.milestone.replaceAll('_', ' ').toLowerCase()} · {h.updatedByName} · {fmt(h.updatedAt)}{h.notes && <em> “{h.notes}”</em>}{h.proofSha256 && <small>SHA-256 {h.proofSha256.slice(0, 16)}…</small>}</li>)}</ul>
      <h4>Messages sent</h4>
      {sms.length === 0 ? <p className="muted">No SMS sent yet.</p> : <ul className="audit">{sms.map(m => <li key={m._id}><b>{m.status}</b> to {m.to} · {fmt(m.createdAt)}</li>)}</ul>}
    </aside>
  );
}

function Dashboard({ me, onLogout }) {
  const [list, setList] = useState([]); const [filter, setFilter] = useState('ALL'); const [q, setQ] = useState(''); const [open, setOpen] = useState(null); const [adding, setAdding] = useState(false); const [view, setView] = useState('containers');
  const load = async () => setList(await api('/consignments'));
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  const counts = useMemo(() => list.reduce((a, c) => ({ ...a, [c.riskLevel]: (a[c.riskLevel] || 0) + 1 }), {}), [list]);
  const rows = list.filter(c => (filter === 'ALL' || c.riskLevel === filter) && (q === '' || [c.containerNumber, c.billOfLading, c.importerName].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.riskLevel === 'CLEARED') - (b.riskLevel === 'CLEARED') || a.daysRemaining - b.daysRemaining);
  const exp = list.reduce((a, c) => ({ estMin: a.estMin + c.demurrage.estMin, estMax: a.estMax + c.demurrage.estMax }), { estMin: 0, estMax: 0 });
  const urgent = (counts.CRITICAL_RISK || 0) + (counts.FINES_ACCUMULATING || 0);
  return (
    <div className="shell">
      <header className="top"><div className="row"><Logo /><div><b className="brand">Veridock</b><small>{me.agency}</small></div></div>
        <div className="row"><span className="muted">{me.user.name}</span><button className="btn" onClick={() => { localStorage.clear(); onLogout(); }}>Sign out</button></div></header>
      <nav className="tabs"><button className={view === 'containers' ? 'on' : ''} onClick={() => setView('containers')}>Containers</button><button className={view === 'analytics' ? 'on' : ''} onClick={() => setView('analytics')}>Performance</button>{me.user.role === 'MANAGER' && <button className={view === 'tariff' ? 'on' : ''} onClick={() => setView('tariff')}>Demurrage tariff</button>}</nav>
      {view === 'analytics' ? <main><Analytics /></main> : view === 'tariff' ? <main><Tariff /></main> : <main>
        {urgent > 0 && <div className="alarm" role="alert"><span className="blink" />{urgent} container{urgent > 1 ? 's need' : ' needs'} paperwork pushed today to avoid or stop demurrage.</div>}
        <div className="stats">
          {[['ALL', 'All containers', list.length, ''], ['SAFE', 'Safe', counts.SAFE || 0, 'safe'], ['WARNING', 'Nearing limit', counts.WARNING || 0, 'warn'], ['CRITICAL_RISK', 'Critical', counts.CRITICAL_RISK || 0, 'crit'], ['FINES_ACCUMULATING', 'Fines accruing', counts.FINES_ACCUMULATING || 0, 'fine'], ['CLEARED', 'Cleared', counts.CLEARED || 0, 'done']]
            .map(([k, l, n, cls]) => <button key={k} className={`stat ${cls} ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}><span>{n}</span>{l}</button>)}
        </div>
        {exp.estMax > 0 && <p className="exposure">Estimated demurrage so far across all containers: <b>{money(exp)} XAF</b></p>}
        <div className="row between bar"><input className="search" placeholder="Search container, B/L or importer" value={q} onChange={e => setQ(e.target.value)} /><button className="btn primary" onClick={() => setAdding(true)}>Register container</button></div>
        <div className="tablewrap"><table>
          <thead><tr><th>Container</th><th>Importer</th><th>Line</th><th>Progress</th><th>Free days left</th><th>Est. storage charges</th><th>Status</th></tr></thead>
          <tbody>{rows.map(c => { const r = RISK[c.riskLevel]; return (
            <tr key={c._id} className={`risk-${r.cls}`} onClick={() => setOpen(c._id)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setOpen(c._id)}>
              <td><b>{c.containerNumber}</b><small>{c.billOfLading}</small></td><td>{c.importerName}</td><td>{c.shippingLine}</td>
              <td><div className="seg">{STEPS.map((_, i) => <i key={i} className={i < c.step ? 'on' : ''} />)}</div><small>Step {c.step} of 6</small></td>
              <td className="num">{c.riskLevel === 'CLEARED' ? '—' : c.daysRemaining}</td><td>{c.demurrage.estMax ? <><b>{money(c.demurrage)}</b><small>XAF · {TYPES[c.containerType]}</small></> : <small>None yet · {TYPES[c.containerType]}</small>}</td><td><span className={`chip ${r.cls}`}>{r.label}</span></td></tr>); })}
            {rows.length === 0 && <tr><td colSpan="7" className="empty">No containers match. Register a container to start tracking it.</td></tr>}</tbody></table></div>
      </main>}
      {open && <Drawer id={open} me={me} onClose={() => setOpen(null)} onChanged={load} />}
      {adding && <NewModal port={me.port} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState(() => { try { return localStorage.getItem('vd_token') ? JSON.parse(localStorage.getItem('vd_me')) : null; } catch { return null; } });
  return me ? <Dashboard me={me} onLogout={() => setMe(null)} /> : <Login onDone={setMe} />;
}
