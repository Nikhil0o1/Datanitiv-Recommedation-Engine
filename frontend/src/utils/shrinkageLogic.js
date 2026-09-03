import { f2 } from './format';

export function avgSlice(arr, from, to) {
  const vals = (arr || []).slice(from, to + 1).filter((v) => v != null && !Number.isNaN(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function shrinkActual8(plan) {
  const from = Math.max(0, (plan.curIdx || 0) - 7);
  return avgSlice(plan.sShrink, from, plan.curIdx) ?? 0;
}

export function shrinkPlanned8(plan) {
  const from = Math.max(0, (plan.curIdx || 0) - 7);
  return avgSlice(plan.sShrinkPlan, from, plan.curIdx) ?? plan.shrink12 ?? 0;
}

export function shrinkVariancePt(planned8, actual8) {
  return Math.round((planned8 - actual8) * 100) / 100;
}

export function shrinkRecChip(rec) {
  if (rec.dir === 'up') {
    return { chip: 'stchip critical', text: `▲ Raise ${f2(rec.gap)}pt` };
  }
  if (rec.dir === 'down') {
    return { chip: 'stchip surplus', text: `▼ Lower ${f2(Math.abs(rec.gap))}pt` };
  }
  return { chip: 'stchip balanced', text: '✓ Hold' };
}

/** 16-week shrink trend: actual through this week, plan forward. */
export function shrinkTrend16(plan) {
  const i0 = plan.curIdx || 0;
  const from = Math.max(0, i0 - 8);
  const to = Math.min((plan.weeks?.length || 1) - 1, i0 + 8);
  const values = [];
  const weeks = [];
  for (let i = from; i <= to; i++) {
    weeks.push(plan.weeks[i]);
    values.push(i <= i0 ? plan.sShrink?.[i] : plan.sShrinkPlan?.[i]);
  }
  return { values, weeks, markIdx: i0 - from };
}

export function shrInsightCls(dir) {
  if (dir === 'ok') return 'pos';
  if (dir === 'down') return 'info';
  return 'warn';
}
