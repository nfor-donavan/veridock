import { useId } from 'react';
import { t } from './i18n.js';

// Veridock product mark
export function Logo({ size = 34 }) {
  const id = 'lg' + useId().replace(/:/g, '');
  return (<svg width={size} height={size} viewBox="0 0 180 180" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#12A5B0" /><stop offset="1" stopColor="#0A1B2E" /></linearGradient></defs>
    <path d="M90 0 172 45v90L90 180 8 135V45z" fill={`url(#${id})`} /><path d="M90 14 160 52v76L90 166 20 128V52z" fill="none" stroke="#C9A24B" strokeWidth="3" />
    <g fill="#F3F5F4" opacity=".92"><rect x="52" y="58" width="36" height="22" rx="2" /><rect x="92" y="58" width="36" height="22" rx="2" /><rect x="72" y="84" width="36" height="22" rx="2" /></g>
    <path d="M56 128 82 112 98 124 134 92" fill="none" stroke="#C9A24B" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}

// Nexus Tech Labs emblem. onDark: always the light variant (headers, login art). Otherwise it follows the light/dark theme.
export function NexusMark({ size = 18, onDark = false }) {
  const w = Math.round(size * 0.83);
  if (onDark) return <img className="nx" src="/nexus-emblem-light.png" alt="" width={w} height={size} />;
  return (<><img className="nx nx-for-light" src="/nexus-emblem.png" alt="" width={w} height={size} /><img className="nx nx-for-dark" src="/nexus-emblem-light.png" alt="" width={w} height={size} /></>);
}

// "by [emblem] Nexus Tech Labs": the secondary brand line next to the product name
export function NexusBy({ onDark = false, size = 18 }) {
  return (<span className={`nexusby ${onDark ? 'ondark' : ''}`}><span>{t('by')}</span><NexusMark size={size} onDark={onDark} /><b>Nexus Tech Labs</b></span>);
}

export function Footer() {
  return (<footer className="app-foot"><NexusMark size={16} /><span>Veridock · {t('Developed by')} <b>Nexus Tech Labs</b></span></footer>);
}

// Static (no animation) branded loading state
export function Loading({ label }) {
  return (<div className="loading" role="status"><Logo size={40} /><b className="wordmark-sm">Veridock</b><small>{label || t('Loading…')}</small></div>);
}
