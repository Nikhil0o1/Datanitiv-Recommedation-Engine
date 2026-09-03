import { useMemo } from 'react';
import SeriesChart, { SparkMini } from '../SeriesChart';
import { f2 } from '../../utils/format';
import { planCrumb } from '../../utils/forecastLogic';
import {
  attrActual8,
  attrActualBars,
  attrChartScale,
  attrPlanBars,
  attrPlanned8,
  attrTrend16,
  attrVariancePt,
  attrYFmt,
} from '../../utils/attritionLogic';

/** Attrition step — matches planning_copilot_v4_19.html sATT() in focused plan mode. */
export default function PlanAttritionTrend({
  plan,
  state,
  onEditorChange,
  onSubmitAttrition,
  onResetAttrition,
  onDecide,
}) {
  const attrWeeks = state?.attrWeeks || [];
  const dragUntilIdx = attrWeeks.length ? Math.max(...attrWeeks.map((w) => w.weekIdx)) : plan.curIdx;

  const displayPlan = useMemo(() => {
    const fwd = (plan.sAttrPlan || []).map((v, i) => (i < plan.curIdx ? null : v));
    attrWeeks.forEach((ew) => {
      if (ew?.weekIdx != null && ew.weekIdx >= plan.curIdx) fwd[ew.weekIdx] = ew.cur;
    });
    return fwd;
  }, [plan.sAttrPlan, attrWeeks, plan.curIdx]);

  const actual = useMemo(() => attrActualBars(plan), [plan]);
  const planBars = useMemo(() => attrPlanBars(displayPlan, plan.curIdx), [displayPlan, plan.curIdx]);
  const actual8 = attrActual8(plan);
  const planned8 = attrPlanned8(plan, displayPlan);
  const variancePt = attrVariancePt(planned8, actual8);
  const trend = attrTrend16(plan, displayPlan);
  const yScale = useMemo(() => attrChartScale(plan, displayPlan, planned8), [plan, displayPlan, planned8]);

  const applyDrag = (weekIdx, value) => {
    const editorIdx = attrWeeks.findIndex((w) => w.weekIdx === weekIdx);
    if (editorIdx < 0) return;
    onEditorChange?.(editorIdx, value);
    onDecide?.('att', null, 'mod');
  };

  return (
    <div className="land-v4">
      <div className="card land-table-card in">
        <table className="ptable att-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Avg actual · 8wk</th>
              <th>Planned · 8wk</th>
              <th>Variance</th>
              <th>Trend (16 wk)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="prow exp att-summary-row">
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
              <td className={`mono ${variancePt > 0 ? 'neg' : variancePt < 0 ? 'pos' : ''}`}>
                {variancePt > 0 ? '+' : ''}
                {f2(variancePt)}pt
              </td>
              <td className="att-spark-cell">
                <SparkMini
                  values={trend.values}
                  weeks={trend.weeks}
                  markIdx={trend.markIdx}
                  color="#3b82f6"
                  unit="%"
                  format={f2}
                />
              </td>
            </tr>
            <tr className="detail">
              <td colSpan={5}>
                <div className="detail-inner att-detail-inner">
                  <div className="att-detail-head">
                    <div className="slabel" style={{ margin: 0 }}>
                      Attrition trend · {plan.plan}{' '}
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
                  </div>

                  <div className="chartbox att-chartbox">
                    <SeriesChart
                      weeks={plan.weeks}
                      curIdx={plan.curIdx}
                      height={200}
                      flush
                      responsive
                      chartTheme="v4"
                      fixedYScale={yScale}
                      xTickStep={2}
                      thinBars={false}
                      barRadius={2}
                      barRatio={0.62}
                      hideDragHint
                      guideLine={planned8 > 0 ? { value: planned8, color: '#2b2f36', dash: '5 4' } : null}
                      yFmt={(v) => attrYFmt(v, yScale.step)}
                      tipFmt={(v) => `${f2(v)}%`}
                      bars={[
                        { label: 'Actual attrition', data: actual, color: '#3b82f6' },
                        { label: 'Plan attrition', data: planBars, color: '#d69ea8' },
                      ]}
                      line={{
                        data: displayPlan,
                        color: '#d69ea8',
                        hidePath: true,
                        showLegend: false,
                      }}
                      dragFromIdx={plan.curIdx}
                      dragUntilIdx={dragUntilIdx}
                      snap={0.1}
                      minV={0}
                      maxV={40}
                      onDragPoint={applyDrag}
                    />
                  </div>

                  {state?.attrDirty ? (
                    <div className="att-submit-row">
                      <button
                        type="button"
                        className="btn-submit"
                        data-act="att-submit"
                        onClick={() => onSubmitAttrition?.()}
                      >
                        ⬆ Submit to plan
                      </button>
                      <button type="button" className="btn-reset" data-act="att-reset" onClick={() => onResetAttrition?.()}>
                        ↺ Reset
                      </button>
                    </div>
                  ) : null}

                  <div className={`done${state?.doneAttr ? ' on' : ''}`}>
                    <span>✓</span>
                    <span>Forward weeks submitted · projected FTE and O/U recalculated</span>
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
