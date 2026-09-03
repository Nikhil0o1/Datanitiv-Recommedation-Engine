import { stepMeta, workflowStepsForPlan } from './workflowSteps';

export default function PlanWorkflowShell({
  plan,
  activeTab,
  onTabChange,
  onBackToPortfolio,
  onOpenQueue,
  children,
}) {
  const steps = workflowStepsForPlan(plan);
  const curIdx = Math.max(0, steps.findIndex((s) => s.key === activeTab));
  const meta = stepMeta(activeTab, plan);
  const stepIcon = steps.find((s) => s.key === activeTab)?.icon || '🧭';
  const isLast = curIdx >= steps.length - 1;

  const handleBack = () => {
    if (curIdx > 0) onTabChange?.(steps[0].key);
    else onBackToPortfolio?.();
  };

  const handleNext = () => {
    if (isLast) onOpenQueue?.();
    else onTabChange?.(steps[curIdx + 1].key);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm animate-[rise_0.35s_cubic-bezier(0.2,0.7,0.3,1)_both]">
      <div className="flex items-start gap-3.5 border-b border-line-2 px-6 py-4 pt-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-050 text-brand-600">
          {stepIcon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[17px] font-bold tracking-tight text-ink">{meta.title}</h2>
          <p className="mt-0.5 max-w-[720px] text-[13px] text-ink-2">{meta.sub}</p>
        </div>
        <div className="shrink-0 rounded-2xl border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] font-bold text-ink-3">
          Step {curIdx + 1} · {steps[curIdx]?.label}
        </div>
      </div>

      <div className="px-6 py-5">{children}</div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line-2 bg-surface-2 px-6 py-4">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface px-5 py-2.5 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          onClick={handleBack}
          disabled={curIdx === 0}
        >
          {curIdx > 0 ? '← Plan summary' : '← Back'}
        </button>
        <span className="text-[12.5px] text-ink-3">
          Step {curIdx + 1} of {steps.length} · focused plan
        </span>
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <i
              key={s.key}
              className={`block h-1.5 w-1.5 rounded-full ${i <= curIdx ? 'bg-brand' : 'bg-line'}`}
              aria-hidden
            />
          ))}
        </div>
        <div className="flex-1" />
        {!isLast ? (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_2px_6px_rgba(245,166,35,0.32)] transition-colors hover:bg-brand-600"
            onClick={handleNext}
          >
            {curIdx === 0 ? 'Start review →' : 'Next →'}
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-header px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1c1f24]"
            onClick={handleNext}
          >
            🚀 Execute approved actions
          </button>
        )}
      </div>
    </div>
  );
}
