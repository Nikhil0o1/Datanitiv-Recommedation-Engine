import { useEffect, useMemo, useState } from 'react';
import SeriesChart, { DecisionBar, SparkMini } from '../SeriesChart';
import { f2 } from '../../utils/format';
import { planCrumb } from '../../utils/forecastLogic';
import { segmentShrinkage, shrRec } from '../../utils/planLogic';
import {
  shrinkActual8,
  shrinkPlanned8,
  shrinkRecChip,
  shrinkTrend16,
  shrinkVariancePt,
  shrInsightCls,
} from '../../utils/shrinkageLogic';

function ShrRecCard({ rec, decision, onAccept, onModify, onReject }) {
  const insightCls = shrInsightCls(rec.dir);
  const tgt =
    rec.dir !== 'ok'
      ? ` Recommended: set plan shrinkage to ~${f2(rec.actAvg)}% for the forward weeks.`
      : '';

  return (
    <div className="reccard">
      <div className={`insight ${insightCls}`} style={{ margin: '0 0 8px' }}>
        <div className="ico">{rec.dir === 'ok' ? '✓' : '!'}</div>
        <div className="tx">
          <b>Recommendation:</b> {rec.t}.{tgt}
          <small style={{ display: 'block', marginTop: 4 }}>
            Recent 8-wk actual avg {f2(rec.actAvg)}% vs planned {f2(rec.plan)}% over next 12 wk.
          </small>
        </div>
      </div>
      <DecisionBar decision={decision} onAccept={onAccept} onModify={onModify} onReject={onReject} />
    </div>
  );
}

