const KEY = 'vd_theme';
export const getTheme = () => document.documentElement.dataset.theme || 'light';
export function applyTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem(KEY, t); } catch {} }
export const toggleTheme = () => applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
