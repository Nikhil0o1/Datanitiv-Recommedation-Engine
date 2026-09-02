import { f2 } from './format';
import { planRec, statusOf, weeks12 } from './planLogic';
import { chipClassForRecommendation, chipTextForRecommendation } from '../hooks/usePortfolioRecommendations';

/** Plan-derived staffing chip when Concierge has no row yet (live API plan metrics, not mock). */
export function planDerivedChip(plan, gotBy = {}) {
  const st = statusOf(plan);
  const w = weeks12(plan);
  const s = (plan.sOU || []).slice(plan.curIdx, plan.curIdx + 12);
  const peak = s.length ? Math.min(0, ...s) : 0;
  if (st === 'under' || st === 'critical') {
    const r = planRec(plan, { gotBy });
    return { cls: 'neg', t: `Short ~${f2(r.gap)} FTE · OT ${f2(r.otFTE)} + cross-util ${f2(r.xr)} + hire ${r.starts}` };
  }
  if (w.under >= 2) {
    return { cls: 'neg', t: `${w.under} of 12 wks short (peak ${f2(peak)} FTE) — OT / redistribute to cover` };
  }
  if (st === 'surplus') {
    return { cls: 'pos', t: `Surplus — lend up to ${f2(Math.max(0, plan.minOUfwd - 1))} FTE (cross-util)` };
  }
  return { cls: 'mut', t: 'On plan — no shortfall weeks' };
}

/** Concierge recommendation first; otherwise plan-derived from live metrics. */
export function portfolioRecChip(plan, recsByCap, gotBy = {}) {
  const rec = recsByCap?.[plan.capId];
  const conciergeText = chipTextForRecommendation(rec);
  if (conciergeText) {
    return { cls: chipClassForRecommendation(rec), t: conciergeText, source: 'concierge', rec };
  }
  const derived = planDerivedChip(plan, gotBy);
  return { ...derived, source: 'plan' };
}

export const STATUS_LABELS = {
  critical: 'Critical',
  under: 'Understaffed',
  surplus: 'Surplus',
  balanced: 'Balanced',
};

export function rosterBad(plan) {
  const cls = plan.cls;
  return cls && (cls.status === 'missing' || cls.status === 'partial');
}

export function weekBarData(plan) {
  const w = weeks12(plan);
  return {
    cells: w.s.map((v) => (v < -0.5 ? 'u' : v > 0.5 ? 'o' : 'k')),
    values: w.s,
    under: w.under,
    over: w.over,
  };
}
