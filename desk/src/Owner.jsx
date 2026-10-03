import { useEffect, useState } from 'react';
import { api } from './api.js';
import { t } from './i18n.js';

const tok = () => sessionStorage.getItem('vd_super');
export default function Owner() {
  const [authed, setAuthed] = useState(!!tok()); const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState('');
  const [list, setList] = useState([]); const [n, setN] = useState({ agencyName: '', licenceNumber: '', port: 'DOUALA', managerName: '', managerEmail: '', managerPassword: '', managerPhone: '' });
  const [msg, setMsg] = useState(''); const [rp, setRp] = useState({ email: '', password: '' });
  const load = () => api('/auth/admin/tenants', { token: tok() }).then(setList).catch(e => { setErr(e.message); sessionStorage.removeItem('vd_super'); setAuthed(false); });
  useEffect(() => { if (authed) load(); }, [authed]);
  const login = async () => { setErr(''); try { const r = await api('/auth/super-login', { method: 'POST', body: f, token: null }); sessionStorage.setItem('vd_super', r.token); setAuthed(true); } catch (e) { setErr(e.message); } };
  const create = async () => { setErr(''); setMsg(''); try { await api('/auth/admin/tenants', { method: 'POST', body: n, token: tok() }); setMsg(t('Agency created.')); setN({ ...n, agencyName: '', licenceNumber: '', managerName: '', managerEmail: '', managerPassword: '', managerPhone: '' }); load(); } catch (e) { setErr(e.message); } };
  const toggle = async (a) => { await api(`/auth/admin/tenants/${a._id}`, { method: 'PATCH', body: { active: !a.active }, token: tok() }); load(); };
  const reset = async () => { setErr(''); setMsg(''); try { await api('/auth/admin/reset-password', { method: 'POST', body: rp, token: tok() }); setMsg(t('Password updated.')); setRp({ email: '', password: '' }); } catch (e) { setErr(e.message); } };
  const set = (k) => (e) => setN({ ...n, [k]: e.target.value });

  if (!authed) return (
    <div className="login"><div className="login-art"><h1>{t('Platform owner console')}</h1></div>
      <div className="login-form"><h2>{t('Platform owner')}</h2>
        <label>{t('Email')}<input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
        <label>{t('Password')}<input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && login()} /></label>
        {err && <p className="err" role="alert">{err}</p>}<button className="btn primary" onClick={login}>{t('Sign in')}</button>
        <a href="#/" className="muted">{t('Back to Transit Desk')}</a></div></div>);
  return (
    <div className="shell"><header className="top"><b className="brand">{t('Platform owner console')}</b>
      <div className="row"><a className="btn" href="#/" onClick={() => sessionStorage.removeItem('vd_super')}>{t('Sign out')}</a></div></header>
      <main>
        {msg && <p className="ok">{msg}</p>}{err && <p className="err" role="alert">{err}</p>}
        <section className="panel"><h3>{t('Onboard a new agency')}</h3><div className="grid2">
          <label>{t('Agency name')}<input value={n.agencyName} onChange={set('agencyName')} /></label><label>{t('Customs licence number')}<input value={n.licenceNumber} onChange={set('licenceNumber')} /></label>
          <label>{t('Manager name')}<input value={n.managerName} onChange={set('managerName')} /></label><label>{t('Manager email')}<input type="email" value={n.managerEmail} onChange={set('managerEmail')} /></label>
          <label>{t('Manager password (8+ characters)')}<input type="password" value={n.managerPassword} onChange={set('managerPassword')} /></label><label>{t('Manager phone (optional)')}<input value={n.managerPhone} onChange={set('managerPhone')} /></label>
          <label>{t('Port')}<select value={n.port} onChange={set('port')}><option value="DOUALA">Douala</option><option value="KRIBI">Kribi</option></select></label></div>
          <div className="row end"><button className="btn primary" onClick={create}>{t('Create agency')}</button></div></section>
        <section className="panel"><h3>{t('Agencies')}</h3><div className="scroll"><table><tbody>
          {list.length === 0 && <tr><td className="empty">{t('No agencies yet.')}</td></tr>}
          {list.map(a => (<tr key={a._id}><td><b>{a.agencyName}</b><small>{a.licenceNumber} · {a.port === 'KRIBI' ? 'Kribi' : 'Douala'}</small></td><td><small>{a.managers.join(', ')}</small></td>
            <td>{a.users} {t('users')} · {a.containers} {t('containers')}</td><td><span className={`chip ${a.active ? 'safe' : 'fine'}`}>{a.active ? t('Active') : t('Suspended')}</span></td>
            <td><button className="btn" onClick={() => toggle(a)}>{a.active ? t('Suspend') : t('Reactivate')}</button></td></tr>))}</tbody></table></div></section>
        <section className="panel"><h3>{t('Reset a manager password')}</h3><div className="grid2">
          <label>{t('Email')}<input type="email" value={rp.email} onChange={e => setRp({ ...rp, email: e.target.value })} /></label><label>{t('New password')}<input type="password" value={rp.password} onChange={e => setRp({ ...rp, password: e.target.value })} /></label></div>
          <div className="row end"><button className="btn" onClick={reset}>{t('Reset password')}</button></div></section>
      </main></div>
  );
}
