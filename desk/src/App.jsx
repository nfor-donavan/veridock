import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiBlob, fileUrl, TRACKER, fmtN, money, TYPES } from './api.js';
import { t, getLang, setLang } from './i18n.js';
import { getTheme, toggleTheme } from './theme.js';
import Analytics from './Analytics.jsx';
import Tariff from './Tariff.jsx';
import Owner from './Owner.jsx';

const Rerender = createContext(() => {});
const MS = ['SGS_MANIFEST_ENTRY', 'CUSTOMS_DECLARATION', 'LIQUIDATION_SETTLED', 'BANK_DUTY_PAYMENT', 'PORT_PHYSICAL_INSPECTION', 'GATE_PASS_ISSUED'];
const STEPS = ['Manifest registered', 'Declaration lodged', 'Duties assessed', 'Duties paid', 'Inspection', 'Gate pass issued'];
const RISK = {
  SAFE: { label: 'Safe', cls: 'safe' }, WARNING: { label: 'Nearing limit', cls: 'warn' }, CRITICAL_RISK: { label: 'Critical', cls: 'crit' },
  FINES_ACCUMULATING: { label: 'Fines accruing', cls: 'fine' }, CLEARED: { label: 'Cleared', cls: 'done' }
};
const CHECKS = { NO_CAMERA_DATA: 'No camera data: possibly a screenshot, forwarded copy or edited image.', EDITING_SOFTWARE: 'Saved by image-editing software.', STALE_PHOTO: 'Photo taken more than 3 days before upload.', PHOTO_BEFORE_ARRIVAL: 'Photo taken before the container arrived.', FUTURE_DATE: 'Photo date is in the future (phone clock changed?).', REUSED_DOCUMENT: 'This exact file was already used before.' };
const fmt = (d) => new Date(d).toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function Logo({ size = 34 }) {
  return (<svg width={size} height={size} viewBox="0 0 180 180" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#12A5B0" /><stop offset="1" stopColor="#0A1B2E" /></linearGradient></defs>
    <path d="M90 0 172 45v90L90 180 8 135V45z" fill="url(#lg)" /><path d="M90 14 160 52v76L90 166 20 128V52z" fill="none" stroke="#C9A24B" strokeWidth="3" />
    <g fill="#F3F5F4" opacity=".92"><rect x="52" y="58" width="36" height="22" rx="2" /><rect x="92" y="58" width="36" height="22" rx="2" /><rect x="72" y="84" width="36" height="22" rx="2" /></g>
    <path d="M56 128 82 112 98 124 134 92" fill="none" stroke="#C9A24B" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}

function Tools() {
  const rerender = useContext(Rerender); const dark = getTheme() === 'dark';
  return (<div className="tools">
    <button className="tool" onClick={() => { setLang(getLang() === 'fr' ? 'en' : 'fr'); rerender(); }} aria-label={t('Change language')}>{getLang() === 'fr' ? 'EN' : 'FR'}</button>
    <button className="tool" onClick={() => { toggleTheme(); rerender(); }} aria-label={t('Toggle light or dark mode')}>
      {dark ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
    </button></div>);
}

function Login({ onDone }) {
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    try { const r = await api('/auth/login', { method: 'POST', body: f, token: null }); localStorage.setItem('vd_token', r.token); localStorage.setItem('vd_me', JSON.stringify(r)); onDone(r); }
    catch (e) { setErr(e.message); } setBusy(false);
  };
  return (
    <div className="login">
      <div className="login-art">
        <Logo size={64} /><h1>{t('Every stamp, every receipt, on the record.')}</h1>
        <p>{t('Veridock gives importers live, document-backed visibility into customs clearance at Douala and Kribi.')}</p>
        <div className="quay" aria-hidden="true">{Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ height: 30 + ((i * 37) % 70), background: ['#12A5B0', '#C9A24B', '#2E6F95', '#9B3D2F'][i % 4] }} />)}</div>
      </div>
      <div className="login-form">
        <div className="row end"><Tools /></div>
        <h2>{t('Transit Desk sign in')}</h2>
        <label>{t('Email')}<input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoFocus /></label>
        <label>{t('Password')}<input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && submit()} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" disabled={busy} onClick={submit}>{busy ? t('Signing in…') : t('Sign in')}</button>
        <a className="muted small" href="#/owner">{t('Platform owner')}</a>
      </div>
    </div>
  );
}

