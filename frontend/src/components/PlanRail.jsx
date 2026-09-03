import { statusOf } from '../utils/planLogic';
import { f2 } from '../utils/format';

const DOT = {
  critical: 'bg-neg',
  under: 'bg-warn',
  surplus: 'bg-pos',
  balanced: 'bg-ink-3',
};

const PV = {
  critical: 'text-neg',
  under: 'text-warn',
  surplus: 'text-pos',
  balanced: 'text-ink-3',
};

function planCrumb(p) {
  const parts = [p.lob, p.subLob, p.site || p.country].filter(Boolean);
  if (parts.length) return parts.join(' › ');
  return p.program || '—';
}

export default function PlanRail({
  plans = [],
  activeCapId,
  activePlanName,
  onSelectPlan,
  onBackToPortfolio,
}) {
  const sorted = [...plans].sort((a, b) => a.sustained - b.sustained);

  return (
    <aside className="sticky top-[72px] overflow-hidden rounded-[14px] border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-line-2 px-3.5 py-3 text-xs font-bold uppercase tracking-wide text-ink-3">
        <span>Plans</span>
        <span className="tabular-nums">{sorted.length}</span>
      </div>
      <div className="border-b border-line-2 p-3">
        <button
          type="button"
          className="mb-2 flex w-full cursor-pointer items-center gap-2 rounded-[9px] border border-line bg-surface px-2.5 py-2 text-left text-[12.5px] font-semibold text-ink-2 transition-colors hover:bg-surface-2"
          onClick={onBackToPortfolio}
        >
          ▦ All plans (portfolio)
        </button>
        {activePlanName ? (
          <button
            type="button"
            className="flex w-full cursor-default items-center gap-2 rounded-[9px] border border-[#f6e2b8] bg-brand-050 px-2.5 py-2 text-left text-[12.5px] font-semibold text-brand-600"
          >
            ◎ Focused: {activePlanName}
          </button>
        ) : null}
      </div>
      <div className="max-h-[min(62vh,620px)] overflow-y-auto">
        {sorted.map((p) => {
          const st = statusOf(p);
          const on = p.capId === activeCapId;
          return (
            <button
              key={p.capId}
              type="button"
              className={`flex w-full cursor-pointer items-start gap-2 border-l-[3px] px-3 py-2.5 text-left text-[12.5px] transition-colors ${
                on ? 'border-l-brand bg-brand-050' : 'border-l-transparent hover:bg-surface-2'
              }`}
              onClick={() => onSelectPlan?.(p.capId)}
            >
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[st] || DOT.balanced}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-bold tracking-wide text-ink">{p.capId}</span>
                  <span className={`shrink-0 text-xs font-bold tabular-nums ${PV[st] || PV.balanced}`}>
                    {p.sustained >= 0 ? '+' : ''}
                    {f2(p.sustained)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-ink-3">{planCrumb(p)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
