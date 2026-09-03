import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { f2 } from '../utils/format';
import { statusOf } from '../utils/planLogic';
import { filterPortfolioPlans, portfolioFilterOptions } from '../utils/planSearch';
import { api } from '../api/client';
import LandingOuChart from './LandingOuChart';
import {
  portfolioRecChip,
  rosterBad,
  STATUS_LABELS,
  weekBarData,
} from '../utils/portfolioRec';
import { RED_REC_SESSION_KEY } from '../utils/welcomeMessage';

const ST_CHIP = {
  critical: 'bg-neg-bg text-neg',
  under: 'bg-warn-bg text-warn',
  surplus: 'bg-[#e2f5ec] text-pos',
  balanced: 'bg-line-2 text-ink-2',
};

const REC_CHIP = {
  pos: 'border-[#bce6d3] bg-[#e9f7f0] text-[#137a53]',
  neg: 'border-[#f6cbc7] bg-neg-bg text-neg',
  mut: 'border-line bg-surface-2 text-ink-2',
};

function KminiTile({ label, value, unit = '', barColor, onTrend }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[13px] border border-line bg-surface px-4 py-[15px]">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: barColor }} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-ink-2">{label}</div>
        {onTrend ? (
          <button
            type="button"
            className="absolute top-1.5 right-1.5 flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-md border border-line bg-surface p-0 text-[11px] leading-none hover:border-[#f6e2b8] hover:bg-brand-050"
            title="Last 12 wk actual vs next 12 wk plan"
            onClick={(e) => {
              e.stopPropagation();
              onTrend();
            }}
          >
            📈
          </button>
        ) : null}
      </div>
      <div className="mt-1.5 font-mono text-lg font-bold tracking-tight text-ink">
        {f2(value)}
        {unit}
      </div>
    </div>
  );
}

function PlanExpandDetail({ plan, onOpenDetail, recsByCap, gotBy }) {
  const rc = portfolioRecChip(plan, recsByCap, gotBy);
  const ouShrink = plan.ouShrink ?? plan.ou ?? 0;

  return (
    <div className="block w-full box-border border-b border-line bg-surface-2 px-[18px] py-4">
      <div className="mb-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KminiTile label="Shrinkage · 12wk" value={plan.shrink12} unit="%" barColor="#2a78d6" onTrend={() => {}} />
        <KminiTile label="Attrition · 12wk" value={plan.attr12} unit="%" barColor="#eb6834" onTrend={() => {}} />
        <KminiTile label="Hiring · 12wk" value={plan.hire12} unit="" barColor="#1a9e6a" onTrend={() => {}} />
        <div className="relative min-w-0 overflow-hidden rounded-[13px] border border-line bg-surface px-4 py-[15px]">
          <span
            className={`absolute inset-y-0 left-0 w-1 ${ouShrink < 0 ? 'bg-neg' : 'bg-pos'}`}
            aria-hidden
          />
          <div className="text-xs font-semibold text-ink-2">O/U with shrinkage</div>
          <div className={`mt-1.5 font-mono text-lg font-bold tracking-tight ${ouShrink < 0 ? 'text-neg' : 'text-pos'}`}>
            {f2(ouShrink)}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-3">vs billable {f2(plan.ou)}</div>
        </div>
      </div>
      <div className="mb-3 mt-0.5 text-xs font-bold uppercase tracking-wide text-ink-3">
        FTE Over / Under — week on week (last 12 + next 12, this week marked)
      </div>
      <LandingOuChart plan={plan} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className={`inline-block rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold leading-snug ${REC_CHIP[rc.cls] || REC_CHIP.mut}`}>
          {rc.t}
        </span>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_2px_6px_rgba(245,166,35,0.32)] transition-colors hover:bg-brand-600"
          onClick={() => onOpenDetail(plan.capId)}
        >
          Open detailed analysis →
        </button>
      </div>
    </div>
  );
}

