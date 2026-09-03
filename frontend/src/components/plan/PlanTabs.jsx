import { useEffect, useMemo, useRef, useState } from 'react';
import { f2 } from '../../utils/format';
import {
  computeXutil,
  defaultOtWeekly,
  fwdCount,
  applyLiveShrinkage,
  applyLiveAttrition,
  kpiTrends,
  ouColor,
  planRec,
  planRecWithWeekly,
  recBaseline,
  recBenefitSummary,
  statusOf,
  weeks12,
} from '../../utils/planLogic';

import PlanFocusedOverview from './PlanFocusedOverview';
import PlanForecastWorkload from './PlanForecastWorkload';
import PlanHeadcountSnapshot from './PlanHeadcountSnapshot';
import PlanNewHireOnboarding from './PlanNewHireOnboarding';
import PlanShrinkageTrend from './PlanShrinkageTrend';
import PlanAttritionTrend from './PlanAttritionTrend';

const TAB_LABELS = {
  ov: 'Overview',
  fw: 'Forecast',
  hc: 'Headcount',
  nh: 'New Hire',
  shr: 'Shrinkage',
  att: 'Attrition',
  rec: 'Recommend',
  exe: 'Execute',
};

export { TAB_LABELS };

export function tabsForPlan(plan) {
  if (!plan) return Object.keys(TAB_LABELS).filter((k) => k !== 'fw');
  return plan.isVol ? Object.keys(TAB_LABELS) : Object.keys(TAB_LABELS).filter((k) => k !== 'fw');
}

function OverviewTab({
  plan,
  packages,
  allPackages,
  gotBy,
  recsByCap,
  decisions,
  onGoStep,
  onDecide,
  onAcceptRec,
  onRejectRec,
}) {
  return (
    <PlanFocusedOverview
      plan={plan}
      packages={packages}
      allPackages={allPackages}
      gotBy={gotBy}
      recsByCap={recsByCap}
      decisions={decisions}
      onGoStep={onGoStep}
      onDecide={onDecide}
      onAcceptRec={onAcceptRec}
      onRejectRec={onRejectRec}
    />
  );
}

function RecDiffRow({ label, before, after, unit = '', decimals = 2, emphasize = false }) {
  const fmt = (v) => (decimals === 0 ? String(Math.round(Number(v) || 0)) : f2(v));
  const bNum = Number(before) || 0;
  const aNum = Number(after) || 0;
  const changed = Math.abs(bNum - aNum) > (decimals === 0 ? 0.5 : 0.01);
  return (
    <div className={`rec-diff-row ${changed ? 'changed' : ''} ${emphasize ? 'emph' : ''}`}>
      <span className="rec-diff-label">{label}</span>
      <span className="rec-diff-before">{changed ? `${fmt(bNum)}${unit}` : '—'}</span>
      <span className="rec-diff-arrow" aria-hidden>
        →
      </span>
      <span className="rec-diff-after">{`${fmt(aNum)}${unit}`}</span>
    </div>
  );
}