/** Shrinkage step — matches planning_copilot_v4_19.html sSHR() in focused plan mode. */
export default function PlanShrinkageTrend({
  plan,
  state,
  onEditorChange,
  onSubmitShrinkage,
  onResetShrinkage,
  decisions,
  onDecide,
}) {
  const [showSeg, setShowSeg] = useState(false);

  useEffect(() => {
    setShowSeg(false);
  }, [plan?.capId]);

  const editorWeeks = state?.editorWeeks || [];
  const dragUntilIdx = editorWeeks.length ? Math.max(...editorWeeks.map((w) => w.weekIdx)) : plan.curIdx;

  const displayLine = useMemo(() => {
    const line = (plan.sShrinkPlan || []).map((v, i) => (i < plan.curIdx ? null : v));
    editorWeeks.forEach((ew) => {
      if (ew?.weekIdx != null && ew.weekIdx >= plan.curIdx) line[ew.weekIdx] = ew.cur;
    });
    return line;
  }, [plan.sShrinkPlan, editorWeeks, plan.curIdx]);

  const past = (plan.sShrink || []).map((v, i) => (i <= plan.curIdx ? v : null));
  const fwdVals = displayLine.slice(plan.curIdx, plan.curIdx + 12).filter((v) => v != null);
  const planFwd = fwdVals.length ? fwdVals.reduce((a, b) => a + b, 0) / fwdVals.length : plan.shrink12 || 0;
  const rec = shrRec(plan, planFwd);
  const actual8 = shrinkActual8(plan);
  const planned8 = shrinkPlanned8(plan);
  const variancePt = shrinkVariancePt(planned8, actual8);
  const recChip = shrinkRecChip(rec);
  const trend = shrinkTrend16(plan);
  const decision = decisions?.shr;
  const segs = useMemo(() => segmentShrinkage(plan), [plan]);

  const applyDrag = (weekIdx, value) => {
    const editorIdx = editorWeeks.findIndex((w) => w.weekIdx === weekIdx);
    if (editorIdx < 0) return;
    onEditorChange?.(editorIdx, value, true);
    onDecide?.('shr', null, 'mod');
  };

  const fwdSlice = (arr) => (arr || []).slice(plan.curIdx, plan.curIdx + 12);

  return (
    <div className="land-v4">
      <div className="card land-table-card in">
        <table className="ptable shr-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Avg actual · 8wk</th>
              <th>Planned · 8wk</th>
              <th>Variance</th>
              <th>Trend (16 wk)</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            <tr className="prow exp shr-summary-row">
              <td>
                <div className="pname exp">
                  <span className="caret">▶</span>
                  <span className="capchip">{plan.capId}</span>
                  <span>{plan.plan}</span>
                </div>
                <div className="pmeta">{planCrumb(plan)}</div>
              </td>
              <td className="mono">{f2(actual8)}%</td>
              <td className="mono">{f2(planned8)}%</td>
              <td className={`mono ${variancePt < 0 ? 'pos' : variancePt > 0 ? 'neg' : ''}`}>
                {variancePt > 0 ? '+' : ''}
                {f2(variancePt)}pt
              </td>
              <td className="shr-spark-cell">
                <SparkMini
                  values={trend.values}
                  weeks={trend.weeks}
                  markIdx={trend.markIdx}
                  color="#2a78d6"
                  unit="%"
                  format={f2}
                />
              </td>
              <td>
                <span className={recChip.chip}>{recChip.text}</span>
              </td>
            </tr>
            <tr className="detail">
              <td colSpan={6}>
                <div className="detail-inner shr-detail-inner">
                  <div className="shr-detail-head">
                    <div className="slabel" style={{ margin: 0 }}>
                      Shrinkage trend · {plan.plan}{' '}
                      <span
                        style={{
                          textTransform: 'none',
                          letterSpacing: 0,
                          fontWeight: 500,
                          color: 'var(--ink-3)',
                        }}
                      >
                        — drag plan points to adjust
                      </span>
                    </div>
                    <div className="shr-detail-actions">
                      <button
                        type="button"
                        className="btn-adjust"
                        data-act="shr-segment"
                        onClick={() => setShowSeg((v) => !v)}
                      >
                        {showSeg ? 'Hide segment trends' : '📄 Segment trends'}
                      </button>
                    </div>
                  </div>

                  <ShrRecCard
                    rec={rec}
                    decision={decision}
                    onAccept={() => {
                      const target = rec.actAvg;
                      editorWeeks.forEach((_, k) => onEditorChange?.(k, target, true));
                      onDecide?.('shr', null, 'acc');
                    }}
                    onModify={() => onDecide?.('shr', null, 'mod')}
                    onReject={() => onDecide?.('shr', null, 'rej')}
                  />

                  {showSeg ? (
                    <div className="seg-panel" data-act="shr-seg-panel">
                      <div className="slabel" style={{ marginTop: 0 }}>
                        Planned vs unplanned · next 12 wk · 55/45 split of Total
                      </div>
                      <div className="chartbox fw-dual-chartbox">
                        <SeriesChart
                          weeks={plan.weeks.slice(plan.curIdx, plan.curIdx + 12)}
                          curIdx={0}
                          markThisWeek={false}
                          height={160}
                          flush
                          responsive
                          yFmt={(v) => `${f2(v)}%`}
                          bars={[
                            { label: 'Planned', data: fwdSlice(segs.planned), color: '#2a78d6' },
                            { label: 'Unplanned', data: fwdSlice(segs.unplanned), color: '#e0483f' },
                          ]}
                        />
                      </div>
                      <div className="slabel">By category (share of total)</div>
                      <div className="seg-grid">
                        {segs.cats.map((cat) => {
                          const vals = fwdSlice(segs.byCat[cat]);
                          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                          return (
                            <div key={cat} className="seg-card">
                              <b>
                                {cat} · {f2(avg)}%
                              </b>
                              <span>{Math.round((segs.weights[cat] || 0) * 100)}% of live total</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="chartbox fw-dual-chartbox">
                    <SeriesChart
                      weeks={plan.weeks}
                      curIdx={plan.curIdx}
                      height={200}
                      flush
                      responsive
                      chartTheme="v4"
                      fixedYScale={{ min: 0, max: 35, step: 5 }}
                      xTickStep={2}
                      thinBars={false}
                      barRadius={2}
                      barRatio={0.62}
                      hideDragHint
                      yFmt={(v) => `${Math.round(v)}%`}
                      tipFmt={(v) => `${f2(v)}%`}
                      bars={[{ label: 'Actual shrinkage', data: past, color: '#3b82f6' }]}
                      line={{ label: 'Plan shrinkage', data: displayLine, color: '#d69ea8' }}
                      dragFromIdx={plan.curIdx}
                      dragUntilIdx={dragUntilIdx}
                      snap={0.5}
                      minV={0}
                      maxV={35}
                      onDragPoint={applyDrag}
                    />
                  </div>

                  <div className="imp shr-dragnote">
                    <div className="dragnote">
                      ↕ <b>Drag</b> the plan-shrinkage (mauve) point for any future week (snaps to 0.5pt steps).
                      FTE required &amp; Over/Under recalculate live.
                    </div>
                  </div>

                  {state?.shrDirty ? (
                    <div className="shr-submit-row">
                      <button type="button" className="btn-submit" data-act="go-shrink" onClick={() => onSubmitShrinkage?.()}>
                        ⬆ Submit to plan
                      </button>
                      <button type="button" className="btn-reset" data-act="shr-reset" onClick={() => onResetShrinkage?.()}>
                        ↺ Reset
                      </button>
                    </div>
                  ) : null}

                  <div className={`done${state?.doneShr ? ' on' : ''}`}>
                    <span>✓</span>
                    <span>Forward weeks submitted · requirement recalculated across {editorWeeks.length} weeks</span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