function StatPill({ ic, val, lab, tip, tone = '' }) {
  const toneCls =
    tone === 'neg'
      ? 'text-neg [&_.cs-ic]:bg-neg-bg [&_.cs-ic]:text-neg'
      : tone === 'pos'
        ? 'text-pos [&_.cs-ic]:bg-[#e2f5ec] [&_.cs-ic]:text-pos'
        : tone === 'warn'
          ? 'text-warn [&_.cs-ic]:bg-warn-bg [&_.cs-ic]:text-warn'
          : '';
  return (
    <div
      className={`flex cursor-default items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 ${toneCls}`}
      title={tip}
    >
      <span className="cs-ic flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-2 text-[11px] font-extrabold text-ink-2">
        {ic}
      </span>
      <span className="cs-v text-sm font-extrabold tabular-nums">{val}</span>
      <span className="cs-l text-[11.5px] font-semibold text-ink-2">{lab}</span>
    </div>
  );
}

function CompactSummary({ plans }) {
  const under = plans.filter((p) => {
    const st = statusOf(p);
    return st === 'under' || st === 'critical';
  }).length;
  const surplus = plans.filter((p) => statusOf(p) === 'surplus').length;
  const roster = plans.filter(rosterBad).length;
  const net = plans.reduce((a, p) => a + (p.ou || 0), 0);

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <StatPill ic="▦" val={plans.length} lab="Active" tip="Active plans in this portfolio" />
      <StatPill ic="▾" val={under} lab="Understaffed" tip="Understaffed — under + critical" tone="neg" />
      <StatPill ic="▴" val={surplus} lab="Surplus" tip="Surplus (donors) — can lend capacity" tone="pos" />
      <StatPill ic="⚑" val={roster} lab="Roster gaps" tip="Classes not fully onboarded" tone="warn" />
      <StatPill ic="Σ" val={f2(net)} lab="Net O/U" tip="Net FTE Over/Under across all plans" tone={net < 0 ? 'neg' : 'pos'} />
    </div>
  );
}

function WeekBar({ plan }) {
  const { cells, values, under, over } = weekBarData(plan);
  const cellCls = { u: 'bg-neg', o: 'bg-pos', k: 'bg-[#d7dbe2]' };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-0.5">
        {cells.map((kind, i) => (
          <span
            key={i}
            className={`h-4 w-[11px] rounded-sm ${cellCls[kind] || 'bg-line'}`}
            title={`${f2(values[i])} FTE`}
          />
        ))}
      </div>
      <div className="text-[11px] font-bold">
        <span className="text-neg">{under} under</span>
        {' · '}
        <span className="text-pos">{over} over</span>
      </div>
    </div>
  );
}

