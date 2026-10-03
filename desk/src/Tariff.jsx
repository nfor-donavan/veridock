import { useEffect, useState } from 'react';
import { api, TYPES } from './api.js';
import { t } from './i18n.js';

const CARRIERS = ['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'COSCO', 'Other'];
export default function Tariff() {
  const [tf, setTf] = useState(null); const [car, setCar] = useState({}); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  useEffect(() => {
    api('/consignments/tariff').then(x => {
      setTf(x); const c = {};
      CARRIERS.forEach(n => { const o = (x.carriers || {})[n.toUpperCase()] || {}; c[n] = { freeDays: o.freeDays ?? '', ...Object.fromEntries(Object.keys(TYPES).map(k => [k, o.rates?.[k]?.min ?? ''])) }; });
      setCar(c);
    }).catch(e => setErr(e.message));
  }, []);
  if (!tf) return <p className="muted">{err || t('Loading tariff…')}</p>;
  const setRate = (k, f, v) => setTf({ ...tf, rates: { ...tf.rates, [k]: { ...tf.rates[k], [f]: v } } });
  const setC = (n, f, v) => setCar({ ...car, [n]: { ...car[n], [f]: v } });
  const save = async () => {
    setMsg(''); setErr('');
    const carriers = {}; CARRIERS.forEach(n => { const o = car[n]; carriers[n] = { freeDays: o.freeDays, rates: Object.fromEntries(Object.keys(TYPES).map(k => [k, o[k]])) }; });
    try { await api('/consignments/tariff', { method: 'PUT', body: { ...tf, carriers } }); setMsg(t('Tariff saved. All amounts now use these rates.')); } catch (e) { setErr(e.message); }
  };
  return (
    <section className="panel tariff">
      <h3>{t('Demurrage tariff')}</h3>
      <p className="muted">{t('Estimates cover the port transit phase only: storage of full containers inside the terminal, counted until the gate pass is issued. Detention (holding the container outside the terminal during unpacking) starts after gate-out and is not included.')}</p>
      <h4>{t('Agency default rates')}</h4>
      <div className="scroll"><table><thead><tr><th>{t('Container type')}</th><th>{t('Minimum per day (XAF)')}</th><th>{t('Maximum per day (XAF)')}</th></tr></thead>
        <tbody>{Object.keys(TYPES).map(k => (<tr key={k}><td>{TYPES[k]}</td>
          <td><input type="number" min="0" value={tf.rates[k].min} onChange={e => setRate(k, 'min', e.target.value)} /></td>
          <td><input type="number" min="0" value={tf.rates[k].max} onChange={e => setRate(k, 'max', e.target.value)} /></td></tr>))}</tbody></table></div>
      <div className="grid2"><label>{t('Extended-stay rate starts after calendar day')}<input type="number" min="1" value={tf.tier2StartDay} onChange={e => setTf({ ...tf, tier2StartDay: e.target.value })} /></label>
        <label>{t('Extended-stay rate multiplier')}<input type="number" min="1" step="0.5" value={tf.tier2Multiplier} onChange={e => setTf({ ...tf, tier2Multiplier: e.target.value })} /></label></div>
      <h4>{t('Per shipping line (exact amounts)')}</h4>
      <p className="muted">{t('Enter a fixed rate per day for a line and its amounts become exact instead of a range. Leave a field empty to use the agency default.')}</p>
      <div className="scroll"><table><thead><tr><th>{t('Shipping line')}</th><th>{t('Free days')}</th>{Object.keys(TYPES).map(k => <th key={k}>{TYPES[k]} (XAF)</th>)}</tr></thead>
        <tbody>{CARRIERS.map(n => (<tr key={n}><td><b>{n}</b></td>
          <td><input type="number" min="0" value={car[n]?.freeDays ?? ''} onChange={e => setC(n, 'freeDays', e.target.value)} /></td>
          {Object.keys(TYPES).map(k => <td key={k}><input type="number" min="0" value={car[n]?.[k] ?? ''} onChange={e => setC(n, k, e.target.value)} /></td>)}</tr>))}</tbody></table></div>
      {err && <p className="err" role="alert">{err}</p>}{msg && <p className="ok">{msg}</p>}
      <div className="row end"><button className="btn primary" onClick={save}>{t('Save tariff')}</button></div>
    </section>
  );
}
