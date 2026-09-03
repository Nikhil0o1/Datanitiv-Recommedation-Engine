/** Convert API plan detail into prototype-compatible DATA row, enriched from HTML demo fields. */
import enrichment from '../data/htmlPlanEnrichment.json';
import { computeClosing } from './planLogic';

const BY_CAP = Object.fromEntries(enrichment.map((e) => [e.capId, e]));

function zeros(n, fill = 0) {
  return Array.from({ length: n }, () => fill);
}

function pickSeries(apiVal, enrichVal, n, fill = 0) {
  if (Array.isArray(apiVal) && apiVal.some((v) => v != null)) return apiVal;
  if (Array.isArray(enrichVal) && enrichVal.some((v) => v != null)) return enrichVal;
  return zeros(n, fill);
}

function hcFromApi(h) {
  if (!h) return null;
  const hc = {
    opening: Number(h.opening) || 0,
    nest: Number(h.nest) || 0,
    tin: Number(h.tin) || 0,
    tout: Number(h.tout) || 0,
    loaIn: Number(h.loa_in ?? h.loaIn) || 0,
    loaOut: Number(h.loa_out ?? h.loaOut) || 0,
    attr: Number(h.attr) || 0,
    promo: Number(h.promo) || 0,
    closing: 0,
  };
  hc.closing = computeClosing(hc);
  return hc;
}

export function detailToDataRow(detail) {
  const weeks = detail.weeks || [];
  const n = weeks.length;
  const enrich = BY_CAP[detail.cap_id] || {};
  const apiCls =
    detail.roster_classes?.find((c) => c.status === 'planned' && String(c.class_name || '').startsWith('EXEC-HIRE')) ||
    detail.roster_classes?.find((c) => c.status === 'mapped' || c.status === 'uploaded') ||
    detail.roster_classes?.find((c) => c.status === 'missing') ||
    detail.roster_classes?.[0] ||
    null;
  const enrichCls = enrich.cls || null;
  const clsSrc =
    apiCls || enrichCls
      ? {
          id: apiCls?.id,
          name: apiCls?.class_name || enrichCls?.name || enrichCls?.className,
          date: apiCls?.class_date || enrichCls?.date,
          wkRel: apiCls?.wk_rel ?? enrichCls?.wkRel ?? 0,
          plan: apiCls?.plan_hc ?? enrichCls?.plan ?? 0,
          actual: apiCls?.actual_hc ?? 0,
          trainHC: apiCls?.train_hc ?? enrichCls?.trainHC ?? apiCls?.plan_hc ?? enrichCls?.plan ?? 0,
          status: apiCls?.status || 'missing',
          trainWk: apiCls?.train_wk ?? enrichCls?.trainWk ?? 2,
          nestWk: apiCls?.nest_wk ?? enrichCls?.nestWk ?? 1,
          rosterFile: apiCls?.roster_file || null,
          employeeCount: apiCls?.employee_count ?? 0,
        }
      : null;

  const hcCur = hcFromApi(detail.headcount) || hcFromApi(enrich.hcCur);
  const hcLast =
    hcFromApi(detail.headcount_last) ||
    hcFromApi(enrich.hcLast) ||
    (hcCur
      ? hcFromApi({
          opening: hcCur.opening,
          nest: 0,
          tin: 0,
          tout: 0,
          loa_in: 0,
          loa_out: 0,
          attr: 0,
          promo: 0,
        })
      : null);

  const closingFTE = detail.closing_fte ?? hcCur?.closing ?? enrich.closingFTE ?? 0;
  const availHrs = detail.avail_hrs ?? enrich.availHrs ?? 40;

  const attr12 = detail.attr12 ?? enrich.attr12 ?? 0;
  const hire12 = detail.hire12 ?? 0;
  const nClasses12 = detail.n_classes_12 ?? 0;
  const sShrinkPlan = weeks.map((w) => w.shrink_plan);
  const curIdx = detail.cur_week_idx || 0;
  const fwdShrink = sShrinkPlan.slice(curIdx, curIdx + 12).filter((v) => v != null);
  const shrink12 =
    detail.shrink12 ??
    (fwdShrink.length ? fwdShrink.reduce((a, b) => a + b, 0) / fwdShrink.length : enrich.shrink12) ??
    0;

  return {
    plan: detail.plan_name,
    capId: detail.cap_id,
    site: detail.site.endsWith('-') ? detail.site : `${detail.site}-`,
    subLob: detail.sub_lob || detail.subLob || '',
    country: detail.country || detail.region || '',
    lob: detail.lob,
    region: detail.region,
    planner: detail.planner,
    program: detail.program,
    vertical: detail.vertical,
    weeks: weeks.map((w) => w.week_label),
    curIdx,
    isVol: detail.is_vol ?? enrich.isVol ?? false,
    ou: detail.ou ?? enrich.ou ?? 0,
    ouShrink: detail.ou_shrink ?? enrich.ouShrink ?? detail.ou ?? 0,
    sustained: detail.sustained ?? enrich.sustained ?? 0,
    minOUfwd: detail.min_ou_fwd ?? enrich.minOUfwd ?? 0,
    closingFTE,
    availHrs,
    shrink12,
    attr12,
    hire12,
    recOT: Math.round(0.05 * closingFTE * availHrs * 100) / 100,
    nClasses12,
    billable: detail.billable,
    fBias: detail.f_bias ?? enrich.fBias ?? null,
    aBias: detail.a_bias ?? enrich.aBias ?? null,
    sOU: weeks.map((w) => w.ou),
    sShrink: weeks.map((w) => w.shrink_actual),
    sShrinkPlan,
    sProj: weeks.map((w) => w.projected),
    sReq: weeks.map((w) => w.required),
    sAttr: pickSeries(detail.s_attr, enrich.sAttr, n, attr12),
    sAttrPlan: pickSeries(detail.s_attr_plan, enrich.sAttrPlan, n, 0),
    sHire: pickSeries(detail.s_hire, enrich.sHire, n, 0),
    sFcst: detail.s_fcst ?? enrich.sFcst ?? null,
    sActVol: detail.s_act_vol ?? enrich.sActVol ?? null,
    sAhtGoal: detail.s_aht_goal ?? enrich.sAhtGoal ?? null,
    sAhtAct: detail.s_aht_act ?? enrich.sAhtAct ?? null,
    cls: clsSrc
      ? {
          id: clsSrc.id,
          name: clsSrc.name || clsSrc.className,
          date: clsSrc.date,
          wkRel: clsSrc.wkRel,
          plan: clsSrc.plan,
          actual: clsSrc.actual,
          trainHC: clsSrc.trainHC,
          status: clsSrc.status,
          trainWk: clsSrc.trainWk,
          nestWk: clsSrc.nestWk,
          rosterFile: clsSrc.rosterFile,
          employeeCount: clsSrc.employeeCount,
        }
      : null,
    hcCur,
    hcLast,
  };
}

