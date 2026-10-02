import { useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL || '';
const fileUrl = (u) => (u && u.startsWith('/') ? BASE + u : u);
const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtN = (n) => Number(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
const RISK = {
  SAFE: ['safe', 'On schedule'], WARNING: ['warn', 'Free storage period running down'], CRITICAL_RISK: ['crit', 'Urgent: storage fines are close'],
  FINES_ACCUMULATING: ['fine', 'Storage fines are accruing'], CLEARED: ['done', 'Cleared for exit']
};

export default function App() {
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [open, setOpen] = useState({});
  const token = location.pathname.split('/').filter(Boolean).pop();
  useEffect(() => {
    fetch(`${BASE}/api/public/track/${token}`).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch(e => setErr(e.message));
  }, [token]);
  if (err) return <div className="page"><p className="fail">This tracking link is not valid. Check the link in your SMS, or ask your transit agent to resend it.</p></div>;
  if (!d) return <div className="page"><p className="muted">Loading your container…</p></div>;
  const [cls, msg] = RISK[d.risk];
  return (
    <div className="page">
      <header><b className="brand">Veridock</b><span>{d.agency}</span></header>
      <section className="hero">
        <small>Container</small><h1>{d.containerNumber}</h1>
        <p>{d.importerName} · {d.shippingLine} · {d.port === 'KRIBI' ? 'Kribi' : 'Douala'} port</p>
        {d.camcisReference && <p>CAMCIS reference {d.camcisReference}</p>}
        <div className="prog"><div style={{ width: `${(d.step / d.total) * 100}%` }} /></div>
        <p className="prog-t">Step {d.step} of {d.total}</p>
      </section>
      <div className={`status ${cls}`}><b>{msg}</b>{d.risk !== 'CLEARED' && <span>{d.daysRemaining >= 0 ? `${d.daysRemaining} free day(s) left` : `${Math.abs(d.daysRemaining)} day(s) over the free period`}</span>}</div>
      {d.demurrage.estMax > 0 && <div className="fees"><b>Estimated storage charges so far</b><span>{fmtN(d.demurrage.estMin)} to {fmtN(d.demurrage.estMax)} XAF</span>
        <small>Estimate for {d.demurrage.chargeableDays} day(s) past the free period. The final amount is set by the shipping line.</small></div>}
      <ol className="steps">
        {d.steps.map((s, i) => (
          <li key={s.key} className={s.state}>
            <span className="dot">{s.state === 'done' ? '✓' : ''}</span>
            <div className="body">
              <b>{s.label}</b>
              {s.at && <small>{fmt(s.at)}</small>}
              {s.state === 'pending' && <small>Waiting</small>}
              {s.proofUrl && <button className="link" onClick={() => setOpen({ ...open, [s.key]: !open[s.key] })}>{open[s.key] ? 'Hide document' : 'View document'}</button>}
              {open[s.key] && (s.proofMime === 'application/pdf'
                ? <a className="link" href={fileUrl(s.proofUrl)} target="_blank" rel="noreferrer">Open PDF receipt</a>
                : <img src={fileUrl(s.proofUrl)} alt={`Proof for ${s.label}`} loading="lazy" />)}
              {open[s.key] && s.sha256 && <small className="hash">Fingerprint {s.sha256.slice(0, 20)}…</small>}
            </div>
          </li>))}
      </ol>
      <footer>Bill of lading {d.billOfLading} · Arrived {fmt(d.arrivalDate)}<br />Each step is backed by a document uploaded by your transit agency.</footer>
    </div>
  );
}
