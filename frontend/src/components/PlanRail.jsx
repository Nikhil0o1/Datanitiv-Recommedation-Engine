import { statusOf } from '../utils/planLogic';
import { f2 } from '../utils/format';

export default function PlanRail({ plans = [], activeCapId, onSelectPlan, onBackToPortfolio }) {
  const sorted = [...plans].sort((a, b) => a.sustained - b.sustained);

  return (
    <aside className="rail">
      <div className="rail-h">
        <span>Plans</span>
      </div>
      <div className="rail-scope">
        <button type="button" className="scopebtn on" onClick={onBackToPortfolio}>
          ▦ All plans (portfolio)
        </button>
      </div>
      <div className="rail-list">
        {sorted.map((p) => {
          const st = statusOf(p);
          const on = p.capId === activeCapId;
          return (
            <button
              key={p.capId}
              type="button"
              className={`plannav ${on ? 'on' : ''}`}
              onClick={() => onSelectPlan?.(p.capId)}
            >
              <span className={`sd ${st}`} />
              <span className="pn-wrap">
                <span className="pn-id">{p.capId}</span>
                <span className="pn-crumb">{p.program || '—'}</span>
                <span className={`pv ${st}`}>
                  {p.sustained >= 0 ? '+' : ''}
                  {f2(p.sustained)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
