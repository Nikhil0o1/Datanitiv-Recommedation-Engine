import { f2 } from './format';
import { computeClosing } from './planLogic';

export const HC_NEG = new Set(['tout', 'loaIn', 'attr', 'promo']);

export const HC_ROWS = [
  ['Opening FTE', 'opening', true],
  ['+ Nesting → Production', 'nest', false],
  ['+ Transfer In', 'tin', false],
  ['− Transfer Out', 'tout', false],
  ['+ Back from LOA', 'loaOut', false],
  ['− Move to LOA', 'loaIn', false],
  ['− Production Attrition', 'attr', false],
  ['− Promotion (out)', 'promo', false],
  ['Closing FTE', 'closing', true],
];

export const HC_MOVE_KEYS = [
  ['nest', 'Nesting → Production'],
  ['tin', 'Transfer In'],
  ['tout', 'Transfer Out'],
  ['loaOut', 'Back from LOA'],
  ['loaIn', 'Move to LOA'],
  ['attr', 'Production Attrition'],
  ['promo', 'Promotion (out)'],
];

export function hcSnapshot(src) {
  const hc = { ...(src || {}) };
  hc.closing = computeClosing(hc);
  return hc;
}

export function moveCell(hc, key, grp) {
  const v = Number(hc?.[key]) || 0;
  if (grp) return f2(v);
  if (v === 0) return '0.00';
  return `${HC_NEG.has(key) ? '−' : '+'}${f2(Math.abs(v))}`;
}

export function moveClass(key, grp) {
  if (grp) return '';
  return HC_NEG.has(key) ? 'neg' : 'pos';
}

export function netDelta(v) {
  const n = Number(v) || 0;
  return { txt: f2(n), cls: n < 0 ? 'neg' : n > 0 ? 'pos' : '' };
}
