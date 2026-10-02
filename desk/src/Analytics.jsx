import { useEffect, useState } from 'react';
import { api, money } from './api.js';

const Kpi = ({ label, value, hint, tone }) => (<div className={`kpi ${tone || ''}`}><span>{value ?? '—'}</span><b>{label}</b>{hint && <small>{hint}</small>}</div>);

export default function Analytics() {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api('/consignments/analytics').then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <p className="err">{err}</p>;
  if (!d) return <p className="muted">Loading performance…</p>;
  const max = Math.max(1, ...d.stages.map(s => s.avgDays || 0));
  const t = d.totals;
  return (
    <div className="perf">
      <div className="kpis">
        <Kpi label="Average clearance time" value={t.avgClearanceDays !== null ? `${t.avgClearanceDays} days` : null} hint={`${t.cleared} container(s) cleared`} />
        <Kpi label="Slowest step" value={d.bottleneck ? `${d.bottleneck.avgDays} days` : null} hint={d.bottleneck ? d.bottleneck.label : 'Not enough data yet'} tone="warn" />
        <Kpi label="Containers with fines" value={t.filesWithFines} hint="Past the free period" tone={t.filesWithFines ? 'crit' : 'safe'} />
        <Kpi label="Estimated demurrage (XAF)" value={t.estMax ? money(t) : '0'} hint={`${t.demurrageDays} day(s) past free time`} tone={t.demurrageDays ? 'crit' : 'safe'} />
      </div>

      <section className="panel"><h3>Where time is spent</h3><p className="muted">Average days from the previous milestone to each step.</p>
        {d.stages.map(s => (<div className="hbar" key={s.key}><span>{s.label}</span>
          <div className="track"><i className={d.bottleneck && s.key === d.bottleneck.key ? 'hot' : ''} style={{ width: `${((s.avgDays || 0) / max) * 100}%` }} /></div>
          <b>{s.avgDays !== null ? `${s.avgDays}d` : 'No data'}</b></div>))}
      </section>

      <div className="two">
        <section className="panel"><h3>By shipping line</h3>
          <table><thead><tr><th>Line</th><th>Containers</th><th>Avg days to clear</th><th>Days over free period</th><th>Est. charges (XAF)</th></tr></thead>
            <tbody>{d.shippingLines.map(l => <tr key={l.shippingLine}><td>{l.shippingLine}</td><td>{l.containers}</td><td>{l.avgDays ?? '—'}</td><td>{l.overDays}</td><td>{l.estMax ? money(l) : '0'}</td></tr>)}</tbody></table></section>
        <section className="panel"><h3>Staff activity</h3>
          <table><thead><tr><th>Operator</th><th>Milestones logged</th></tr></thead>
            <tbody>{d.staff.length ? d.staff.map(s => <tr key={s.name}><td>{s.name}</td><td>{s.milestones}</td></tr>) : <tr><td colSpan="2" className="empty">No milestones logged yet.</td></tr>}</tbody></table></section>
      </div>
    </div>
  );
}
