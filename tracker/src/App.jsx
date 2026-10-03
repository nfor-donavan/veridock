import { useEffect, useState } from 'react';
import { getTheme, toggleTheme } from './theme.js';

const BASE = import.meta.env.VITE_API_URL || '';
const fileUrl = (u) => (u && u.startsWith('/') ? BASE + u : u);
const fmtN = (n) => String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const TXT = {
  en: { loading: 'Loading your container…', invalid: 'This tracking link is not valid. Check the link in your SMS, or ask your transit agent to resend it.', container: 'Container', port: 'port', step: 'Step {a} of {b}', camcis: 'CAMCIS reference',
    left: '{n} free day(s) left', over: '{n} day(s) over the free period', waiting: 'Waiting', view: 'View document', hide: 'Hide document', pdf: 'Open PDF receipt', fp: 'Fingerprint',
    fees: 'Estimated storage charges so far', feesExact: 'Storage charges so far', feeNote: 'Estimate for {n} day(s) past the free period. The final amount is set by the shipping line.', feeNoteExact: 'Based on the shipping line tariff for {n} day(s) past the free period.',
    report: 'Download clearance report (PDF)', foot: 'Bill of lading {bl} · Arrived {d}', foot2: 'Each step is backed by a document uploaded by your transit agency.', lang: 'Change language', theme: 'Toggle light or dark mode',
    risk: { SAFE: 'On schedule', WARNING: 'Free storage period running down', CRITICAL_RISK: 'Urgent: storage fines are close', FINES_ACCUMULATING: 'Storage fines are accruing', CLEARED: 'Cleared for exit' } },
  fr: { loading: 'Chargement de votre conteneur…', invalid: 'Ce lien de suivi n’est pas valide. Vérifiez le lien reçu par SMS ou demandez à votre transitaire de le renvoyer.', container: 'Conteneur', port: 'port', step: 'Étape {a} sur {b}', camcis: 'Référence CAMCIS',
    left: 'Il reste {n} jour(s) gratuit(s)', over: '{n} jour(s) au-delà du délai gratuit', waiting: 'En attente', view: 'Voir le document', hide: 'Masquer le document', pdf: 'Ouvrir le reçu PDF', fp: 'Empreinte',
    fees: 'Frais de stockage estimés à ce jour', feesExact: 'Frais de stockage à ce jour', feeNote: 'Estimation pour {n} jour(s) au-delà du délai gratuit. Le montant final est fixé par la compagnie maritime.', feeNoteExact: 'Selon le tarif de la compagnie maritime, pour {n} jour(s) au-delà du délai gratuit.',
    report: 'Télécharger le rapport de dédouanement (PDF)', foot: 'Connaissement {bl} · Arrivé le {d}', foot2: 'Chaque étape s’appuie sur un document déposé par votre agence de transit.', lang: 'Changer de langue', theme: 'Basculer entre mode clair et mode sombre',
    risk: { SAFE: 'Dans les délais', WARNING: 'Le délai gratuit de stockage s’écoule', CRITICAL_RISK: 'Urgent : les frais de stockage approchent', FINES_ACCUMULATING: 'Des frais de stockage courent', CLEARED: 'Autorisé à sortir' } }
};
const CLS = { SAFE: 'safe', WARNING: 'warn', CRITICAL_RISK: 'crit', FINES_ACCUMULATING: 'fine', CLEARED: 'done' };
const fill = (s, v) => Object.entries(v).reduce((o, [k, x]) => o.split(`{${k}}`).join(x), s);

export default function App() {
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [open, setOpen] = useState({}); const [, bump] = useState(0);
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('vd_lang') || ''; } catch { return ''; } });
  const token = location.pathname.split('/').filter(Boolean).pop();
  useEffect(() => { fetch(`${BASE}/api/public/track/${token}`).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch(e => setErr(e.message)); }, [token]);
  const L = lang || (d && d.preferredLanguage) || ((navigator.language || 'fr').startsWith('en') ? 'en' : 'fr'); const T = TXT[L];
  const pick = (l) => { setLang(l); try { localStorage.setItem('vd_lang', l); } catch {} document.documentElement.lang = l; };
  const dateFmt = (x) => new Date(x).toLocaleDateString(L === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const bar = (<div className="tools"><button className="tool" aria-label={T.lang} onClick={() => pick(L === 'fr' ? 'en' : 'fr')}>{L === 'fr' ? 'EN' : 'FR'}</button>
    <button className="tool" aria-label={T.theme} onClick={() => { toggleTheme(); bump(x => x + 1); }}>{getTheme() === 'dark' ? '☀' : '☾'}</button></div>);
  if (err) return <div className="page"><header><b className="brand">Veridock</b>{bar}</header><p className="fail">{T.invalid}</p></div>;
  if (!d) return <div className="page"><p className="muted">{T.loading}</p></div>;
  const dm = d.demurrage;
  return (
    <div className="page">
      <header><b className="brand">Veridock</b><span className="ag">{d.agency}</span>{bar}</header>
      <section className="hero">
        <small>{T.container}</small><h1>{d.containerNumber}</h1>
        <p>{d.importerName} · {d.shippingLine} · {d.port === 'KRIBI' ? 'Kribi' : 'Douala'} {T.port}</p>
        {d.camcisReference && <p>{T.camcis} {d.camcisReference}</p>}
        <div className="prog"><div style={{ width: `${(d.step / d.total) * 100}%` }} /></div>
        <p className="prog-t">{fill(T.step, { a: d.step, b: d.total })}</p>
      </section>
      <div className={`status ${CLS[d.risk]}`}><b>{T.risk[d.risk]}</b>{d.risk !== 'CLEARED' && <span>{d.daysRemaining >= 0 ? fill(T.left, { n: d.daysRemaining }) : fill(T.over, { n: Math.abs(d.daysRemaining) })}</span>}</div>
      {dm.estMax > 0 && <div className="fees"><b>{dm.exact ? T.feesExact : T.fees}</b><span>{dm.estMin === dm.estMax ? fmtN(dm.estMin) : `${fmtN(dm.estMin)} – ${fmtN(dm.estMax)}`} XAF</span>
        <small>{fill(dm.exact ? T.feeNoteExact : T.feeNote, { n: dm.chargeableDays })}</small></div>}
      <ol className="steps">
        {d.steps.map(s => (
          <li key={s.key} className={s.state}>
            <span className="dot">{s.state === 'done' ? '✓' : ''}</span>
            <div className="body">
              <b>{L === 'fr' ? s.labelFr : s.label}</b>
              {s.at && <small>{dateFmt(s.at)}</small>}{s.state === 'pending' && <small>{T.waiting}</small>}
              {s.proofUrl && <button className="link" onClick={() => setOpen({ ...open, [s.key]: !open[s.key] })}>{open[s.key] ? T.hide : T.view}</button>}
              {open[s.key] && (s.proofMime === 'application/pdf' ? <a className="link" href={fileUrl(s.proofUrl)} target="_blank" rel="noreferrer">{T.pdf}</a> : <img src={fileUrl(s.proofUrl)} alt={s.label} loading="lazy" />)}
              {open[s.key] && s.sha256 && <small className="hash">{T.fp} {s.sha256.slice(0, 20)}…</small>}
            </div>
          </li>))}
      </ol>
      <a className="report" href={`${BASE}/api/public/track/${token}/report?lang=${L}`} target="_blank" rel="noreferrer">{T.report}</a>
      <footer>{fill(T.foot, { bl: d.billOfLading, d: dateFmt(d.arrivalDate) })}<br />{T.foot2}</footer>
    </div>
  );
}
