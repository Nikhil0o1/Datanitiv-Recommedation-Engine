/** Shared portfolio search — matches plan rows, triage items, and queue packages. */

import { statusOf } from './planLogic';

export function normalizeSearchQuery(query) {
  return (query || '').trim().toLowerCase();
}

export function planSearchFields(item) {
  if (!item) return [];
  return [
    item.plan,
    item.plan_name,
    item.capId,
    item.cap_id,
    item.program,
    item.lob,
    item.site,
    item.planner,
    item.region,
    item.vertical,
    item.subLob,
    item.country,
    item.why,
    item.description,
    item.tag,
  ].filter(Boolean);
}

export function matchesPlanSearch(item, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  return planSearchFields(item).some((field) => String(field).toLowerCase().includes(q));
}

export function searchScore(item, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return 0;

  const cap = String(item.capId || item.cap_id || '').toLowerCase();
  const name = String(item.plan || item.plan_name || '').toLowerCase();
  const program = String(item.program || '').toLowerCase();

  if (cap === q) return 100;
  if (cap.startsWith(q)) return 92;
  if (name === q) return 88;
  if (name.startsWith(q)) return 84;
  if (program.startsWith(q)) return 70;
  if (planSearchFields(item).some((f) => String(f).toLowerCase().startsWith(q))) return 60;
  if (matchesPlanSearch(item, q)) return 40;
  return 0;
}

export function filterPlans(plans, { query, program = 'all' } = {}) {
  return filterPortfolioPlans(plans, { query, program });
}

/** Portfolio landing filters — region, vertical, staffing status, program, search. */
export function filterPortfolioPlans(
  plans,
  { query = '', program = 'all', region = '', vertical = '', status = '' } = {},
) {
  let rows = plans || [];
  if (program && program !== 'all') {
    rows = rows.filter((p) => p.program === program);
  }
  if (region) {
    const r = region.toLowerCase();
    rows = rows.filter((p) => String(p.region || '').toLowerCase() === r);
  }
  if (vertical) {
    const v = vertical.toLowerCase();
    rows = rows.filter((p) => String(p.vertical || '').toLowerCase() === v);
  }
  if (status) {
    rows = rows.filter((p) => statusOf(p) === status);
  }
  const q = normalizeSearchQuery(query);
  if (q) {
    rows = rows.filter((p) => matchesPlanSearch(p, q));
  }
  return rows;
}

export function portfolioFilterOptions(plans) {
  const regions = [...new Set((plans || []).map((p) => p.region).filter(Boolean))].sort();
  const verticals = [...new Set((plans || []).map((p) => p.vertical).filter(Boolean))].sort();
  return { regions, verticals };
}

export function searchPlans(plans, query, { program = 'all', limit = 8 } = {}) {
  return filterPlans(plans, { query, program })
    .map((p) => ({ plan: p, score: searchScore(p, query) }))
    .sort((a, b) => b.score - a.score || (a.plan.sustained ?? 0) - (b.plan.sustained ?? 0))
    .slice(0, limit)
    .map((x) => x.plan);
}