/** Minimal portfolio row from /api/plans summary — charts enrich in background. */
export function summaryToDataRow(summary) {
  const enrich = BY_CAP[summary.cap_id] || {};
  const curIdx = summary.cur_week_idx || 0;
  const n = Math.max(curIdx + 12, 16);
  return {
    plan: summary.plan_name,
    capId: summary.cap_id,
    site: summary.site?.endsWith('-') ? summary.site : `${summary.site || ''}-`,
    subLob: summary.sub_lob || summary.subLob || '',
    country: summary.country || summary.region || '',
    lob: summary.lob,
    region: summary.region,
    planner: summary.planner,
    program: summary.program,
    vertical: summary.vertical,
    weeks: [],
    curIdx,
    isVol: summary.is_vol ?? enrich.isVol ?? false,
    ou: summary.ou ?? enrich.ou ?? 0,
    ouShrink: summary.ou ?? enrich.ouShrink ?? summary.ou ?? 0,
    sustained: summary.sustained ?? enrich.sustained ?? 0,
    minOUfwd: summary.min_ou_fwd ?? enrich.minOUfwd ?? 0,
    closingFTE: summary.closing_fte ?? enrich.closingFTE ?? 0,
    availHrs: enrich.availHrs ?? 40,
    shrink12: summary.shrink12 ?? enrich.shrink12 ?? 0,
    attr12: summary.attr12 ?? enrich.attr12 ?? 0,
    hire12: summary.hire12 ?? 0,
    recOT: 0,
    nClasses12: summary.n_classes_12 ?? 0,
    billable: summary.billable,
    fBias: enrich.fBias ?? null,
    aBias: enrich.aBias ?? null,
    sOU: zeros(n, summary.ou ?? 0),
    sShrink: zeros(n, 0),
    sShrinkPlan: zeros(n, summary.shrink12 ?? 0),
    sProj: zeros(n, 0),
    sReq: zeros(n, 0),
    sAttr: zeros(n, summary.attr12 ?? 0),
    sAttrPlan: zeros(n, 0),
    sHire: zeros(n, 0),
    sFcst: enrich.sFcst ?? null,
    sActVol: enrich.sActVol ?? null,
    sAhtGoal: enrich.sAhtGoal ?? null,
    sAhtAct: enrich.sAhtAct ?? null,
    cls: enrich.cls || null,
    hcCur: hcFromApi(enrich.hcCur),
    hcLast: hcFromApi(enrich.hcLast),
    _summaryOnly: true,
  };
}

export async function loadAllDataRows(api, { onBatch } = {}) {
  const summaries = await api.plans();
  const rows = summaries.map(summaryToDataRow);
  if (onBatch) onBatch([...rows]);
  return rows;
}

/** Build program sidebar list from loaded portfolio rows (avoids extra /api/programs). */
export function deriveProgramsFromRows(rows) {
  const grouped = {};
  rows.forEach((r) => {
    const name = r.program || 'Unknown';
    if (!grouped[name]) grouped[name] = { name, plan_count: 0, net_ou: 0 };
    grouped[name].plan_count += 1;
    grouped[name].net_ou += Number(r.ou) || 0;
  });
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, g], idx) => ({
      id: idx + 1,
      name: g.name,
      plan_count: g.plan_count,
      net_ou: Math.round(g.net_ou * 100) / 100,
    }));
}

/** Fetch one plan detail and merge into a portfolio row. */
export async function fetchPlanDataRow(api, capId) {
  const detail = await api.plan(capId);
  return detailToDataRow(detail);
}

const ENRICH_BATCH = 8;

/** Low-priority background enrichment for week bars / expand panels. */
export async function enrichDataRowsInBackground(api, capIds, mergeRow) {
  for (let i = 0; i < capIds.length; i += ENRICH_BATCH) {
    const chunk = capIds.slice(i, i + ENRICH_BATCH);
    const details = await Promise.all(chunk.map((capId) => api.plan(capId)));
    details.forEach((detail) => mergeRow(detailToDataRow(detail)));
  }
}
