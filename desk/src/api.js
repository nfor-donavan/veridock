const BASE = import.meta.env.VITE_API_URL || '';
export const fileUrl = (u) => (u && u.startsWith('/') ? BASE + u : u);
export const fmtN = (n) => Number(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
export const money = (d) => (!d || !d.estMax ? '0' : d.estMin === d.estMax ? fmtN(d.estMin) : `${fmtN(d.estMin)} to ${fmtN(d.estMax)}`);
export const TYPES = { '20DRY': "20' Dry", '40DRY': "40' Dry", '40HC': "40' High Cube" };
export const TRACKER = import.meta.env.VITE_TRACKER_URL || 'http://localhost:5174';

export async function api(path, { method = 'GET', body, form } = {}) {
  const token = localStorage.getItem('vd_token');
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined)
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { localStorage.removeItem('vd_token'); location.reload(); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
