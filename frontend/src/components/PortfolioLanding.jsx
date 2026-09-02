import { Fragment, useMemo, useState } from 'react';
import { f2 } from '../utils/format';
import { statusOf } from '../utils/planLogic';
import SeriesChart from './SeriesChart';
import {
  portfolioRecChip,
  rosterBad,
  STATUS_LABELS,
  weekBarData,
} from '../utils/portfolioRec';

function KminiTile({ label, value, unit = '', barColor, onTrend }) {
  return (
    <div className="tile land-kmini" style={{ minWidth: 0 }}>
      <span className="bar" style={{ background: barColor }} />
      <div className="land-kmini-head">
        <div className="k">{label}</div>
        {onTrend ? (
          <button
            type="button"
            className="trendbtn"
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
      <div className="v mono land-kmini-val">
        {f2(value)}
        {unit}
      </div>
    </div>
  );
}

function landingOuBars(plan) {
  const past = (plan.sOU || []).map((v, i) => (i <= plan.curIdx ? v : null));
  const future = (plan.sOU || []).map((v, i) => (i >= plan.curIdx ? v : null));
  return [
    {
      tipLabel: 'Actual/plan',
      data: past,
      color: (v) => (v == null ? 'transparent' : v < 0 ? '#e0483f' : '#1a9e6a'),
    },
    {
      tipLabel: 'Forecast',
      data: future,
      color: (v) => (v == null ? 'transparent' : v < 0 ? '#f3b0ab' : '#a9dcc6'),
    },
  ];
}

function PlanExpandDetail({ plan, onOpenDetail, recsByCap, gotBy }) {
  const rc = portfolioRecChip(plan, recsByCap, gotBy);
  const ouShrink = plan.ouShrink ?? plan.ou ?? 0;
  const ouBars = useMemo(() => landingOuBars(plan), [plan]);

  return (
    <div className="detail-inner">
      <div className="grid g4 land-kmini-grid">
        <KminiTile label="Shrinkage · 12wk" value={plan.shrink12} unit="%" barColor="#2a78d6" onTrend={() => {}} />
        <KminiTile label="Attrition · 12wk" value={plan.attr12} unit="%" barColor="#eb6834" onTrend={() => {}} />
        <KminiTile label="Hiring · 12wk" value={plan.hire12} unit="" barColor="#1a9e6a" onTrend={() => {}} />
        <div className={`tile land-kmini ${ouShrink < 0 ? 'b-neg' : 'b-pos'}`} style={{ minWidth: 0 }}>
          <span className="bar" />
          <div className="k">O/U with shrinkage</div>
          <div className={`v mono land-kmini-val ${ouShrink < 0 ? 'neg' : 'pos'}`}>{f2(ouShrink)}</div>
          <div className="s">vs billable {f2(plan.ou)}</div>
        </div>
      </div>
      <div className="slabel">FTE Over / Under — week on week (last 12 + next 12, this week marked)</div>
      <div className="chartbox land-chartbox">
        <SeriesChart
          weeks={plan.weeks}
          curIdx={plan.curIdx}
          zeroLine
          height={200}
          valueUnit="FTE"
          yFmt={f2}
          thinBars={false}
          barRatio={0.492}
          barRadius={4}
          flush
          responsive
          bars={ouBars}
        />
      </div>
      <div className="detail-foot">
        <span className={`recchip ${rc.cls}`}>{rc.t}</span>
        <button type="button" className="btn btn-primary" onClick={() => onOpenDetail(plan.capId)}>
          Open detailed analysis →
        </button>
      </div>
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

  const stat = (ic, val, lab, tip, cls = '') => (
    <div className={`cstat ${cls}`} title={tip}>
      <span className="cs-ic">{ic}</span>
      <span className="cs-v">{val}</span>
      <span className="cs-l">{lab}</span>
    </div>
  );

  return (
    <div className="statstrip">
      {stat('▦', plans.length, 'Active', 'Active plans in this portfolio')}
      {stat('▾', under, 'Understaffed', 'Understaffed — under + critical', 'neg')}
      {stat('▴', surplus, 'Surplus', 'Surplus (donors) — can lend capacity', 'pos')}
      {stat('⚑', roster, 'Roster gaps', 'Classes not fully onboarded', 'warn')}
      {stat('Σ', f2(net), 'Net O/U', 'Net FTE Over/Under across all plans', net < 0 ? 'neg' : 'pos')}
    </div>
  );
}

function WeekBar({ plan }) {
  const { cells, values, under, over } = weekBarData(plan);
  return (
    <div className="wbwrap">
      <div className="weekbar">
        {cells.map((kind, i) => (
          <span key={i} className={`wb ${kind}`} title={`${f2(values[i])} FTE`} />
        ))}
      </div>
      <div className="wblabel">
        <span className="wl u">{under} under</span> · <span className="wl o">{over} over</span>
      </div>
    </div>
  );
}

export default function PortfolioLanding({
  plans = [],
  programs = [],
  filter = 'all',
  search = '',
  region = '',
  vertical = '',
  statusFilter = '',
  recsByCap = {},
  packages = [],
  onOpenPlan,
  onExecPortfolio,
  onFilterChange,
  gotBy = {},
}) {
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [expandedPlans, setExpandedPlans] = useState(() => new Set());

  const filtered = useMemo(() => {
    let rows = plans;
    if (region) rows = rows.filter((p) => p.region === region);
    if (vertical) rows = rows.filter((p) => p.vertical === vertical);
    if (statusFilter) rows = rows.filter((p) => statusOf(p) === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.plan?.toLowerCase().includes(q) ||
          p.capId?.toLowerCase().includes(q) ||
          p.planner?.toLowerCase().includes(q) ||
          p.site?.toLowerCase().includes(q) ||
          p.program?.toLowerCase().includes(q),
      );
    }
    if (filter !== 'all') rows = rows.filter((p) => p.program === filter);
    return [...rows].sort((a, b) => a.sustained - b.sustained);
  }, [plans, filter, search, region, vertical, statusFilter]);

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

  const regions = useMemo(() => [...new Set(plans.map((p) => p.region).filter(Boolean))].sort(), [plans]);
  const verticals = useMemo(() => [...new Set(plans.map((p) => p.vertical).filter(Boolean))].sort(), [plans]);

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
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const togglePlan = (capId) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(capId)) next.delete(capId);
      else next.add(capId);
      return next;
    });
  };

  return (
    <div className="land-v4" data-view="port-landing">
      <div className="land-bar">
        <div className="land-title">
          Portfolio — CAP plans by Program{' '}
          <span className="land-sub">
            · grouped by Program, most deficit first
            {nPri ? (
              <>
                {' '}
                · <b style={{ color: 'var(--neg)' }}>{nPri} need attention</b>
              </>
            ) : null}
          </span>
        </div>
        <CompactSummary plans={plans} />
      </div>

      {queuedPackages.length ? (
        <div className="execbar">
          <div className="eb-l">
            <span className="eb-ic">🚀</span>
            <div className="eb-tx">
              <b>
                {queuedPackages.length} approved action(s) across{' '}
                {new Set(queuedPackages.map((p) => p.cap_id)).size} plan(s)
              </b>{' '}
              ready to execute in one go
              {execChips.length ? (
                <div className="eb-chips">
                  {execChips.map((c) => (
                    <span key={c.label} className="eb-chip">
                      {c.ic} {c.n} {c.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <button type="button" className="btn btn-dark eb-btn" onClick={onExecPortfolio}>
            Review &amp; execute all →
          </button>
        </div>
      ) : null}

      <div className="filters">
        <select value={region} onChange={(e) => onFilterChange?.({ region: e.target.value })}>
          <option value="">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={vertical} onChange={(e) => onFilterChange?.({ vertical: e.target.value })}>
          <option value="">All verticals</option>
          {verticals.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => onFilterChange?.({ status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="critical">Critical</option>
          <option value="under">Understaffed</option>
          <option value="balanced">Balanced</option>
          <option value="surplus">Surplus</option>
        </select>
        <input
          placeholder="Search plan / planner / site…"
          value={search}
          onChange={(e) => onFilterChange?.({ search: e.target.value })}
        />
        <span className="fx">
          Showing {filtered.length} of {plans.length}
        </span>
      </div>

      <div className="card in land-table-card">
        <table className="ptable">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>CAP Plan</th>
              <th>Avg FTE O/U · 12wk</th>
              <th>Next 12 wks (▮ under / ▮ over)</th>
              <th>Status</th>
              <th style={{ textAlign: 'left' }}>Recommendation</th>
              <th />
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
                  <tr className={`grouphdr ${col ? 'col' : ''}`} onClick={() => toggleGroup(g.name)}>
                    <td colSpan={6}>
                      <span className="gh-caret">▶</span>
                      <span className="gh-name">{g.name}</span>
                      <span className="gh-meta">
                        {g.plans.length} plan{g.plans.length === 1 ? '' : 's'}
                        {under ? (
                          <>
                            {' '}
                            · <b className="neg">{under} need attention</b>
                          </>
                        ) : null}{' '}
                        · net 12-wk O/U{' '}
                        <b className={netg < 0 ? 'neg' : 'pos'}>
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
                            <tr className={`prow gchild ${ex ? 'exp' : ''}`} onClick={() => togglePlan(p.capId)}>
                              <td>
                                <div className={`pname ${ex ? 'exp' : ''}`}>
                                  <span className="caret">▶</span>
                                  <span className="capchip">{p.capId}</span>
                                  <span>{p.plan}</span>
                                  {rosterBad(p) ? <span className="rflag">⚑ roster</span> : null}
                                </div>
                                <div className="pmeta">{subcrumb}</div>
                              </td>
                              <td className={`mono ${p.sustained < 0 ? 'neg' : 'pos'}`} style={{ fontWeight: 800 }}>
                                {p.sustained >= 0 ? '+' : ''}
                                {f2(p.sustained)}
                              </td>
                              <td>
                                <WeekBar plan={p} />
                              </td>
                              <td>
                                <span className={`stchip ${st}`}>{STATUS_LABELS[st] || st}</span>
                              </td>
                              <td style={{ textAlign: 'left' }}>
                                <span className={`recchip ${rc.cls}`}>{rc.t}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="openbtn"
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
                              <tr className="detail">
                                <td colSpan={6}>
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
        <div className="insight info" style={{ marginTop: 12 }}>
          <div className="ico">i</div>
          <div className="tx">
            <b>No plans match</b> — try clearing search or changing filters
          </div>
        </div>
      ) : null}
    </div>
  );
}