function RecommendTab({
  plan,
  doneRoster,
  doneRec,
  onAccept,
  onReject,
  decisions,
  otWeeks,
  onOtWeekChange,
  gotBy,
  onRecOverride,
}) {
  const st = statusOf(plan);
  const w = weeks12(plan);
  const [showMod, setShowMod] = useState(false);
  const ovr = decisions?.recOvr || {};
  const decision = decisions?.rec;
  const n = fwdCount(plan);
  const baseline = recBaseline(plan);
  const rec = planRecWithWeekly(
    plan,
    {
      otPct: ovr.otPct ?? 5,
      xr: ovr.xr,
      starts: ovr.starts,
      trainWk: ovr.trainWk,
      nestWk: ovr.nestWk,
      gotBy,
    },
    otWeeks?.length === n ? otWeeks : null,
  );
  const weekly = otWeeks?.length === n ? otWeeks : Array(n).fill(defaultOtWeekly(plan, rec.otPct));
  const otTotal = weekly.reduce((a, b) => a + (Number(b) || 0), 0);
  const labels = plan.weeks.slice(plan.curIdx, plan.curIdx + n);
  const benefit = recBenefitSummary(plan, rec, baseline);
  const dismissed = decision === 'rej';

  let body;
  if (st === 'under' || st === 'critical') {
    body = (
      <>
        <div className="rec-diff-head">
          <span className="rec-diff-col">Current</span>
          <span className="rec-diff-col rec-diff-col-after">Recommended</span>
        </div>
        <div className="rec-diff">
          <RecDiffRow label="12-wk staffing gap" before={baseline.gap} after={rec.residual} unit=" FTE" emphasize />
          <RecDiffRow
            label="OT (avg weekly)"
            before={baseline.otHrs}
            after={rec.otHrs}
            unit=" hrs/wk"
          />
          <RecDiffRow label="OT capacity" before={baseline.otFTE} after={rec.otFTE} unit=" FTE" />
          <RecDiffRow label="Cross-util in" before={baseline.xr} after={rec.xr} unit=" FTE" />
          <RecDiffRow
            label="New hire starts"
            before={baseline.starts}
            after={rec.starts}
            unit=""
            decimals={0}
          />
          {rec.starts > 0 ? (
            <div className="rec-diff-note">
              Hires productive in <b>+{rec.productiveIn} wk</b> (train {rec.trainWk} + nest {rec.nestWk})
            </div>
          ) : null}
        </div>
        <div className="insight info rec-benefit">
          <b>Why accept:</b> {benefit}
        </div>
        {showMod ? (
          <div className="rec-mod-panel" data-act="rec-mod-panel">
            <div className="slabel">Adjust package levers</div>
            <div className="rec-mod">
              <label>
                OT %
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={ovr.otPct ?? 5}
                  onChange={(e) => {
                    const pct = parseFloat(e.target.value) || 0;
                    onRecOverride?.({ otPct: pct });
                    const hrs = defaultOtWeekly(plan, pct);
                    for (let i = 0; i < n; i += 1) onOtWeekChange?.(i, hrs);
                  }}
                />
              </label>
              <label>
                Cross-util FTE
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={ovr.xr ?? rec.xr}
                  onChange={(e) => onRecOverride?.({ xr: parseFloat(e.target.value) || 0 })}
                />
              </label>
              <label>
                Hire starts
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={ovr.starts ?? rec.starts}
                  onChange={(e) => onRecOverride?.({ starts: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
              <label>
                Train wk
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={ovr.trainWk ?? rec.trainWk}
                  onChange={(e) => onRecOverride?.({ trainWk: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
              <label>
                Nest wk
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={ovr.nestWk ?? rec.nestWk}
                  onChange={(e) => onRecOverride?.({ nestWk: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
            </div>
            <div className="slabel" style={{ marginTop: 10 }}>
              OT by week (hrs)
            </div>
            <div className="otgrid">
              {weekly.map((v, i) => (
                <label key={labels[i] || i} className="otwk">
                  <span>{labels[i]}</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={Number(v).toFixed(2)}
                    onChange={(e) => onOtWeekChange?.(i, parseFloat(e.target.value) || 0)}
                  />
                </label>
              ))}
            </div>
            <div className="dragnote">
              Total OT: <b>{f2(otTotal)} hrs</b> across {n} week(s) · avg{' '}
              <b>{f2(rec.otHrs)} hrs/wk</b> ({f2(rec.otPct)}% of avail)
            </div>
          </div>
        ) : null}
      </>
    );
  } else if (w.under >= 2) {
    const peak = Math.min(0, ...w.s);
    body = (
      <div className="insight warn">
        <b>
          {w.under} of 12 weeks are understaffed
        </b>{' '}
        (peak {f2(peak)} FTE) even though the 12-week average is {f2(plan.sustained)}. Cover short weeks with overtime /
        redistribution.
      </div>
    );
  } else if (st === 'surplus') {
    const lend = Math.max(0, plan.minOUfwd - 1);
    body = (
      <div className="insight pos">
        <b>Net surplus — donor.</b> Can lend up to <b>{f2(lend)} FTE</b> across the next {w.n} weeks (keeps ≥1 FTE buffer).
      </div>
    );
  } else {
    body = (
      <div className="insight pos">
        <b>No staffing action needed</b> — tracks requirement across the next {w.n} weeks.
      </div>
    );
  }

  const showDecide = (st === 'under' || st === 'critical' || w.under >= 2 || st === 'surplus') && !dismissed;

  if (dismissed && (st === 'under' || st === 'critical')) {
    return (
      <div className="tsec on" data-sec="rec">
        <div className="card in">
          <div className="ch">
            <b>Staffing recommendation</b>
            <span className="tag">dismissed</span>
          </div>
          <div className="insight warn">
            Recommendation dismissed for this cycle. Re-open by refreshing the plan or asking Vera to re-run staffing.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tsec on" data-sec="rec">
      <div className="card good in">
        <div className="ch">
          <b>Staffing recommendation</b>
          <span className="tag">OT → cross-util → hire</span>
        </div>
        {doneRoster ? <p style={{ fontSize: '.78rem', color: 'var(--dim)' }}>Roster mapped — gap adjusted before packaging.</p> : null}
        {body}
        {showDecide ? (
          <div className="acts" style={{ marginTop: 12 }}>
            <div className="btn p" data-act="go-accept" onClick={onAccept}>
              ✓ Accept &amp; add to execution
            </div>
            <div
              className="btn g"
              data-act="rec-mod"
              onClick={() => setShowMod((v) => !v)}
            >
              {showMod ? 'Hide modify' : '✎ Modify'}
            </div>
            <div className="btn g" data-act="rec-rej" onClick={onReject}>
              ✕ Dismiss
            </div>
          </div>
        ) : null}
        <div className={`done ${doneRec ? 'on' : ''}`} id="doneRec">
          <span>✓</span>
          <span>
            Package accepted · OT {f2(otTotal)} hrs ({f2(rec.otHrs)}/wk) · cross-util {f2(rec.xr)} · hire {rec.starts}
            {rec.starts > 0 ? ` (prod +${rec.productiveIn}wk)` : ''} · queued for Execute
          </span>
        </div>
      </div>
    </div>
  );
}

function ExecuteTab({ plan, doneRec, otWeeks, gotBy, decisions, onOpenQueue, onExecutePlan, execDone, execMsg }) {
  const ovr = decisions?.recOvr || {};
  const n = fwdCount(plan);
  const weekly = otWeeks?.length === n ? otWeeks : Array(n).fill(defaultOtWeekly(plan));
  const rec = planRecWithWeekly(
    plan,
    {
      otPct: ovr.otPct ?? 5,
      xr: ovr.xr,
      starts: ovr.starts,
      trainWk: ovr.trainWk,
      nestWk: ovr.nestWk,
      gotBy,
    },
    doneRec ? weekly : null,
  );
  const otTotal = doneRec ? weekly.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
  const [localMsg, setLocalMsg] = useState('');
  const [execBusy, setExecBusy] = useState(false);

  useEffect(() => {
    setLocalMsg('');
  }, [plan.capId]);

  const resultMsg = execMsg || localMsg;
  const resultOk = execDone || (resultMsg && /posted|applied|\+.*fte/i.test(resultMsg));

  return (
    <div className="tsec on" data-sec="exe">
      <div className="card in">
        <div className="ch">
          <b>Review &amp; execute</b>
          <span className="tag">post to CAP-ABILITY</span>
        </div>
        <div className="kpis">
          <div className="kpi">
            <b>{f2(otTotal)} hrs</b>
            <span>Overtime auth</span>
          </div>
          <div className="kpi">
            <b>{f2(doneRec ? rec.xr : 0)} FTE</b>
            <span>Cross-util / loans</span>
          </div>
          <div className="kpi">
            <b>{doneRec ? rec.starts : 0}</b>
            <span>New hire reqs</span>
          </div>
        </div>
        {!doneRec ? (
          <p>Accept a recommendation first, then tick packages in the portfolio queue — or execute this plan&apos;s package here.</p>
        ) : (
          <div className="insight info">
            <b>{plan.capId}</b> {plan.plan} · OT {f2(rec.otHrs)} hrs/wk ({f2(otTotal)} total) · cross-util +{f2(rec.xr)} · hire{' '}
            {rec.starts} · <span className="pos-t">accepted</span>
          </div>
        )}
        <div className="acts">
          <div className="btn p" data-view="queue" onClick={onOpenQueue}>
            Open action queue
          </div>
          <div
            className={`btn g ${execBusy ? 'busy' : ''}`}
            data-act="exec-sim"
            onClick={async () => {
              if (!doneRec) {
                setLocalMsg('No approved package yet — accept a recommendation first.');
                return;
              }
              setExecBusy(true);
              try {
                const res = await onExecutePlan?.();
                setLocalMsg(res?.message || 'Staffing applied to this CAP plan.');
              } finally {
                setExecBusy(false);
              }
            }}
          >
            {execBusy ? 'Executing…' : 'Execute → post to plan'}
          </div>
        </div>
        {resultMsg ? (
          <div className={`insight exec-result ${resultOk ? 'pos' : 'warn'}`} data-act="exec-result">
            <b>{resultOk ? 'Executed.' : 'Could not execute.'}</b> {resultMsg}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PlanTabs({
  activeTab,
  plan,
  state,
  allPlans = [],
  packages = [],
  recsByCap = {},
  decisions = {},
  otWeeks = [],
  onGoStep,
  onEditorChange,
  onSubmitShrinkage,
  onResetShrinkage,
  onApplyShrinkageValue,
  onApplyShrinkagePct,
  onSubmitAttrition,
  onResetAttrition,
  onApplyAttritionValue,
  onApplyAttritionPct,
  onAttritionChange,
  onSubmitForecast,
  onSaveHeadcount,
  onMapRoster,
  onAcceptRec,
  onRejectRec,
  onOpenQueue,
  onDecide,
  onOtWeekChange,
  onExecutePlan,
  onRecOverride,
}) {
  if (!plan) return null;

  const livePlan = applyLiveShrinkage(applyLiveAttrition(plan, state?.attrWeeks), state?.editorWeeks);
  const plansForXutil = (allPlans.length ? allPlans : [livePlan]).map((p) =>
    p.capId === livePlan.capId ? livePlan : p,
  );
  const gotBy = computeXutil(plansForXutil).gotBy;

  return (
    <>
      {activeTab === 'ov' && (
        <OverviewTab
          plan={livePlan}
          packages={packages}
          allPackages={packages}
          gotBy={gotBy}
          recsByCap={recsByCap}
          decisions={decisions}
          onGoStep={onGoStep}
          onDecide={onDecide}
          onAcceptRec={onAcceptRec}
          onRejectRec={onRejectRec}
        />
      )}
      {activeTab === 'fw' && (
        <PlanForecastWorkload
          plan={livePlan}
          decisions={decisions}
          onDecide={onDecide}
          onSubmitForecast={onSubmitForecast}
        />
      )}
      {activeTab === 'hc' && <PlanHeadcountSnapshot plan={livePlan} onSaveHeadcount={onSaveHeadcount} />}
      {activeTab === 'nh' && <PlanNewHireOnboarding plan={livePlan} onMapRoster={onMapRoster} />}
      {activeTab === 'shr' && (
        <PlanShrinkageTrend
          plan={livePlan}
          state={state}
          onEditorChange={onEditorChange}
          onSubmitShrinkage={onSubmitShrinkage}
          onResetShrinkage={onResetShrinkage}
          decisions={decisions}
          onDecide={onDecide}
        />
      )}
      {activeTab === 'att' && (
        <PlanAttritionTrend
          plan={livePlan}
          state={state}
          onEditorChange={onAttritionChange}
          onSubmitAttrition={onSubmitAttrition}
          onResetAttrition={onResetAttrition}
          onDecide={onDecide}
        />
      )}
      {activeTab === 'rec' && (
        <RecommendTab
          plan={livePlan}
          doneRoster={state.doneRoster}
          doneRec={state.doneRec}
          onAccept={onAcceptRec}
          onReject={onRejectRec}
          decisions={decisions}
          otWeeks={otWeeks}
          onOtWeekChange={onOtWeekChange}
          gotBy={gotBy}
          onRecOverride={onRecOverride}
        />
      )}
      {activeTab === 'exe' && (
        <ExecuteTab
          plan={livePlan}
          doneRec={state.doneRec}
          otWeeks={otWeeks}
          gotBy={gotBy}
          decisions={decisions}
          onOpenQueue={onOpenQueue}
          onExecutePlan={onExecutePlan}
          execDone={state.execDone}
          execMsg={state.execMsg}
        />
      )}
    </>
  );
}
