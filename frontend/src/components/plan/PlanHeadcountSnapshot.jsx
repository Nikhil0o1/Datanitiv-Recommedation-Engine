import { useEffect, useRef, useState } from 'react';
import { f2 } from '../../utils/format';
import { planCrumb } from '../../utils/forecastLogic';
import {
  HC_MOVE_KEYS,
  HC_ROWS,
  hcSnapshot,
  moveCell,
  moveClass,
  netDelta,
} from '../../utils/headcountLogic';

/** Headcount step — matches planning_copilot_v4_19.html sHC() in focused plan mode. */
export default function PlanHeadcountSnapshot({ plan, onSaveHeadcount }) {
  const baseCur = plan?.hcCur;
  const [editing, setEditing] = useState(false);
  const [cur, setCur] = useState(() => hcSnapshot(baseCur));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const flowRef = useRef(null);

  useEffect(() => {
    setCur(hcSnapshot(plan?.hcCur));
    setEditing(false);
    setSaved(false);
  }, [plan?.capId]);

  useEffect(() => {
    if (editing) return;
    setCur(hcSnapshot(plan?.hcCur));
  }, [editing, plan?.hcCur]);

  if (!baseCur) {
    return (
      <div className="insight info">
        <div className="ico">i</div>
        <div className="tx">No headcount snapshot for this plan in the database yet.</div>
      </div>
    );
  }

  const last = hcSnapshot(plan.hcLast || { opening: baseCur.opening });
  const live = hcSnapshot(cur);
  const prevWk = plan.weeks[Math.max(0, plan.curIdx - 1)] || '—';
  const curWk = plan.weeks[plan.curIdx] || '—';
  const net = netDelta(live.closing - last.closing);

  const scrollToFlow = () => {
    flowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="land-v4">
      <div className="card land-table-card in">
        <table className="ptable hc-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Close · last wk</th>
              <th>Open · this wk</th>
              <th>Close · this wk</th>
              <th>Net Δ</th>
              <th>Tfr in/out</th>
              <th>Attr</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            <tr className="prow exp hc-summary-row">
              <td>
                <div className="pname exp">
                  <span className="caret">▶</span>
                  <span className="capchip">{plan.capId}</span>
                  <span>{plan.plan}</span>
                </div>
                <div className="pmeta">{planCrumb(plan)}</div>
              </td>
              <td className="mono">{f2(last.closing)}</td>
              <td className="mono">{f2(live.opening)}</td>
              <td className="mono">{f2(live.closing)}</td>
              <td className={`mono ${net.cls}`}>{net.txt}</td>
              <td className="mono">
                {f2(live.tin)} / {f2(live.tout)}
              </td>
              <td className="mono">{f2(live.attr)}</td>
              <td>
                <button type="button" className="flowicon" onClick={scrollToFlow}>
                  ☰ FTE flow
                </button>
              </td>
            </tr>
            <tr className="detail">
              <td colSpan={8}>
                <div className="detail-inner hc-detail-inner" ref={flowRef}>
                  <div className="hc-detail-head">
                    <div className="slabel" style={{ margin: 0 }}>
                      FTE flow · {plan.plan}
                    </div>
                    <button
                      type="button"
                      className="btn-adjust"
                      data-act="hc-update"
                      onClick={() => {
                        setEditing((v) => !v);
                        setSaved(false);
                      }}
                    >
                      {editing ? 'Hide editor' : '✎ Update transfers / promotions'}
                    </button>
                  </div>

                  {editing ? (
                    <div className="hc-edit" data-act="hc-editor">
                      {HC_MOVE_KEYS.map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cur[key] ?? 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setCur((h) => hcSnapshot({ ...h, [key]: val }));
                              setSaved(false);
                            }}
                          />
                        </label>
                      ))}
                      <button
                        type="button"
                        className="btn-submit"
                        data-act="hc-save"
                        disabled={busy}
                        onClick={async () => {
                          const next = hcSnapshot(cur);
                          setCur(next);
                          setBusy(true);
                          try {
                            await onSaveHeadcount?.({
                              opening: next.opening,
                              nest: next.nest,
                              tin: next.tin,
                              tout: next.tout,
                              loa_in: next.loaIn,
                              loa_out: next.loaOut,
                              attr: next.attr,
                              promo: next.promo,
                              closing: next.closing,
                            });
                            setSaved(true);
                            setEditing(false);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {busy ? 'Saving…' : 'Save movements'}
                      </button>
                    </div>
                  ) : null}

                  {saved ? (
                    <div className="insight pos" data-act="hc-saved" style={{ marginBottom: 12 }}>
                      <div className="ico">✓</div>
                      <div className="tx">
                        <b>Movements saved.</b> Closing FTE is now {f2(live.closing)}. Projected FTE, O/U, attrition
                        this week, and recommended OT all use this closing.
                      </div>
                    </div>
                  ) : null}

                  <table className="hc-flow">
                    <thead>
                      <tr>
                        <th>Movement</th>
                        <th>Previous wk · {prevWk}</th>
                        <th>Current wk · {curWk}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {HC_ROWS.map(([label, key, grp]) => (
                        <tr key={label} className={grp ? 'grp-row' : ''}>
                          <td>{label}</td>
                          <td className={moveClass(key, grp)}>{moveCell(last, key, grp)}</td>
                          <td className={moveClass(key, grp)}>{moveCell(live, key, grp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
