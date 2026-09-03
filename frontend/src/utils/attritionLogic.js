import { avgSlice } from './shrinkageLogic';

const MAX_Y_TICKS = 11;

export function attrActual8(plan) {
  const from = Math.max(0, (plan.curIdx || 0) - 7);
  return avgSlice(plan.sAttr, from, plan.curIdx) ?? 0;
}

/** Average planned attrition % over the next 8 forward weeks. */
export function attrPlanned8(plan, displayPlan) {
  const from = plan.curIdx || 0;
  const to = Math.min((plan.weeks?.length || 1) - 1, from + 7);
  const src = displayPlan || plan.sAttrPlan;
  return avgSlice(src, from, to) ?? plan.attr12 ?? 0;
}

export function attrVariancePt(planned8, actual8) {
  return Math.round((planned8 - actual8) * 100) / 100;
}

/** 16-week attrition trend: actual through this week, plan forward. */
export function attrTrend16(plan, displayPlan) {
  const i0 = plan.curIdx || 0;
  const from = Math.max(0, i0 - 8);
  const to = Math.min((plan.weeks?.length || 1) - 1, i0 + 8);
  const planSeries = displayPlan || plan.sAttrPlan;
  const values = [];
  const weeks = [];
  for (let i = from; i <= to; i++) {
    weeks.push(plan.weeks[i]);
    values.push(i <= i0 ? plan.sAttr?.[i] : planSeries?.[i]);
  }
  return { values, weeks, markIdx: i0 - from };
}

/**
 * Y-axis for attrition chart — reference uses 0–2% @ 0.2 steps.
 * When data exceeds 2%, expand ceiling but coarsen step so labels stay readable.
 */
export function attrChartScale(plan, displayPlan, planned8 = 0) {
  const peaks = [];
  (plan.sAttr || []).forEach((v, i) => {
    if (i <= (plan.curIdx || 0) && v != null && v > 0) peaks.push(v);
  });
  (displayPlan || []).forEach((v) => {
    if (v != null && v > 0) peaks.push(v);
  });
  if (planned8 > 0) peaks.push(planned8);

  const mx = peaks.length ? Math.max(...peaks) : Math.max(Number(plan.attr12) || 0, 0.2);

  if (mx <= 2.05) {
    return { min: 0, max: 2, step: 0.2 };
  }

  for (const step of [0.5, 1, 2, 5]) {
    const max = Math.ceil(mx / step) * step;
    if (max / step + 1 <= MAX_Y_TICKS) {
      return { min: 0, max, step };
    }
  }
  const max = Math.ceil(mx / 5) * 5;
  return { min: 0, max, step: 5 };
}

/** Format Y-axis tick for attrition scale step. */
export function attrYFmt(v, step = 0.2) {
  if (step >= 1) return `${Math.round(v)}%`;
  if (Number.isInteger(v) || Math.abs(v - Math.round(v)) < 0.001) return `${Math.round(v)}%`;
  return `${Number(v).toFixed(1)}%`;
}

/** Actual attrition bars through this week (skip exact zeros — no sliver bars). */
export function attrActualBars(plan) {
  const cur = plan.curIdx || 0;
  return (plan.sAttr || []).map((v, i) => {
    if (i > cur) return null;
    if (v == null || Number(v) === 0) return null;
    return v;
  });
}

/** Plan attrition bars from this week forward. */
export function attrPlanBars(displayPlan, curIdx) {
  return (displayPlan || []).map((v, i) => (i < curIdx ? null : v));
}