function NewModal({ onClose, onSaved, port }) {
  const [f, setF] = useState({ billOfLading: '', containerNumber: '', camcisReference: '', importerName: '', importerPhone: '', shippingLine: 'Maersk', containerType: '20DRY', demurrageFreeDays: 11, arrivalDate: new Date().toISOString().slice(0, 10), port, importerLanguage: 'fr' });
  const [err, setErr] = useState(''); const [tariff, setTariff] = useState(null);
  const carrierFree = (tf, line) => tf?.carriers?.[line.toUpperCase()]?.freeDays;
  useEffect(() => { api('/consignments/tariff').then(tf => { setTariff(tf); const d = carrierFree(tf, 'Maersk'); if (d != null) setF(x => ({ ...x, demurrageFreeDays: d })); }).catch(() => {}); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setLine = (e) => { const v = e.target.value, d = carrierFree(tariff, v); setF({ ...f, shippingLine: v, demurrageFreeDays: d != null ? d : f.demurrageFreeDays }); };
  const save = async () => { try { await api('/consignments', { method: 'POST', body: f }); onSaved(); } catch (e) { setErr(e.message); } };
  return (
    <div className="overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={t('Register a container')}>
      <h3>{t('Register a container')}</h3>
      <div className="grid2">
        <label>{t('Bill of lading')}<input value={f.billOfLading} onChange={set('billOfLading')} /></label>
        <label>{t('Container number')}<input value={f.containerNumber} onChange={set('containerNumber')} placeholder="MSKU9876543" /></label>
        <label>{t('CAMCIS reference (optional)')}<input value={f.camcisReference} onChange={set('camcisReference')} /></label>
        <label>{t('Importer name')}<input value={f.importerName} onChange={set('importerName')} /></label>
        <label>{t('Importer phone')}<input value={f.importerPhone} onChange={set('importerPhone')} placeholder="6XX XXX XXX" /></label>
        <label>{t('SMS language for the importer')}<select value={f.importerLanguage} onChange={set('importerLanguage')}><option value="fr">Français</option><option value="en">English</option></select></label>
        <label>{t('Container type')}<select value={f.containerType} onChange={set('containerType')}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>{t('Shipping line')}<select value={f.shippingLine} onChange={setLine}>{['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'COSCO', 'Other'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>{t('Free demurrage days')}<input type="number" min="0" value={f.demurrageFreeDays} onChange={set('demurrageFreeDays')} /></label>
        <label>{t('Arrival date')}<input type="date" value={f.arrivalDate} onChange={set('arrivalDate')} /></label>
        <label>{t('Port')}<select value={f.port} onChange={set('port')}><option value="DOUALA">Douala</option><option value="KRIBI">Kribi</option></select></label>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row end"><button className="btn" onClick={onClose}>{t('Cancel')}</button><button className="btn primary" onClick={save}>{t('Register container')}</button></div>
    </div></div>
  );
}

function Drawer({ id, me, onClose, onChanged }) {
  const [c, setC] = useState(null); const [sms, setSms] = useState([]); const [copied, setCopied] = useState(false);
  const [file, setFile] = useState(null); const [notes, setNotes] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  const inp = useRef(); const isMgr = me.user.role === 'MANAGER';
  const load = async () => { setC(await api('/consignments/' + id)); setSms(await api(`/consignments/${id}/sms`)); };
  useEffect(() => { load(); }, [id]);
  if (!c) return <aside className="drawer"><p>{t('Loading…')}</p></aside>;
  const next = STEPS[c.step]; const link = `${TRACKER}/bl/${c.publicToken}`; const dm = c.demurrage;
  const advance = async () => {
    setBusy(true); setErr('');
    try { const form = new FormData(); if (file) form.append('proof', file); form.append('notes', notes); await api(`/consignments/${id}/advance`, { method: 'POST', form }); setFile(null); setNotes(''); await load(); onChanged(); }
    catch (e) { setErr(e.message); } setBusy(false);
  };
  const revert = async () => {
    const reason = prompt(t('Why is this milestone being reversed? (recorded in the audit trail)')); if (!reason) return;
    try { await api(`/consignments/${id}/revert`, { method: 'POST', body: { reason } }); await load(); onChanged(); } catch (e) { setErr(e.message); }
  };
  const setCamcis = async () => {
    const v = prompt(t('CAMCIS declaration reference')); if (!v) return;
    try { await api(`/consignments/${id}/camcis`, { method: 'PATCH', body: { camcisReference: v } }); await load(); onChanged(); } catch (e) { setErr(e.message); }
  };
  const review = async (h) => {
    const note = prompt(t('Note about your review (optional)')) ?? null; if (note === null) return;
    try { await api(`/consignments/${id}/history/${h._id}/review`, { method: 'POST', body: { note } }); await load(); onChanged(); } catch (e) { setErr(e.message); }
  };
  const report = async () => {
    const w = window.open('about:blank', '_blank');
    try { const blob = await apiBlob(`/consignments/${id}/report?lang=${getLang()}`); w.location = URL.createObjectURL(blob); } catch (e) { w && w.close(); setErr(e.message); }
  };
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const r = RISK[c.riskLevel];
  return (
    <aside className="drawer" aria-label={t('Container details')}>
      <div className="row between"><div><h3>{c.containerNumber}</h3><p className="muted">B/L {c.billOfLading} · {c.shippingLine}</p></div><button className="btn" onClick={onClose}>{t('Close')}</button></div>
      <div className={`banner ${r.cls}`}><b>{t(r.label)}</b>{c.riskLevel !== 'CLEARED' && <span>{c.daysRemaining >= 0 ? `${c.daysRemaining} ${t('free day(s) left of {n}', { n: c.demurrageFreeDays })}` : `${Math.abs(c.daysRemaining)} ${t('day(s) past the free period')}`}</span>}</div>
      <div className="dm"><b>{dm.exact && dm.chargeableDays > 0 ? t('Storage charges (carrier tariff)') : t('Estimated storage charges (demurrage)')}</b><span>{dm.estMax ? `${money(dm)} XAF` : t('None so far')}</span>
        <small>{TYPES[c.containerType]} · {dm.chargeableDays} {t('chargeable day(s)')}{dm.tier2Days > 0 && `, ${dm.tier2Days} ${t('at the extended-stay rate')}`}{c.riskLevel !== 'CLEARED' && dm.currentDailyMax > 0 && ` · ${t('now adding {a} to {b} XAF per day', { a: fmtN(dm.currentDailyMin), b: fmtN(dm.currentDailyMax) })}`}</small></div>
      <dl className="facts"><dt>{t('Importer')}</dt><dd>{c.importerName}</dd><dt>{t('Phone')}</dt><dd>{c.importerPhone}</dd>
        <dt>{t('CAMCIS ref')}</dt><dd>{c.camcisReference || <em className="muted">{t('Not recorded')}</em>} <button className="btn link inline" onClick={setCamcis}>{c.camcisReference ? t('Change') : t('Add')}</button></dd>
        <dt>{t('Arrived')}</dt><dd>{fmt(c.arrivalDate)} {t('at')} {c.port === 'KRIBI' ? 'Kribi' : 'Douala'}</dd></dl>
      <div className="row"><input readOnly value={link} className="grow" onFocus={e => e.target.select()} /><button className="btn" onClick={copy}>{copied ? t('Copied') : t('Copy tracking link')}</button></div>
      <button className="btn" onClick={report}>{t('Clearance report (PDF)')}</button>

      <h4>{t('Clearance record')}</h4>
      <ol className="stepper">
        {STEPS.map((s, i) => {
          const h = c.milestoneHistory.filter(x => x.action === 'ADVANCE' && x.milestone === MS[i]).slice(-1)[0];
          return (<li key={s} className={i + 1 < c.step ? 'done' : i + 1 === c.step ? 'cur' : ''}><span className="dot" />
            <div><b>{t(s)}</b>{h && <small>{fmt(h.updatedAt)} · {h.updatedByName}{h.proofDocumentUrl && <> · <a href={fileUrl(h.proofDocumentUrl)} target="_blank" rel="noreferrer">{t('View proof')}</a></>}
              {h.proofRisk === 'REVIEW' && (h.reviewedAt ? <span className="flag ok">{t('Reviewed')}</span> : <span className="flag">{t('Needs review')}</span>)}</small>}</div></li>);
        })}
      </ol>

      {next ? (
        <div className="advance">
          <h4>{t('Move to: {step}', { step: t(next) })}</h4>
          <div className={`drop ${drag ? 'over' : ''}`} onClick={() => inp.current.click()} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0]); }} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && inp.current.click()}>
            <input ref={inp} type="file" accept="image/*,application/pdf" hidden onChange={e => setFile(e.target.files[0])} />
            {file ? <b>{file.name}</b> : <span>{t('Drop the stamped document here, or tap to take a photo')}</span>}
          </div>
          <input placeholder={t('Note for the record (optional)')} value={notes} onChange={e => setNotes(e.target.value)} />
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn primary" disabled={busy || !file} onClick={advance}>{busy ? t('Saving…') : t('Confirm milestone and notify importer')}</button>
        </div>
      ) : <p className="muted">{t('All milestones complete. The demurrage clock stopped at gate pass.')}</p>}
      {!next && err && <p className="err" role="alert">{err}</p>}
      {isMgr && c.step > 1 && <button className="btn link" onClick={revert}>{t('Reverse last milestone (manager)')}</button>}

      <h4>{t('Audit trail')}</h4>
      <ul className="audit">{[...c.milestoneHistory].reverse().map(h => (
        <li key={h._id} className={h.proofRisk === 'REVIEW' && !h.reviewedAt ? 'warnli' : ''}>
          <b>{h.action === 'REVERT' ? t('Reversed') : t('Advanced')}</b> {h.milestone.replaceAll('_', ' ').toLowerCase()} · {h.updatedByName} · {fmt(h.updatedAt)}{h.notes && <em> “{h.notes}”</em>}
          {h.proofSha256 && <small>SHA-256 {h.proofSha256.slice(0, 16)}…</small>}
          {(h.proofChecks || []).filter(k => k.level !== 'info').map(k => <small key={k.code} className={`chk ${k.level}`}>⚠ {t(CHECKS[k.code] || k.message)}</small>)}
          {h.reviewedAt && <small className="chk okc">✓ {t('Reviewed by {name}', { name: h.reviewedByName })}{h.reviewNote && ` · “${h.reviewNote}”`}</small>}
          {isMgr && h.proofRisk === 'REVIEW' && !h.reviewedAt && <button className="btn link inline" onClick={() => review(h)}>{t('Mark as reviewed')}</button>}
        </li>))}</ul>
      <h4>{t('Messages sent')}</h4>
      {sms.length === 0 ? <p className="muted">{t('No SMS sent yet.')}</p> : <ul className="audit">{sms.map(m => <li key={m._id}><b>{m.status}</b> {t('to')} {m.to} · {fmt(m.createdAt)}</li>)}</ul>}
    </aside>
  );
}