function StChip({ status, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ST_CHIP[status] || ST_CHIP.balanced}`}>
      {children}
    </span>
  );
}

function RecChip({ cls, children }) {
  return (
    <span className={`inline-block rounded-lg border px-2.5 py-1.5 text-xs font-semibold leading-snug ${REC_CHIP[cls] || REC_CHIP.mut}`}>
      {children}
    </span>
  );
}

const filterSelectCls =
  'rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px] font-semibold text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-050';

export default function PortfolioLanding({
  allPlans = [],
  programs = [],
  filter = 'all',
  search = '',
  region = '',
  vertical = '',
  statusFilter = '',
  recsByCap = {},
  packages = [],
  onOpenPlan,
  onEnsurePlanDetail,
  onExecPortfolio,
  onFilterChange,
  gotBy = {},
  onProgramVisible,
  recsReady = false,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [expandedPlans, setExpandedPlans] = useState(() => new Set());
  const reportedInitialRef = useRef(false);

  const redRecsForGroup = (g) =>
    g.plans
      .map((p) => ({ capId: p.capId, rc: portfolioRecChip(p, recsByCap, gotBy) }))
      .filter(({ rc }) => rc.cls === 'neg')
      .map(({ capId, rc }) => ({ capId, text: rc.t }));

  const [facetOptions, setFacetOptions] = useState({ regions: [], verticals: [] });

  useEffect(() => {
    let cancelled = false;
    api
      .portfolioFacets()
      .then((res) => {
        if (!cancelled && res) {
          setFacetOptions({
            regions: res.regions || [],
            verticals: res.verticals || [],
          });
        }
      })
      .catch(() => {
        /* fall back to plan-derived options */
      });
    return () => {
      cancelled = true;
    };
  }, [allPlans.length]);

  const derivedOptions = useMemo(() => portfolioFilterOptions(allPlans), [allPlans]);
  const regions = facetOptions.regions.length ? facetOptions.regions : derivedOptions.regions;
  const verticals = facetOptions.verticals.length ? facetOptions.verticals : derivedOptions.verticals;

  const filtered = useMemo(() => {
    const rows = filterPortfolioPlans(allPlans, {
      query: search,
      program: filter,
      region,
      vertical,
      status: statusFilter,
    });
    return [...rows].sort((a, b) => a.sustained - b.sustained);
  }, [allPlans, filter, search, region, vertical, statusFilter]);

  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((p) => {
      const g = p.program || '— Unassigned';
      (map[g] = map[g] || []).push(p);
    });
    const order = Object.keys(map).sort(
      (a, b) => Math.min(...map[a].map((x) => x.sustained)) - Math.min(...map[b].map((x) => x.sustained)),
    );
    const prefer = programs.map((p) => p.name).filter((n) => map[n]);
    const rest = order.filter((n) => !prefer.includes(n));
    return [...prefer, ...rest].map((name) => ({ name, plans: map[name] }));
  }, [filtered, programs]);

  useEffect(() => {
    if (reportedInitialRef.current || !groups.length || !recsReady) return;
    reportedInitialRef.current = true;

    try {
      if (sessionStorage.getItem(RED_REC_SESSION_KEY)) {
        console.log('[red-rec-speech] initial readout already done this session — skipping');
        return;
      }
    } catch {
      /* private browsing — sessionStorage unavailable, skip gating */
    }

    onProgramVisible?.(groups.flatMap(redRecsForGroup));
    try {
      sessionStorage.setItem(RED_REC_SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
  }, [groups, recsReady]);

  const nPri = filtered.filter((p) => {
    const st = statusOf(p);
    return st === 'under' || st === 'critical';
  }).length;

  const queuedPackages = packages.filter((p) => p.status !== 'rejected' && p.status !== 'posted');
  const execChips = useMemo(() => {
    const chips = [];
    const staff = queuedPackages.filter(
      (p) => (p.ot_hrs || 0) > 0 || (p.xu_fte || 0) > 0 || (p.hire_count || 0) > 0,
    ).length;
    const shr = queuedPackages.filter((p) => /shrink/i.test(p.description || p.package_type || '')).length;
    if (staff) chips.push({ ic: '⚡', n: staff, label: 'staffing' });
    if (shr) chips.push({ ic: '📉', n: shr, label: 'shrinkage' });
    return chips;
  }, [queuedPackages]);

  const toggleGroup = (name) => {
    console.log('[toggle-group] clicked:', name, '— collapsed before:', [...collapsedGroups]);
    const wasCollapsed = collapsedGroups.has(name);

    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (wasCollapsed) next.delete(name);
      else next.add(name);
      return next;
    });

    console.log('[toggle-group] wasCollapsed:', wasCollapsed);
    if (wasCollapsed) {
      const g = groups.find((x) => x.name === name);
      console.log('[toggle-group] opening — found group?', !!g, g ? `capIds: ${g.plans.map((p) => p.capId)}` : '');
      if (g) onProgramVisible?.(redRecsForGroup(g));
    }
  };

  const togglePlan = (capId) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      const opening = !next.has(capId);
      if (opening) {
        next.add(capId);
        onEnsurePlanDetail?.(capId);
      } else {
        next.delete(capId);
      }
      return next;
    });
  };

  const thCls =
    'sticky top-0 z-[2] border-b border-line bg-surface px-3 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-wide text-ink-3 whitespace-nowrap';

  return (
    <div data-view="port-landing">
      {/* Header + stat strip */}
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="text-[15px] font-bold tracking-tight text-ink">
          Portfolio — CAP plans by Program{' '}
          <span className="text-xs font-medium text-ink-2">
            · grouped by Program, most deficit first
            {nPri ? (
              <>
                {' '}
                · <b className="text-neg">{nPri} need attention</b>
              </>
            ) : null}
          </span>
        </div>
        <CompactSummary plans={filtered.length ? filtered : allPlans} />
      </div>

      {/* Execute bar */}
      {queuedPackages.length ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-4 rounded-[14px] bg-gradient-to-r from-[#20242c] to-[#2b2f36] px-[18px] py-3.5 shadow-sm">
          <div className="flex min-w-[220px] flex-1 items-center gap-3.5">
            <span className="shrink-0 text-[26px]">🚀</span>
            <div className="text-[13.5px] leading-snug text-white">
              <b className="font-bold">
                {queuedPackages.length} approved action(s) across{' '}
                {new Set(queuedPackages.map((p) => p.cap_id)).size} plan(s)
              </b>{' '}
              ready to execute in one go
              {execChips.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {execChips.map((c) => (
                    <span
                      key={c.label}
                      className="rounded-full border border-[rgba(245,166,35,0.35)] bg-[rgba(245,166,35,0.16)] px-2.5 py-0.5 text-[11px] font-bold text-[#f3d9a6]"
                    >
                      {c.ic} {c.n} {c.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-[10px] bg-header px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1c1f24]"
            onClick={onExecPortfolio}
          >
            Review &amp; execute all →
          </button>
        </div>
      ) : null}

      {/* Filters */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <select className={filterSelectCls} value={region} onChange={(e) => onFilterChange?.({ region: e.target.value })}>
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select className={filterSelectCls} value={vertical} onChange={(e) => onFilterChange?.({ vertical: e.target.value })}>
          <option value="">All verticals</option>
          {verticals.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select className={filterSelectCls} value={statusFilter} onChange={(e) => onFilterChange?.({ status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="critical">Critical</option>
          <option value="under">Understaffed</option>
          <option value="balanced">Balanced</option>
          <option value="surplus">Surplus</option>
        </select>
        <input
          className={`${filterSelectCls} min-w-[150px] font-medium`}
          placeholder="Search plan / planner / site…"
          value={search}
          onChange={(e) => onFilterChange?.({ search: e.target.value })}
        />
        <span className="ml-auto whitespace-nowrap text-xs font-semibold text-ink-3">
          Showing {filtered.length} of {allPlans.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-visible rounded-[13px] border border-line bg-surface p-0 shadow-sm">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className={`${thCls} text-left`}>CAP Plan</th>
              <th className={thCls}>Avg FTE O/U · 12wk</th>
              <th className={thCls}>Next 12 wks (▮ under / ▮ over)</th>
              <th className={thCls}>Status</th>
              <th className={`${thCls} text-left`}>Recommendation</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const col = collapsedGroups.has(g.name);
              const under = g.plans.filter((p) => {
                const st = statusOf(p);
                return st === 'under' || st === 'critical';
              }).length;
              const netg = g.plans.reduce((a, p) => a + (p.sustained || 0), 0);
              return (
                <Fragment key={g.name}>
                  <tr className="cursor-pointer" onClick={() => toggleGroup(g.name)}>
                    <td
                      colSpan={6}
                      className="border-b border-t border-line bg-surface-2 px-3.5 py-2.5 text-left hover:bg-[#f1ede4]"
                    >
                      <span
                        className={`mr-2 inline-block text-[10px] text-brand-600 transition-transform ${col ? '' : 'rotate-90'}`}
                      >
                        ▶
                      </span>
                      <span className="text-[13.5px] font-extrabold tracking-tight text-ink">{g.name}</span>
                      <span className="ml-3 text-[11.5px] font-semibold text-ink-3">
                        {g.plans.length} plan{g.plans.length === 1 ? '' : 's'}
                        {under ? (
                          <>
                            {' '}
                            · <b className="text-neg">{under} need attention</b>
                          </>
                        ) : null}{' '}
                        · net 12-wk O/U{' '}
                        <b className={netg < 0 ? 'text-neg' : 'text-pos'}>
                          {netg >= 0 ? '+' : ''}
                          {f2(netg)}
                        </b>
                      </span>
                    </td>
                  </tr>
                  {!col
                    ? g.plans.map((p) => {
                        const ex = expandedPlans.has(p.capId);
                        const st = statusOf(p);
                        const rc = portfolioRecChip(p, recsByCap, gotBy);
                        const subcrumb = [p.lob, p.subLob, p.site || p.country].filter(Boolean).join(' › ');
                        return (
                          <Fragment key={p.capId}>
                            <tr
                              className={`cursor-pointer ${ex ? 'bg-brand-050 [&>td]:border-b-transparent' : 'bg-surface hover:bg-surface-2'}`}
                              onClick={() => togglePlan(p.capId)}
                            >
                              <td className="border-b border-line-2 px-3 py-[11px] pl-[26px] text-left">
                                <div className="flex flex-wrap items-center gap-1.5 font-bold text-ink">
                                  <span className={`text-[11px] text-ink-3 transition-transform ${ex ? 'rotate-90' : ''}`}>
                                    ▶
                                  </span>
                                  <span className="rounded-[5px] border border-[#f6e2b8] bg-brand-050 px-1.5 py-px font-mono text-[10.5px] font-bold tracking-wide text-brand-600">
                                    {p.capId}
                                  </span>
                                  <span>{p.plan}</span>
                                  {rosterBad(p) ? (
                                    <span className="inline-flex items-center gap-1 rounded-xl bg-neg-bg px-1.5 py-0.5 text-[10.5px] font-bold text-neg">
                                      ⚑ roster
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-px text-[11px] font-medium text-ink-3">{subcrumb}</div>
                              </td>
                              <td
                                className={`border-b border-line-2 px-3 py-[11px] text-right font-mono text-[13px] font-extrabold tabular-nums ${p.sustained < 0 ? 'text-neg' : 'text-pos'}`}
                              >
                                {p.sustained >= 0 ? '+' : ''}
                                {f2(p.sustained)}
                              </td>
                              <td className="border-b border-line-2 px-3 py-[11px] text-right tabular-nums">
                                <WeekBar plan={p} />
                              </td>
                              <td className="border-b border-line-2 px-3 py-[11px] text-right">
                                <StChip status={st}>{STATUS_LABELS[st] || st}</StChip>
                              </td>
                              <td className="border-b border-line-2 px-3 py-[11px] text-left">
                                <RecChip cls={rc.cls}>{rc.t}</RecChip>
                              </td>
                              <td className="border-b border-line-2 px-3 py-[11px] text-right">
                                <button
                                  type="button"
                                  className="cursor-pointer whitespace-nowrap rounded-lg border border-brand bg-brand-050 px-3 py-1.5 text-[12.5px] font-bold text-brand-600 hover:bg-[#fdeecb]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPlan?.(p.capId);
                                  }}
                                >
                                  Open →
                                </button>
                              </td>
                            </tr>
                            {ex ? (
                              <tr className="table-row">
                                <td colSpan={6} className="table-cell w-full bg-surface-2 p-0 align-top">
                                  <PlanExpandDetail
                                    plan={p}
                                    onOpenDetail={onOpenPlan}
                                    recsByCap={recsByCap}
                                    gotBy={gotBy}
                                  />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!groups.length ? (
        <div className="mt-3 flex items-start gap-3 rounded-[11px] border border-[#c5ddf7] bg-info-bg px-4 py-3">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-info text-sm font-extrabold text-white">
            i
          </div>
          <div className="text-[13px] text-ink">
            <b>No plans match</b> — try clearing search or changing filters
          </div>
        </div>
      ) : null}
    </div>
  );
}
