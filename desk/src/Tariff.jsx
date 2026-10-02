import { useEffect, useState } from 'react';
import { api, TYPES } from './api.js';

export default function Tariff() {
  const [t, setT] = useState(null); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { api('/consignments/tariff').then(setT).catch(e => setErr(e.message)); }, []);
  if (!t) return <p className="muted">{err || 'Loading tariff…'}</p>;
  const setRate = (k, f, v) => setT({ ...t, rates: { ...t.rates, [k]: { ...t.rates[k], [f]: v } } });
  const save = async () => { setMsg(''); setErr(''); try { await api('/consignments/tariff', { method: 'PUT', body: t }); setMsg('Tariff saved. All estimates now use these rates.'); } catch (e) { setErr(e.message); } };
  return (
    <section className="panel tariff">
      <h3>Demurrage tariff</h3>
      <p className="muted">Estimates cover the port transit phase only: storage of full containers inside the terminal, counted until the gate pass is issued. Detention (holding the container outside the terminal during unpacking) starts after gate-out and is not included. Free time is set per container when you register it; 11 calendar days is typical for dry containers.</p>
      <table><thead><tr><th>Container type</th><th>Minimum per day (XAF)</th><th>Maximum per day (XAF)</th></tr></thead>
        <tbody>{Object.keys(TYPES).map(k => (<tr key={k}><td>{TYPES[k]}</td>
          <td><input type="number" min="0" value={t.rates[k].min} onChange={e => setRate(k, 'min', e.target.value)} /></td>
          <td><input type="number" min="0" value={t.rates[k].max} onChange={e => setRate(k, 'max', e.target.value)} /></td></tr>))}</tbody></table>
      <div className="grid2"><label>Extended-stay rate starts after calendar day<input type="number" min="1" value={t.tier2StartDay} onChange={e => setT({ ...t, tier2StartDay: e.target.value })} /></label>
        <label>Extended-stay rate multiplier<input type="number" min="1" step="0.5" value={t.tier2Multiplier} onChange={e => setT({ ...t, tier2Multiplier: e.target.value })} /></label></div>
      <p className="muted">Rates are quoted as a range because they vary by shipping line, so every figure in Veridock is shown as an estimate range.</p>
      {err && <p className="err" role="alert">{err}</p>}{msg && <p className="ok">{msg}</p>}
      <div className="row end"><button className="btn primary" onClick={save}>Save tariff</button></div>
    </section>
  );
}