function Bell({ me }) {
  const [d, setD] = useState({ alerts: [], unread: 0, myPhone: '' }); const [open, setOpen] = useState(false); const [phone, setPhone] = useState(''); const [saved, setSaved] = useState(false);
  const load = async () => { try { const r = await api('/alerts'); setD(r); setPhone(p => p || r.myPhone); } catch {} };
  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, []);
  const toggle = async () => { const was = open; setOpen(!open); if (!was && d.unread) { await api('/alerts/read-all', { method: 'POST' }); setD({ ...d, unread: 0 }); } };
  const savePhone = async () => { await api('/auth/me', { method: 'PATCH', body: { phone } }); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  return (
    <div className="bellwrap">
      <button className="tool" onClick={toggle} aria-label={t('Alerts')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>{d.unread > 0 && <span className="badge">{d.unread}</span>}</button>
      {open && <div className="bellpanel"><h4>{t('Alerts')}</h4>
        {d.alerts.length === 0 ? <p className="muted">{t('No alerts yet.')}</p> : <ul>{d.alerts.map(a => <li key={a._id} className={`${a.kind === 'PROOF_REVIEW' ? 'warnli' : 'critli'} ${a.read ? '' : 'unread'}`}>{getLang() === 'fr' ? a.messageFr : a.message}<small>{fmt(a.createdAt)}</small></li>)}</ul>}
        {me.user.role === 'MANAGER' && <div className="phone"><label>{t('SMS alerts to my phone')}<input value={phone} placeholder={t('Phone number')} onChange={e => setPhone(e.target.value)} /></label><button className="btn" onClick={savePhone}>{saved ? t('Saved') : t('Save')}</button></div>}
      </div>}
    </div>
  );
}

function Dashboard({ me, onLogout }) {
  const [list, setList] = useState([]); const [filter, setFilter] = useState('ALL'); const [q, setQ] = useState(''); const [open, setOpen] = useState(null); const [adding, setAdding] = useState(false); const [view, setView] = useState('containers');
  const load = async () => setList(await api('/consignments'));
  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, []);
  const counts = useMemo(() => list.reduce((a, c) => ({ ...a, [c.riskLevel]: (a[c.riskLevel] || 0) + 1 }), {}), [list]);
  const rows = list.filter(c => (filter === 'ALL' || c.riskLevel === filter) && (q === '' || [c.containerNumber, c.billOfLading, c.importerName].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.riskLevel === 'CLEARED') - (b.riskLevel === 'CLEARED') || a.daysRemaining - b.daysRemaining);
  const exp = list.reduce((a, c) => ({ estMin: a.estMin + c.demurrage.estMin, estMax: a.estMax + c.demurrage.estMax }), { estMin: 0, estMax: 0 });
  const urgent = (counts.CRITICAL_RISK || 0) + (counts.FINES_ACCUMULATING || 0);
  const isMgr = me.user.role === 'MANAGER';
  return (
    <div className="shell">
      <header className="top"><div className="row"><Logo /><div><b className="brand">Veridock</b><small>{me.agency}</small></div></div>
        <div className="row"><Bell me={me} /><Tools /><span className="muted hide-sm">{me.user.name}</span><button className="btn" onClick={() => { localStorage.removeItem('vd_token'); localStorage.removeItem('vd_me'); onLogout(); }}>{t('Sign out')}</button></div></header>
      <nav className="tabs">{[['containers', 'Containers'], ['analytics', 'Performance'], ...(isMgr ? [['tariff', 'Demurrage tariff']] : [])].map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{t(l)}</button>)}</nav>
      {view === 'analytics' ? <main><Analytics /></main> : view === 'tariff' ? <main><Tariff /></main> : <main>
        {urgent > 0 && <div className="alarm" role="alert"><span className="blink" />{t('{n} container(s) need paperwork pushed today to avoid or stop demurrage.', { n: urgent })}</div>}
        <div className="stats">
          {[['ALL', 'All containers', list.length, ''], ['SAFE', 'Safe', counts.SAFE || 0, 'safe'], ['WARNING', 'Nearing limit', counts.WARNING || 0, 'warn'], ['CRITICAL_RISK', 'Critical', counts.CRITICAL_RISK || 0, 'crit'], ['FINES_ACCUMULATING', 'Fines accruing', counts.FINES_ACCUMULATING || 0, 'fine'], ['CLEARED', 'Cleared', counts.CLEARED || 0, 'done']]
            .map(([k, l, n, cls]) => <button key={k} className={`stat ${cls} ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}><span>{n}</span>{t(l)}</button>)}
        </div>
        {exp.estMax > 0 && <p className="exposure">{t('Estimated demurrage so far across all containers:')} <b>{money(exp)} XAF</b></p>}
        <div className="row between bar"><input className="search" placeholder={t('Search container, B/L or importer')} value={q} onChange={e => setQ(e.target.value)} /><button className="btn primary" onClick={() => setAdding(true)}>{t('Register container')}</button></div>
        <div className="tablewrap"><table>
          <thead><tr><th>{t('Container')}</th><th>{t('Importer')}</th><th>{t('Line')}</th><th>{t('Progress')}</th><th>{t('Free days left')}</th><th>{t('Est. storage charges')}</th><th>{t('Status')}</th></tr></thead>
          <tbody>{rows.map(c => { const r = RISK[c.riskLevel]; return (
            <tr key={c._id} className={`risk-${r.cls}`} onClick={() => setOpen(c._id)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && setOpen(c._id)}>
              <td><b>{c.containerNumber}</b><small>{c.billOfLading}</small></td><td>{c.importerName}</td><td>{c.shippingLine}</td>
              <td><div className="seg">{STEPS.map((_, i) => <i key={i} className={i < c.step ? 'on' : ''} />)}</div><small>{t('Step {n} of 6', { n: c.step })}</small></td>
              <td className="num">{c.riskLevel === 'CLEARED' ? '—' : c.daysRemaining}</td>
              <td>{c.demurrage.estMax ? <><b>{money(c.demurrage)}</b><small>XAF · {TYPES[c.containerType]}</small></> : <small>{t('None yet')} · {TYPES[c.containerType]}</small>}</td>
              <td><span className={`chip ${r.cls}`}>{t(r.label)}</span></td></tr>); })}
            {rows.length === 0 && <tr><td colSpan="7" className="empty">{t('No containers match. Register a container to start tracking it.')}</td></tr>}</tbody></table></div>
      </main>}
      {open && <Drawer id={open} me={me} onClose={() => setOpen(null)} onChanged={load} />}
      {adding && <NewModal port={me.port} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

export default function App() {
  const [, bump] = useState(0); const rerender = () => bump(x => x + 1);
  const [me, setMe] = useState(() => { try { return localStorage.getItem('vd_token') ? JSON.parse(localStorage.getItem('vd_me')) : null; } catch { return null; } });
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const h = () => setHash(location.hash); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h); }, []);
  return (<Rerender.Provider value={rerender}>{hash === '#/owner' ? <Owner /> : me ? <Dashboard me={me} onLogout={() => setMe(null)} /> : <Login onDone={setMe} />}</Rerender.Provider>);
}
