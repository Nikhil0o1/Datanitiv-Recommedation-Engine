import { useEffect, useRef, useState } from 'react';
import { f2 } from '../../utils/format';
import { planCrumb } from '../../utils/forecastLogic';
import {
  classRefName,
  formatClassDate,
  hasRosterGap,
  onboardedFte,
  rosterStatus,
  weekRelLabel,
} from '../../utils/newHireLogic';
import { readRosterFile } from '../../utils/rosterCsv';

/** New-hire & onboarding step — matches planning_copilot_v4_19.html sNH() in focused plan mode. */
export default function PlanNewHireOnboarding({ plan, onMapRoster }) {
  const cls = plan?.cls;
  const [uploadNote, setUploadNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setUploadNote('');
    setBusy(false);
  }, [plan?.capId]);

  const className = classRefName(cls, plan?.capId);
  const status = rosterStatus(cls);
  const planHc = Number(cls?.plan) || 0;
  const trainHc = Number(cls?.trainHC) || planHc;
  const onboarded = onboardedFte(cls, status.mapped);
  const nearestDate = formatClassDate(cls?.date);
  const gap = hasRosterGap(plan);

  const mapPayload = (extra = {}) => ({
    cap_id: plan.capId,
    class_id: cls?.id,
    train_hc: extra.train_hc ?? trainHc,
    ...extra,
  });

  const openUpload = () => fileRef.current?.click();

  const doUploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !cls?.id) return;
    setBusy(true);
    try {
      const parsed = await readRosterFile(file);
      if (!parsed.rows.length) {
        setUploadNote(parsed.errors.join(' ') || 'Empty CSV');
        return;
      }
      setUploadNote(`Reading ${parsed.filename} · ${parsed.rows.length} employees…`);
      await onMapRoster?.(
        mapPayload({
          train_hc: parsed.totalFte,
          employees: parsed.rows,
          source_filename: parsed.filename,
        }),
      );
      setUploadNote(
        `Uploaded ${parsed.filename} · ${parsed.rows.length} employees · ${f2(parsed.totalFte)} FTE mapped`,
      );
    } catch (err) {
      setUploadNote(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {gap ? (
        <div className="insight warn" style={{ marginBottom: 14 }}>
          <div className="ico">!</div>
          <div className="tx">
            <b>1 plan(s) with a roster gap:</b> {plan.plan}. A class with hires not mapped on the Employee Roster is
            excluded from projected FTE. Resolve rosters before approving OT/hiring so the staffing gap isn&apos;t
            overstated.
          </div>
        </div>
      ) : null}

      <div className="land-v4">
        <div className="card land-table-card in">
          <table className="ptable nh-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Class reference</th>
                <th>Nearest class</th>
                <th>Plan HC</th>
                <th>Onboarded</th>
                <th>Roster status</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`prow exp nh-summary-row${gap ? ' nh-gap' : ''}`}>
                <td>
                  <div className="pname exp">
                    <span className="caret">▶</span>
                    <span className="capchip">{plan.capId}</span>
                    <span>{plan.plan}</span>
                  </div>
                  <div className="pmeta">{planCrumb(plan)}</div>
                </td>
                <td className="mono">{cls ? className : '—'}</td>
                <td className="mono">{cls ? nearestDate : '—'}</td>
                <td className="mono">{cls ? f2(planHc) : '—'}</td>
                <td className={`mono ${status.gap ? 'neg' : ''}`}>{cls ? f2(onboarded) : '—'}</td>
                <td>
                  <div className="nh-roster-cell">
                    <span className={status.chip}>{status.label}</span>
                    {cls && status.gap ? (
                      <button type="button" className="flowicon" disabled={busy} onClick={openUpload}>
                        ↑ Upload
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
              <tr className="detail">
                <td colSpan={6}>
                  <div className="detail-inner nh-detail-inner">
                    {!cls ? (
                      <div className="insight info">
                        <div className="ico">i</div>
                        <div className="tx">No class in the planning window for this plan.</div>
                      </div>
                    ) : (
                      <>
                        <div className="nh-detail-head">
                          <div className="slabel" style={{ margin: 0 }}>
                            Class {className} · {plan.plan}
                          </div>
                          <button
                            type="button"
                            className="btn-adjust"
                            data-act="nh-upload"
                            disabled={busy}
                            onClick={openUpload}
                          >
                            ↑ Upload roster
                          </button>
                        </div>

                        <div className="land-kmini-grid nh-kmini-grid">
                          <div className="tile land-kmini b-info">
                            <div className="bar" />
                            <div className="k">Class reference</div>
                            <div className="land-kmini-val">{className}</div>
                            <div className="s">
                              {nearestDate} · {weekRelLabel(cls.wkRel)}
                            </div>
                          </div>
                          <div className="tile land-kmini b-info">
                            <div className="bar" />
                            <div className="k">Train / Nest</div>
                            <div className="land-kmini-val">
                              {cls.trainWk} wk / {cls.nestWk} wk
                            </div>
                          </div>
                          <div className={`tile land-kmini ${status.gap ? 'b-neg' : 'b-pos'}`}>
                            <div className="bar" />
                            <div className="k">Onboarded / plan</div>
                            <div className={`land-kmini-val ${status.gap ? 'neg' : 'pos'}`}>
                              {f2(onboarded)} / {f2(planHc)}
                            </div>
                          </div>
                          <div className="tile land-kmini b-warn">
                            <div className="bar" />
                            <div className="k">Classes · next 12 wk</div>
                            <div className="land-kmini-val">{plan.nClasses12 || 0}</div>
                          </div>
                        </div>

                        {uploadNote ? (
                          <div className={`insight ${uploadNote.includes('mapped') || uploadNote.includes('Uploaded') ? 'pos' : 'info'}`}>
                            <div className="ico">{uploadNote.includes('error') ? '!' : 'i'}</div>
                            <div className="tx">{uploadNote}</div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={doUploadFile} />
    </>
  );
}
