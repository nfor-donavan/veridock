import { t } from './i18n.js';
const BASE = import.meta.env.VITE_API_URL || '';
export const fileUrl = (u) => (u && u.startsWith('/') ? BASE + u : u);
export const TRACKER = import.meta.env.VITE_TRACKER_URL || 'http://localhost:5174';
export const fmtN = (n) => String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const money = (d) => (!d || !d.estMax ? '0' : d.estMin === d.estMax ? fmtN(d.estMin) : `${fmtN(d.estMin)} – ${fmtN(d.estMax)}`);
export const TYPES = { '20DRY': "20' Dry", '40DRY': "40' Dry", '40HC': "40' High Cube" };

// token: omit to use the agency session; pass a string or null to override (platform owner console)
export async function api(path, { method = 'GET', body, form, token } = {}) {
  const own = token === undefined; const tk = own ? localStorage.getItem('vd_token') : token;
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { ...(tk ? { Authorization: `Bearer ${tk}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined)
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && own && tk) { localStorage.removeItem('vd_token'); localStorage.removeItem('vd_me'); location.reload(); }
  if (!res.ok) throw new Error(t(data.error || 'Something went wrong'));
  return data;
}
export async function apiBlob(path) {
  const res = await fetch(BASE + '/api' + path, { headers: { Authorization: `Bearer ${localStorage.getItem('vd_token')}` } });
  if (!res.ok) throw new Error(t('Something went wrong'));
  return res.blob();
}
