import { f2 } from './format';

export function money(n) {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function avg(arr, lo, hi) {
  const v = [];
  for (let i = lo; i <= hi; i++) {
    if (arr[i] != null) v.push(arr[i]);
  }
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

const rnd = (x) => (x == null ? null : Math.round(x * 100) / 100);

/** Recent actual (last up-to-8 wk) vs forward plan (next up-to-8 wk) — matches v4 HTML fwBias. */
export function fwBias(plan) {
  if (!plan) return { rActVol: null, fFcst: null, rActAht: null, fGoal: null, fBias: null, aBias: null };
  const rActVol = avg(plan.sActVol || [], Math.max(0, plan.curIdx - 7), plan.curIdx);
  const fFcst = avg(plan.sFcst || [], plan.curIdx, Math.min((plan.sFcst?.length || 1) - 1, plan.curIdx + 7));
  const rActAht = avg(plan.sAhtAct || [], Math.max(0, plan.curIdx - 7), plan.curIdx);
  const fGoal = avg(plan.sAhtGoal || [], plan.curIdx, Math.min((plan.sAhtGoal?.length || 1) - 1, plan.curIdx + 7));
  const fB = rActVol != null && fFcst ? ((rActVol - fFcst) / fFcst) * 100 : null;
  const aB = rActAht != null && fGoal ? ((rActAht - fGoal) / fGoal) * 100 : null;
  return { rActVol, fFcst, rActAht, fGoal, fBias: rnd(fB), aBias: rnd(aB) };
}

export function fwRec(plan) {
  const b = fwBias(plan);
  const fb = b.fBias;
  const ab = b.aBias;
  const vol =
    fb == null
      ? { d: 'none', t: 'Insufficient actuals' }
      : fb > 5
        ? {
            d: 'up',
            t: `Recent actual volume ~${money(b.rActVol)} is <b>above</b> the ~${money(b.fFcst)} forecast (+${f2(fb)}%) — <b>revise forecast up</b> so FTE need isn't understated`,
          }
        : fb < -5
          ? {
              d: 'down',
              t: `Recent actual volume ~${money(b.rActVol)} is <b>below</b> the ~${money(b.fFcst)} forecast (${f2(fb)}%) — <b>revise forecast down</b> so FTE need isn't overstated`,
            }
          : {
              d: 'ok',
              t: `Forecast on track — recent actual within ${f2(Math.abs(fb))}% of forward forecast`,
            };
  const aht =
    ab == null
      ? { d: 'none', t: 'Insufficient actuals' }
      : ab < -5
        ? {
            d: 'down',
            t: `Actual AHT ~${f2(b.rActAht)}s is <b>below</b> the ${f2(b.fGoal)}s goal (${f2(ab)}%) — agents are beating the goal, so <b>lower the AHT goal</b> toward actual; the plan is currently over-stating FTE need`,
          }
        : ab > 5
          ? {
              d: 'up',
              t: `Actual AHT ~${f2(b.rActAht)}s is <b>above</b> the ${f2(b.fGoal)}s goal (+${f2(ab)}%) — handle time is running hot, so <b>raise the goal</b> toward actual (or investigate) as the plan is under-stating FTE need`,
            }
          : {
              d: 'ok',
              t: `AHT on goal — actual ~${f2(b.rActAht)}s within ${f2(Math.abs(ab))}% of the ${f2(b.fGoal)}s goal`,
            };
  return { vol, aht, b };
}

export function volStep(plan) {
  const m = Math.max(...(plan.sFcst || []).filter((x) => x != null), 1);
  if (m > 20000) return 250;
  if (m > 5000) return 50;
  if (m > 1000) return 10;
  return 5;
}

export function fwRecTarget(plan, kind) {
  const b = fwBias(plan);
  const bias = kind === 'vol' ? b.fBias : b.aBias;
  if (bias == null) return null;
  const step = kind === 'vol' ? volStep(plan) : 5;
  const src = kind === 'vol' ? plan.sFcst : plan.sAhtGoal;
  const ratio = 1 + bias / 100;
  const apply = {};
  for (let i = plan.curIdx; i < plan.weeks.length; i++) {
    const o = src[i];
    if (o != null) apply[i] = Math.max(0, Math.round((o * ratio) / step) * step);
  }
  return { apply, dir: kind === 'vol' ? fwRec(plan).vol.d : fwRec(plan).aht.d, cur: apply[plan.curIdx], bias };
}

export function fwGet(plan, kind, i, fwAdj = {}) {
  const o = fwAdj[plan.plan]?.[kind]?.[i];
  if (o != null) return o;
  return kind === 'vol' ? plan.sFcst?.[i] : plan.sAhtGoal?.[i];
}

export function fwOrig(plan, kind, i) {
  return kind === 'vol' ? plan.sFcst?.[i] : plan.sAhtGoal?.[i];
}

export function fwHas(plan, fwAdj = {}) {
  const a = fwAdj[plan.plan];
  return a && (Object.keys(a.vol || {}).length || Object.keys(a.aht || {}).length);
}

export function fwLastPct(plan, kind, fwAdj = {}, fwLast = {}) {
  const i = fwLast[plan.plan]?.[kind];
  if (i == null) return null;
  const o = fwOrig(plan, kind, i);
  if (!o) return null;
  return Math.round((fwGet(plan, kind, i, fwAdj) / o - 1) * 10000) / 100;
}

export function fwImpact(plan, fwAdj = {}) {
  const a = fwAdj[plan.plan];
  if (!a) return [];
  const idxs = [...new Set([...Object.keys(a.vol || {}), ...Object.keys(a.aht || {})].map(Number))].sort(
    (x, y) => x - y,
  );
  return idxs.map((i) => {
    const oV = plan.sFcst[i];
    const oA = plan.sAhtGoal[i];
    const oReq = plan.sReq[i];
    const proj = plan.sProj[i];
    const oOU = plan.sOU[i];
    const nV = fwGet(plan, 'vol', i, fwAdj);
    const nA = fwGet(plan, 'aht', i, fwAdj);
    let nReq = oReq;
    if (oV > 0 && oA > 0 && oReq > 0) nReq = oReq * (nV / oV) * (nA / oA);
    nReq = Math.round(nReq * 100) / 100;
    const nOU = Math.round((proj - nReq) * 100) / 100;
    return {
      i,
      wk: plan.weeks[i],
      oV,
      nV,
      oA,
      nA,
      oReq,
      nReq,
      oOU,
      nOU,
      dReq: Math.round((nReq - oReq) * 100) / 100,
    };
  });
}

export function recChipCls(d) {
  if (d === 'up') return 'stchip critical';
  if (d === 'down') return 'stchip surplus';
  return 'stchip balanced';
}

export function volRecTxt(d) {
  if (d === 'up') return '▲ Revise up';
  if (d === 'down') return '▼ Revise down';
  if (d === 'ok') return '✓ Hold';
  return '— n/a';
}

export function ahtRecTxt(d) {
  if (d === 'up') return '▲ Raise goal';
  if (d === 'down') return '▼ Lower goal';
  if (d === 'ok') return '✓ Hold';
  return '— n/a';
}

export function planCrumb(plan) {
  return [plan.program || '—', plan.region, plan.site || plan.country].filter(Boolean).join(' · ');
}
