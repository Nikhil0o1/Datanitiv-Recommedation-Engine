import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import SeriesChart from '../SeriesChart';
import { f2 } from '../../utils/format';
import {
  ahtRecTxt,
  fwGet,
  fwHas,
  fwImpact,
  fwLastPct,
  fwOrig,
  fwRec,
  fwRecTarget,
  money,
  planCrumb,
  recChipCls,
  volRecTxt,
  volStep,
} from '../../utils/forecastLogic';

function DecBadge({ decision }) {
  if (decision === 'acc') return <span className="stchip surplus">✓ Accepted</span>;
  if (decision === 'mod') return <span className="stchip under">✎ Modified</span>;
  if (decision === 'rej') return <span className="stchip critical">✕ Rejected</span>;
  return null;
}

function RecCardFW({ plan, kind, decisions, onAccept, onReject }) {
  const rr = fwRec(plan);
  const v = kind === 'vol' ? rr.vol : rr.aht;
  const d = decisions?.[kind];
  const insightCls = v.d === 'up' ? 'warn' : v.d === 'down' ? 'info' : v.d === 'ok' ? 'pos' : '';
  const t = fwRecTarget(plan, kind);
  const lab = kind === 'vol' ? 'forecast' : 'AHT goal';
  const unit = kind === 'vol' ? '' : 's';
  const tgt =
    t && v.d !== 'ok'
      ? ` <b>Recommended:</b> set ${lab} to ~${kind === 'vol' ? money(t.cur) : f2(t.cur)}${unit} for the forward weeks.`
      : '';

  if (v.d === 'none') {
    return (
      <div className="reccard">
        <div className="insight info" style={{ margin: 0 }}>
          <div className="ico">i</div>
          <div className="tx">{v.t}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="reccard">
      <div className={`insight ${insightCls}`} style={{ margin: '0 0 8px' }}>
        <div className="ico">{v.d === 'ok' ? '✓' : '!'}</div>
        <div className="tx" dangerouslySetInnerHTML={{ __html: `${v.t}.${tgt}` }} />
      </div>
      <div className="rec-actions">
        <button
          type="button"
          className={`abtn acc ${d === 'acc' ? 'on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onAccept?.(kind, 'acc');
          }}
        >
          ✓ Accept
        </button>
        <button
          type="button"
          className={`abtn mod ${d === 'mod' ? 'on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onAccept?.(kind, 'mod');
          }}
        >
          ✎ Modify
        </button>
        <button
          type="button"
          className={`abtn rej ${d === 'rej' ? 'on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onReject?.(kind);
          }}
        >
          ✕ Reject
        </button>
        <span className="rec-badge">
          <DecBadge decision={d} />
        </span>
      </div>
    </div>
  );
}

function RepBar({ plan, kind, fwAdj, fwLast, onRepVal, onRepPct }) {
  const has = fwAdj[plan.plan]?.[kind] && Object.keys(fwAdj[plan.plan][kind]).length;
  if (!has) return null;
  const i = fwLast[plan.plan]?.[kind];
  const pct = fwLastPct(plan, kind, fwAdj, fwLast);
  const val = fwGet(plan, kind, i, fwAdj);
  const label = kind === 'vol' ? 'Forecast volume' : 'AHT goal';
  return (
    <div className="repbar">
      <span className="repk">
        {label} · last edit {plan.weeks[i]} →{' '}
        <b>{kind === 'vol' ? money(val) : `${f2(val)}s`}</b>
        {pct != null ? ` (${pct > 0 ? '+' : ''}${f2(pct)}%)` : ''}
      </span>
      <button
        type="button"
        className="repbtn"
        onClick={(e) => {
          e.stopPropagation();
          onRepVal(plan, kind);
        }}
      >
        ↔ Apply value to all weeks
      </button>
      <button
        type="button"
        className="repbtn"
        disabled={pct == null}
        onClick={(e) => {
          e.stopPropagation();
          onRepPct(plan, kind);
        }}
      >
        % Apply {pct != null ? `${pct > 0 ? '+' : ''}${f2(pct)}%` : 'change'} to all weeks
      </button>
    </div>
  );
}

function ImpactBlock({ plan, fwAdj, fwLast, onSetValue, onRepVal, onRepPct }) {
  const rows = fwImpact(plan, fwAdj);
  const step = volStep(plan);

  if (!rows.length) {
    return (
      <div className="imp">
        <div className="dragnote">
          ↕ <b>Drag</b> the forecast (orange) or AHT-goal (grey dashed) point for any future week (drags snap to clean
          steps), <b>or type an exact value</b> in the table once a week is adjusted. FTE requirement &amp; Over/Under
          recalculate live.
        </div>
      </div>
    );
  }

  const tReq = rows.reduce((s, r) => s + r.dReq, 0);

  return (
    <div className="imp">
      <div className="ih">
        ⚡ Live FTE impact — {rows.length} week(s) adjusted
      </div>
      <RepBar plan={plan} kind="vol" fwAdj={fwAdj} fwLast={fwLast} onRepVal={onRepVal} onRepPct={onRepPct} />
      <RepBar plan={plan} kind="aht" fwAdj={fwAdj} fwLast={fwLast} onRepVal={onRepVal} onRepPct={onRepPct} />
      <table>
        <thead>
          <tr>
            <th>Week</th>
            <th>Volume</th>
            <th>AHT (s)</th>
            <th>FTE required</th>
            <th>Δ Req</th>
            <th>New FTE O/U</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.i}>
              <td>{r.wk}</td>
              <td>
                {money(r.oV)} <span className="arw">→</span>{' '}
                <input
                  className="cellinp"
                  type="number"
                  step={step}
                  value={r.nV ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onSetValue(plan, 'vol', r.i, e.target.value)}
                />
              </td>
              <td>
                {f2(r.oA)} <span className="arw">→</span>{' '}
                <input
                  className="cellinp"
                  type="number"
                  step={5}
                  value={r.nA ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onSetValue(plan, 'aht', r.i, e.target.value)}
                />
              </td>
              <td>
                {f2(r.oReq)} <span className="arw">→</span> <b>{f2(r.nReq)}</b>
              </td>
              <td className={r.dReq > 0 ? 'neg' : r.dReq < 0 ? 'pos' : ''}>
                {r.dReq > 0 ? '+' : ''}
                {f2(r.dReq)}
              </td>
              <td className={r.nOU < 0 ? 'neg' : 'pos'}>
                <b>{f2(r.nOU)}</b>{' '}
                <span className="arw" style={{ fontWeight: 400 }}>
                  (was {f2(r.oOU)})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dragnote">
        Net FTE requirement change across adjusted weeks:{' '}
        <b>
          {tReq > 0 ? '+' : ''}
          {f2(tReq)} FTE
        </b>
        . Keep dragging to refine, then submit.
      </div>
    </div>
  );
}

function ForecastDetail({
  plan,
  fwAdj,
  fwLast,
  decisions,
  busy,
  onAccept,
  onReject,
  onApply,
  onSetValue,
  onRepVal,
  onRepPct,
  onReset,
  onSubmit,
}) {
  const fcst = useMemo(() => plan.weeks.map((_, i) => fwGet(plan, 'vol', i, fwAdj)), [plan, fwAdj]);
  const ahtGoal = useMemo(() => plan.weeks.map((_, i) => fwGet(plan, 'aht', i, fwAdj)), [plan, fwAdj]);
  const actVol = (plan.sActVol || []).map((v, i) => (i <= plan.curIdx ? v : null));
  const ahtAct = (plan.sAhtAct || []).map((v, i) => (i <= plan.curIdx ? v : null));
  const volMax = Math.max(...(plan.sFcst || []).filter((v) => v != null), 1000) * 1.4;
  const volSnap = volStep(plan);
  const hasAdj = fwHas(plan, fwAdj);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div className="slabel" style={{ margin: 0 }}>
          Forecast &amp; AHT · {plan.plan}{' '}
          <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--ink-3)' }}>
            — accept the recommendation or drag points to adjust
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!hasAdj ? (
            <button type="button" className="btn-adjust" onClick={(e) => e.stopPropagation()}>
              ✎ Adjust forecast / AHT
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-submit"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onSubmit?.();
                }}
              >
                {busy ? 'Submitting…' : '⬆ Submit forecast / AHT changes'}
              </button>
              <button
                type="button"
                className="btn-reset"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset?.();
                }}
              >
                ↺ Reset to original
              </button>
            </>
          )}
        </div>
      </div>

      <div className="fw-dual-chart">
        <div className="fw-dual-label slabel" style={{ margin: '0 0 6px' }}>
          Forecast vs Actual volume
        </div>
        <div className="fw-dual-label slabel" style={{ margin: '0 0 6px' }}>
          AHT goal vs actual (sec)
        </div>
        <div className="fw-dual-rec">
          <RecCardFW plan={plan} kind="vol" decisions={decisions} onAccept={onAccept} onReject={onReject} />
        </div>
        <div className="fw-dual-rec">
          <RecCardFW plan={plan} kind="aht" decisions={decisions} onAccept={onAccept} onReject={onReject} />
        </div>
        <div className="fw-dual-chartbox chartbox">
          <SeriesChart
            weeks={plan.weeks}
            curIdx={plan.curIdx}
            height={200}
            responsive
            flush
            chartTheme="v4"
            hideDragHint
            thinBars={false}
            barRadius={2}
            barRatio={0.62}
            yFmt={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : f2(v))}
            tipFmt={(v) => money(v)}
            bars={[{ label: 'Actual', data: actVol, color: '#3b82f6' }]}
            line={{ label: 'Forecast', data: fcst, color: '#eb6834' }}
            dragFromIdx={plan.curIdx}
            snap={volSnap}
            minV={0}
            maxV={volMax}
            onDragPoint={(i, v) => onApply(plan, 'vol', i, v)}
          />
        </div>
        <div className="fw-dual-chartbox chartbox">
          <SeriesChart
            weeks={plan.weeks}
            curIdx={plan.curIdx}
            height={200}
            responsive
            flush
            chartTheme="v4"
            hideDragHint
            yFmt={(v) => `${f2(v)}s`}
            tipFmt={(v) => `${f2(v)}s`}
            overlayLine={{ label: 'AHT actual', data: ahtAct, color: '#3b82f6' }}
            line={{ label: 'AHT goal', data: ahtGoal, color: '#8a95a3', dash: '5 4' }}
            dragFromIdx={plan.curIdx}
            snap={5}
            minV={0}
            maxV={600}
            onDragPoint={(i, v) => onApply(plan, 'aht', i, v)}
          />
        </div>
      </div>

      <ImpactBlock
        plan={plan}
        fwAdj={fwAdj}
        fwLast={fwLast}
        onSetValue={onSetValue}
        onRepVal={onRepVal}
        onRepPct={onRepPct}
      />
    </>
  );
}

/** Forecast & Workload step — matches planning_copilot_v4_19.html sFW() in focused plan mode. */
export default function PlanForecastWorkload({ plan, decisions = {}, onDecide, onSubmitForecast }) {
  const volPlans = useMemo(() => (plan?.isVol ? [plan] : []), [plan]);
  const [expanded, setExpanded] = useState(() => new Set(plan?.plan ? [plan.plan] : []));
  const [fwAdj, setFwAdj] = useState({});
  const [fwLast, setFwLast] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setExpanded(new Set(plan?.plan ? [plan.plan] : []));
    setFwAdj({});
    setFwLast({});
  }, [plan?.capId]);

  const fwDecisions = decisions?.fw || {};
  const upN = volPlans.filter((p) => fwRec(p).vol.d === 'up').length;
  const dnN = volPlans.filter((p) => fwRec(p).vol.d === 'down').length;

  const toggle = (planName) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(planName)) next.delete(planName);
      else next.add(planName);
      return next;
    });
  };

  const applyAdj = useCallback(
    (p, kind, i, val) => {
      const v = Math.max(0, Math.round(Number(val) * 100) / 100);
      setFwAdj((prev) => ({
        ...prev,
        [p.plan]: {
          ...(prev[p.plan] || { vol: {}, aht: {} }),
          [kind]: { ...(prev[p.plan]?.[kind] || {}), [i]: v },
        },
      }));
      setFwLast((prev) => ({
        ...prev,
        [p.plan]: { ...(prev[p.plan] || {}), [kind]: i },
      }));
      if (fwDecisions[kind] === 'acc') onDecide?.('fw', kind, 'mod');
    },
    [fwDecisions, onDecide],
  );

  const handleAccept = useCallback(
    (p, kind, mode) => {
      const t = fwRecTarget(p, kind);
      if (!t) return;
      setFwAdj((prev) => ({
        ...prev,
        [p.plan]: {
          ...(prev[p.plan] || { vol: {}, aht: {} }),
          [kind]: { ...t.apply },
        },
      }));
      setFwLast((prev) => ({
        ...prev,
        [p.plan]: { ...(prev[p.plan] || {}), [kind]: p.weeks.length - 1 },
      }));
      onDecide?.('fw', kind, mode);
    },
    [onDecide],
  );

  const handleReject = useCallback(
    (p, kind) => {
      setFwAdj((prev) => {
        const next = { ...prev };
        if (next[p.plan]) next[p.plan] = { ...next[p.plan], [kind]: {} };
        return next;
      });
      onDecide?.('fw', kind, 'rej');
    },
    [onDecide],
  );

  const handleRepVal = useCallback(
    (p, kind) => {
      const i = fwLast[p.plan]?.[kind];
      if (i == null) return;
      const val = fwGet(p, kind, i, fwAdj);
      setFwAdj((prev) => {
        const patch = {};
        for (let w = p.curIdx; w < p.weeks.length; w++) {
          if (fwOrig(p, kind, w) != null) patch[w] = val;
        }
        return { ...prev, [p.plan]: { ...(prev[p.plan] || { vol: {}, aht: {} }), [kind]: patch } };
      });
    },
    [fwAdj, fwLast],
  );

  const handleRepPct = useCallback(
    (p, kind) => {
      const pct = fwLastPct(p, kind, fwAdj, fwLast);
      if (pct == null) return;
      setFwAdj((prev) => {
        const patch = {};
        for (let w = p.curIdx; w < p.weeks.length; w++) {
          const o = fwOrig(p, kind, w);
          if (o != null) patch[w] = Math.round(o * (1 + pct / 100) * 100) / 100;
        }
        return { ...prev, [p.plan]: { ...(prev[p.plan] || { vol: {}, aht: {} }), [kind]: patch } };
      });
    },
    [fwAdj, fwLast],
  );

  const handleReset = useCallback((p) => {
    setFwAdj((prev) => {
      const next = { ...prev };
      delete next[p.plan];
      return next;
    });
    setFwLast((prev) => {
      const next = { ...prev };
      delete next[p.plan];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (p) => {
      setBusy(true);
      try {
        const fcst = p.weeks.map((_, i) => fwGet(p, 'vol', i, fwAdj));
        const aht_goal = p.weeks.map((_, i) => fwGet(p, 'aht', i, fwAdj));
        await onSubmitForecast?.({ fcst, aht_goal });
      } finally {
        setBusy(false);
      }
    },
    [fwAdj, onSubmitForecast],
  );

  const insightCls = upN + dnN ? 'warn' : 'info';
  const insightIco = upN + dnN ? '!' : 'i';

  return (
    <>
      <div className={`insight ${insightCls}`} style={{ marginBottom: 14 }}>
        <div className="ico">{insightIco}</div>
        <div className="tx">
          <b>{volPlans.length} volume-based plan(s)</b> in scope (Plan Type &quot;Volume based…&quot;). {upN} need the
          forecast revised up, {dnN} down, based on the last 8 weeks of actuals vs forecast.
          <small>
            Only volume-based plans appear here — forecast accuracy doesn&apos;t drive FTE the same way on FTE-based
            plans. Expand a plan to see the volume &amp; AHT charts and adjust.
          </small>
        </div>
      </div>

      {!volPlans.length ? (
        <div className="insight info">
          <div className="ico">i</div>
          <div className="tx">No volume-based plans match the current filter/scope.</div>
        </div>
      ) : (
        <div className="land-v4">
          <div className="card land-table-card in">
            <table className="ptable">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Forecast vol</th>
                <th>Actual vol</th>
                <th>Fcst bias</th>
                <th>Forecast rec</th>
                <th>AHT goal</th>
                <th>AHT actual</th>
                <th>AHT bias</th>
                <th>AHT rec</th>
              </tr>
            </thead>
            <tbody>
              {volPlans.map((p) => {
                const ex = expanded.has(p.plan);
                const r = fwRec(p);
                const b = r.b;
                const fc = p.sFcst?.[p.curIdx];
                const av = p.sActVol?.[p.curIdx];
                const ag = p.sAhtGoal?.[p.curIdx];
                const aa = p.sAhtAct?.[p.curIdx];
                return (
                  <Fragment key={p.capId}>
                    <tr className={`prow ${ex ? 'exp' : ''}`} onClick={() => toggle(p.plan)}>
                      <td>
                        <div className={`pname ${ex ? 'exp' : ''}`}>
                          <span className="caret">▶</span>
                          <span className="capchip">{p.capId}</span>
                          <span>{p.plan}</span>
                        </div>
                        <div className="pmeta">{planCrumb(p)}</div>
                      </td>
                      <td className="mono">{fc == null ? '—' : money(fc)}</td>
                      <td className="mono">{av == null ? '—' : money(av)}</td>
                      <td
                        className={`mono ${b.fBias == null ? 'mut' : b.fBias > 0 ? 'pos' : 'neg'}`}
                        title="recent actual vs forward forecast"
                      >
                        {b.fBias == null ? '—' : `${b.fBias > 0 ? '+' : ''}${f2(b.fBias)}%`}
                      </td>
                      <td>
                        <span className={recChipCls(r.vol.d)}>{volRecTxt(r.vol.d)}</span>
                      </td>
                      <td className="mono">{ag == null ? '—' : f2(ag)}</td>
                      <td className="mono">{aa == null ? '—' : f2(aa)}</td>
                      <td
                        className={`mono ${b.aBias == null ? 'mut' : b.aBias < 0 ? 'pos' : 'neg'}`}
                        title="recent actual AHT vs forward goal — below goal is favourable"
                      >
                        {b.aBias == null ? '—' : `${b.aBias > 0 ? '+' : ''}${f2(b.aBias)}%`}
                      </td>
                      <td>
                        <span className={recChipCls(r.aht.d)}>{ahtRecTxt(r.aht.d)}</span>
                      </td>
                    </tr>
                    {ex ? (
                      <tr className="detail">
                        <td colSpan={9}>
                          <div className="detail-inner">
                            <ForecastDetail
                              plan={p}
                              fwAdj={fwAdj}
                              fwLast={fwLast}
                              decisions={fwDecisions}
                              busy={busy}
                              onAccept={(kind, mode) => handleAccept(p, kind, mode)}
                              onReject={(kind) => handleReject(p, kind)}
                              onApply={applyAdj}
                              onSetValue={applyAdj}
                              onRepVal={handleRepVal}
                              onRepPct={handleRepPct}
                              onReset={() => handleReset(p)}
                              onSubmit={() => handleSubmit(p)}
                            />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
}
