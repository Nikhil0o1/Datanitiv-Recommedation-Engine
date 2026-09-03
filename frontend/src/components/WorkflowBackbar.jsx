import { useEffect, useRef } from 'react';
import { workflowStepsForPlan } from './plan/workflowSteps';

/**
 * Focused-plan top bar — matches planning_copilot_v4_19.html #backbar + .mini-stepper
 */
export default function WorkflowBackbar({ plan, activeTab, onBack, onStepClick }) {
  const scrollerRef = useRef(null);
  const stepRefs = useRef([]);
  const steps = workflowStepsForPlan(plan);
  const curIdx = Math.max(0, steps.findIndex((s) => s.key === activeTab));

  useEffect(() => {
    const el = stepRefs.current[curIdx];
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;

    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;

    if (elLeft < viewLeft) {
      scroller.scrollTo({ left: elLeft - 8, behavior: 'smooth' });
    } else if (elRight > viewRight) {
      scroller.scrollTo({ left: elRight - scroller.clientWidth + 8, behavior: 'smooth' });
    }
  }, [curIdx, steps.length]);

  return (
    <div id="backbar">
      <div className="bc-left">
        <button type="button" className="btn-back" onClick={onBack}>
          ← All plans
        </button>
        {plan ? (
          <span className="bc-plan">
            <span className="capchip">{plan.capId}</span>{' '}
            <b>{plan.plan}</b>{' '}
            <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>· detailed analysis</span>
          </span>
        ) : null}
      </div>

      <div className="mini-stepper-wrap">
        <div ref={scrollerRef} className="mini-stepper">
          {steps.flatMap((s, i) => {
            const done = i < curIdx;
            const active = i === curIdx;
            const cls = done ? 'done' : active ? 'active' : '';
            const nodes = [];

            if (i > 0) nodes.push(<div key={`${s.key}-conn`} className="ms-conn" aria-hidden />);

            nodes.push(
              <div
                key={s.key}
                ref={(node) => {
                  stepRefs.current[i] = node;
                }}
                role="button"
                tabIndex={0}
                className={`ms-step ${cls}`.trim()}
                title={s.label}
                onClick={() => onStepClick?.(s.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStepClick?.(s.key);
                  }
                }}
              >
                <span className="num">{done ? '✓' : i + 1}</span>
                <span className="lbl">{s.label}</span>
              </div>,
            );

            return nodes;
          })}
        </div>
      </div>
    </div>
  );
}
