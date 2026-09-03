import { useMemo } from 'react';
import { SparkMini } from '../SeriesChart';
import { f2 } from '../../utils/format';
import { shrRec, statusOf } from '../../utils/planLogic';
import { portfolioRecChip, rosterBad, STATUS_LABELS } from '../../utils/portfolioRec';

const REC_CHIP = {
  pos: 'border-[#bce6d3] bg-[#e9f7f0] text-[#137a53]',
  neg: 'border-[#f6cbc7] bg-neg-bg text-neg',
  mut: 'border-line bg-surface-2 text-ink-2',
};

function MStat({ label, value, tone = '' }) {
  const toneCls = tone === 'neg' ? 'text-neg' : tone === 'pos' ? 'text-pos' : 'text-ink';
  return (
    <span className="inline-flex flex-col gap-px">
      <i className="text-[10px] font-bold uppercase not-italic tracking-wide text-ink-3">{label}</i>
      <b className={`text-[14.5px] font-bold tabular-nums ${toneCls}`}>{value}</b>
    </span>
  );
}

function QuickActions({ acceptOn, rejectOn, adjustOn, decision }) {
  const btn = (kind, onClick, title, child) => (
    <button
      type="button"
      title={title}
      className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-xs font-extrabold text-ink-2 transition-colors ${
        kind === 'acc' && decision === 'acc'
          ? 'border-pos bg-pos text-white'
          : kind === 'rej' && decision === 'rej'
            ? 'border-neg bg-neg text-white'
            : kind === 'adj'
              ? 'hover:border-[#f6e2b8] hover:bg-brand-050 hover:text-brand-600'
              : 'hover:border-ink-3'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {child}
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      {btn('acc', acceptOn, 'Accept', '✓')}
      {btn('rej', rejectOn, 'Reject', '✕')}
      {btn('adj', adjustOn, 'Adjust / open', '✎')}
    </div>
  );
}

function SecRow({ icon, iconBg, label, metrics, actions, onOpen }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex cursor-pointer items-center gap-3.5 rounded-[13px] border border-line bg-surface px-4 py-3 transition-all hover:border-[#e0c98f] hover:bg-surface-2 hover:shadow-sm"
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
    >
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-lg"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-ink">{label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-4">{metrics}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()} role="presentation">
        {actions}
        <button
          type="button"
          title={`Open ${label}`}
          className="ml-1 flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[9px] border border-line bg-surface text-base font-extrabold text-brand-600 transition-colors hover:border-brand hover:bg-brand hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

function planCrumb(plan) {
  return [plan.lob, plan.subLob, plan.site || plan.country].filter(Boolean).join(' › ') || plan.program || '—';
}

function classRef(plan) {
  const cls = plan.cls;
  if (!cls) return '—';
  return cls.name || cls.className || `TC_2026_${String(plan.capId || '').replace(/\D/g, '')}`;
}

function rosterChip(cls) {
  if (!cls) return null;
  const st = String(cls.status || 'missing').toLowerCase();
  if (st === 'uploaded') {
    return <span className="rounded-full bg-[#e2f5ec] px-2 py-0.5 text-[11px] font-bold text-pos">✓ uploaded</span>;
  }
  if (st === 'partial') {
    return <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-bold text-warn">◑ partial</span>;
  }
  return <span className="rounded-full bg-neg-bg px-2 py-0.5 text-[11px] font-bold text-neg">✕ not uploaded</span>;
}

function countQueued(packages, capId) {
  return packages.filter((p) => p.cap_id === capId && p.status !== 'rejected' && !p.done).length;
}

export default function PlanFocusedOverview({
  plan,
  packages = [],
  allPackages = [],
  gotBy = {},
  recsByCap = {},
  decisions = {},
  onGoStep,
  onDecide,
  onAcceptRec,
  onRejectRec,
}) {
  const c = plan.hcCur || {};
  const l = plan.hcLast || {};
  const net = (Number(c.closing) || 0) - (Number(c.opening) || 0);
  const curIdx = plan.curIdx ?? 0;

  const shPast = (plan.sShrink || [])
    .slice(Math.max(0, curIdx - 8), curIdx + 1)
    .filter((v) => v != null);
  const shAvg = shPast.length ? shPast.reduce((a, b) => a + b, 0) / shPast.length : 0;
  const shPlan = plan.sShrinkPlan?.[curIdx] ?? plan.shrink12 ?? 0;
  const shVar = shPlan - shAvg;

  const atPast = (plan.sAttr || [])
    .slice(Math.max(0, curIdx - 8), curIdx + 1)
    .filter((v) => v != null);
  const atAvg = atPast.length ? atPast.reduce((a, b) => a + b, 0) / atPast.length : 0;
  const atPlan = plan.sAttrPlan?.[curIdx] ?? plan.attr12 ?? 0;
  const atVar = atPlan - atAvg;

  const sr = shrRec(plan);
  const rc = portfolioRecChip(plan, recsByCap, gotBy);
  const st = statusOf(plan);
  const nPlan = countQueued(packages, plan.capId);
  const nPort = allPackages.filter((p) => p.status !== 'rejected' && !p.done).length;

  const ou = plan.ou ?? plan.sOU?.[curIdx] ?? 0;
  const sustained = plan.sustained ?? 0;

  const shChipCls =
    sr.dir === 'up' ? 'border-[#f6cbc7] bg-neg-bg text-neg' : sr.dir === 'down' ? 'border-[#bce6d3] bg-[#e9f7f0] text-pos' : 'border-line bg-surface-2 text-ink-2';
  const shChipTxt =
    sr.dir === 'up' ? `▲ Raise ${f2(Math.abs(sr.gap))}pt` : sr.dir === 'down' ? `▼ Lower ${f2(Math.abs(sr.gap))}pt` : '✓ Hold';

  const planQueued = useMemo(
    () => packages.filter((p) => p.cap_id === plan.capId && p.status !== 'rejected' && !p.done),
    [packages, plan.capId],
  );

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-[#f6e2b8] bg-gradient-to-r from-brand-050 to-white px-[18px] py-3.5">
        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-2 text-base">
            <span className="rounded-[5px] border border-[#f6e2b8] bg-brand-050 px-1.5 py-px font-mono text-[11px] font-bold tracking-wide text-brand-600">
              {plan.capId}
            </span>
            <b className="font-bold text-ink">{plan.plan}</b>
            <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2.5 py-0.5 text-[11px] font-bold text-warn">
              {STATUS_LABELS[st] || st}
            </span>
            {rosterBad(plan) ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-neg-bg px-1.5 py-0.5 text-[10.5px] font-bold text-neg">
                ⚑ roster
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[11.5px] text-ink-3">
            {planCrumb(plan)} · Planner {plan.planner || '—'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <MStat label="Req" value={f2(plan.req)} />
          <MStat label="Proj" value={f2(plan.proj)} />
          <MStat label="O/U now" value={`${ou >= 0 ? '+' : ''}${f2(ou)}`} tone={ou < 0 ? 'neg' : 'pos'} />
          <MStat label="12-wk avg" value={`${sustained >= 0 ? '+' : ''}${f2(sustained)}`} tone={sustained < 0 ? 'neg' : 'pos'} />
          <span className="inline-flex flex-col gap-1">
            <i className="text-[10px] font-bold uppercase not-italic tracking-wide text-ink-3">12-wk trend</i>
            <SparkMini
              values={plan.sOU || []}
              weeks={plan.weeks || []}
              color={sustained < 0 ? '#e0483f' : '#1a9e6a'}
              width={120}
              height={30}
              markIdx={curIdx}
              unit="FTE"
              format={f2}
            />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <SecRow
          icon="👥"
          iconBg="#eef2ff"
          label="Headcount"
          onOpen={() => onGoStep?.('hc')}
          metrics={
            <>
              <MStat label="Close · last" value={f2(l.closing)} />
              <MStat label="Open · this" value={f2(c.opening)} />
              <MStat label="Close · this" value={f2(c.closing)} />
              <MStat label="Net Δ" value={`${net >= 0 ? '+' : ''}${f2(net)}`} tone={net < 0 ? 'neg' : 'pos'} />
              <MStat label="Attr" value={f2(c.attr)} />
            </>
          }
          actions={null}
        />

        <SecRow
          icon="🎓"
          iconBg="#fff4e0"
          label="New Hire"
          onOpen={() => onGoStep?.('nh')}
          metrics={
            plan.cls ? (
              <>
                <MStat label="Class ref" value={classRef(plan)} />
                <MStat label="Start" value={plan.cls.date || '—'} />
                <MStat label="Plan HC" value={f2(plan.cls.plan)} />
                <span className="inline-flex flex-col gap-px">
                  <i className="text-[10px] font-bold uppercase not-italic tracking-wide text-ink-3">Roster</i>
                  {rosterChip(plan.cls)}
                </span>
              </>
            ) : (
              <span className="text-[13px] text-ink-3">No class in the ±6-week window</span>
            )
          }
          actions={
            plan.cls && String(plan.cls.status || '').toLowerCase() !== 'uploaded' ? (
              <button
                type="button"
                title="Upload roster"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface text-xs font-extrabold hover:border-[#f6e2b8] hover:bg-brand-050 hover:text-brand-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onGoStep?.('nh');
                }}
              >
                ⬆
              </button>
            ) : null
          }
        />

        <SecRow
          icon="📉"
          iconBg="#eaf2fc"
          label="Shrinkage"
          onOpen={() => onGoStep?.('shr')}
          metrics={
            <>
              <MStat label="Actual · 8wk" value={`${f2(shAvg)}%`} />
              <MStat label="Planned" value={`${f2(shPlan)}%`} />
              <MStat label="Variance" value={`${shVar >= 0 ? '+' : ''}${f2(shVar)}pt`} tone={shVar < 0 ? 'pos' : 'neg'} />
              <span className={`inline-block rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${shChipCls}`}>{shChipTxt}</span>
            </>
          }
          actions={
            <QuickActions
              decision={decisions.shr}
              acceptOn={() => onDecide?.('shr', null, 'acc')}
              rejectOn={() => onDecide?.('shr', null, 'rej')}
              adjustOn={() => onGoStep?.('shr')}
            />
          }
        />

        <SecRow
          icon="📊"
          iconBg="#fdeee6"
          label="Attrition"
          onOpen={() => onGoStep?.('att')}
          metrics={
            <>
              <MStat label="Actual · 8wk" value={`${f2(atAvg)}%`} />
              <MStat label="Planned" value={`${f2(atPlan)}%`} />
              <MStat label="Variance" value={`${atVar >= 0 ? '+' : ''}${f2(atVar)}pt`} tone={atVar <= 0 ? 'pos' : 'neg'} />
              <span className="inline-block rounded-lg border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                {atVar <= 0 ? '✓ On/below plan' : '▲ Watch'}
              </span>
            </>
          }
          actions={null}
        />

        {plan.isVol ? (
          <SecRow
            icon="📈"
            iconBg="#e9f7f0"
            label="Forecast & AHT"
            onOpen={() => onGoStep?.('fw')}
            metrics={
              <>
                <MStat label="Fcst bias" value={plan.fBias == null ? '—' : `${plan.fBias > 0 ? '+' : ''}${f2(plan.fBias)}%`} />
                <MStat label="AHT bias" value={plan.aBias == null ? '—' : `${plan.aBias > 0 ? '+' : ''}${f2(plan.aBias)}%`} />
              </>
            }
            actions={null}
          />
        ) : null}

        <SecRow
          icon="⚡"
          iconBg="#fff1de"
          label="Staffing Recommendation"
          onOpen={() => onGoStep?.('rec')}
          metrics={
            <span className={`inline-block rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${REC_CHIP[rc.cls] || REC_CHIP.mut}`}>
              {rc.t}
            </span>
          }
          actions={
            <QuickActions
              decision={decisions.rec}
              acceptOn={() => onAcceptRec?.()}
              rejectOn={() => onRejectRec?.()}
              adjustOn={() => onGoStep?.('rec')}
            />
          }
        />

        <SecRow
          icon="🚀"
          iconBg="#ececff"
          label="Review & execute"
          onOpen={() => onGoStep?.('exe')}
          metrics={
            <>
              <MStat label="Queued · this plan" value={String(nPlan)} tone={nPlan ? 'pos' : ''} />
              <MStat label="Queued · portfolio" value={String(nPort)} />
              {nPlan ? (
                <span className="text-[11px] text-ink-2">
                  {planQueued.map((p) => p.description || p.package_type || 'action').join(', ')}
                </span>
              ) : (
                <span className="text-xs text-ink-3">Accept a recommendation above to queue it</span>
              )}
            </>
          }
          actions={null}
        />
      </div>
    </div>
  );
}
