import { useEffect, useState } from 'react';
import { api, money } from './api.js';
import { t } from './i18n.js';

const Kpi = ({ label, value, hint, tone }) => (<div className={`kpi ${tone || ''}`}><span>{value ?? '—'}</span><b>{label}</b>{hint && <small>{hint}</small>}</div>);

export default function Analytics() {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api('/consignments/analytics').then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <p className="err">{err}</p>;
  if (!d) return <p className="muted">{t('Loading performance…')}</p>;
  const max = Math.max(1, ...d.stages.map(s => s.avgDays || 0)); const k = d.totals;
  return (
    <div className="perf">
      {k.flaggedProofs > 0 && <div className="alarm" role="alert"><span className="blink" />{t('{n} proof document(s) flagged and waiting for a manager review.', { n: k.flaggedProofs })}</div>}
      <div className="kpis">
        <Kpi label={t('Average clearance time')} value={k.avgClearanceDays !== null ? `${k.avgClearanceDays} ${t('days')}` : null} hint={`${k.cleared} ${t('container(s) cleared')}`} />
        <Kpi label={t('Slowest step')} value={d.bottleneck ? `${d.bottleneck.avgDays} ${t('days')}` : null} hint={d.bottleneck ? t(d.bottleneck.label) : t('Not enough data yet')} tone="warn" />
        <Kpi label={t('Containers with fines')} value={k.filesWithFines} hint={t('Past the free period')} tone={k.filesWithFines ? 'crit' : 'safe'} />
        <Kpi label={t('Estimated demurrage (XAF)')} value={k.estMax ? money(k) : '0'} hint={t('{n} day(s) past free time', { n: k.demurrageDays })} tone={k.demurrageDays ? 'crit' : 'safe'} />
      </div>
      <section className="panel"><h3>{t('Where time is spent')}</h3><p className="muted">{t('Average days from the previous milestone to each step.')}</p>
        {d.stages.map(s => (<div className="hbar" key={s.key}><span>{t(s.label)}</span>
          <div className="track"><i className={d.bottleneck && s.key === d.bottleneck.key ? 'hot' : ''} style={{ width: `${((s.avgDays || 0) / max) * 100}%` }} /></div>
          <b>{s.avgDays !== null ? `${s.avgDays}${t('d')}` : t('No data')}</b></div>))}
      </section>
      <div className="two">
        <section className="panel"><h3>{t('By shipping line')}</h3><div className="scroll">
          <table><thead><tr><th>{t('Line')}</th><th>{t('Containers handled')}</th><th>{t('Avg days to clear')}</th><th>{t('Days over free period')}</th><th>{t('Est. charges (XAF)')}</th></tr></thead>
            <tbody>{d.shippingLines.map(l => <tr key={l.shippingLine}><td>{l.shippingLine}</td><td>{l.containers}</td><td>{l.avgDays ?? '—'}</td><td>{l.overDays}</td><td>{l.estMax ? money(l) : '0'}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><h3>{t('Staff activity')}</h3>
          <table><thead><tr><th>{t('Operator')}</th><th>{t('Milestones logged')}</th></tr></thead>
            <tbody>{d.staff.length ? d.staff.map(s => <tr key={s.name}><td>{s.name}</td><td>{s.milestones}</td></tr>) : <tr><td colSpan="2" className="empty">{t('No milestones logged yet.')}</td></tr>}</tbody></table></section>
      </div>
    </div>
  );
}
