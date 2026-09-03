import { rosterBad } from './portfolioRec';

export function classRefName(cls, capId) {
  if (!cls) return '—';
  return cls.name || cls.className || `TC_2026_${String(capId || '').replace(/\D/g, '')}`;
}

export function formatClassDate(dateStr) {
  if (!dateStr) return '—';
  if (/^\d{2}\/\d{2}/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export function weekRelLabel(wkRel) {
  const n = Number(wkRel) || 0;
  if (n === 0) return 'this week';
  if (n === 1) return 'next week';
  if (n > 0) return `+${n} wk`;
  return `${n} wk`;
}

export function rosterStatus(cls) {
  if (!cls) {
    return { label: '— n/a', chip: 'stchip balanced', mapped: false, uploaded: false, gap: false };
  }
  const status = String(cls.status || 'missing').toLowerCase();
  const mapped = status === 'mapped' || status === 'uploaded' || status === 'partial' || status === 'planned';
  const uploaded = status === 'uploaded' && (cls.rosterFile || cls.employeeCount > 0);
  const gap = status === 'missing' || status === 'partial';

  if (status === 'planned') {
    return { label: '◷ Planned', chip: 'stchip balanced', mapped, uploaded, gap: false };
  }
  if (uploaded) {
    return { label: '✓ Uploaded', chip: 'stchip surplus', mapped, uploaded, gap: false };
  }
  if (status === 'mapped') {
    return { label: '✓ Mapped', chip: 'stchip surplus', mapped, uploaded, gap: false };
  }
  if (status === 'partial') {
    return { label: '◑ Partial', chip: 'stchip under', mapped, uploaded, gap: true };
  }
  return { label: '✕ Not uploaded', chip: 'stchip critical', mapped, uploaded, gap: true };
}

export function hasRosterGap(plan) {
  return rosterBad(plan);
}

export function onboardedFte(cls, mapped) {
  if (!cls || !mapped) return 0;
  return Number(cls.actual) || 0;
}
