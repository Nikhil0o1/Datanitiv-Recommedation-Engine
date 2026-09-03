/** Workflow step order — matches planning_copilot_v4_19.html FLOW (Forecast only for volume plans). */
export const WORKFLOW_STEPS = [
  { key: 'ov', label: 'Overview', icon: '🧭' },
  { key: 'fw', label: 'Forecast', icon: '📈', volOnly: true },
  { key: 'hc', label: 'Headcount', icon: '👥' },
  { key: 'nh', label: 'New Hire', icon: '🎓' },
  { key: 'shr', label: 'Shrinkage', icon: '📉' },
  { key: 'att', label: 'Attrition', icon: '📊' },
  { key: 'rec', label: 'Recommend', icon: '⚡' },
  { key: 'exe', label: 'Execute', icon: '🚀' },
];

export function workflowStepsForPlan(plan) {
  if (!plan) return WORKFLOW_STEPS.filter((s) => !s.volOnly);
  return plan.isVol ? WORKFLOW_STEPS : WORKFLOW_STEPS.filter((s) => !s.volOnly);
}

export function stepMeta(activeTab, plan) {
  const name = plan?.plan || 'this plan';
  const map = {
    ov: {
      title: 'Plan overview',
      sub: `A one-page summary of ${name}. Review each section, accept or adjust inline, or open any section for the full detail.`,
    },
    fw: {
      title: 'Forecast & Workload — volume-based plans',
      sub: 'I compare Forecast volume vs Actual received, and AHT Goal vs Actual, over recent history — then recommend whether to revise the forecast or AHT up or down. Volume-based plans only.',
    },
    hc: {
      title: 'Headcount snapshot',
      sub: 'Opening & closing FTE and every movement — Nesting→Production, Transfers, LOA, Attrition, Promotion — for last week and the current week. Click a plan (or the ☰ FTE flow icon) for the full waterfall.',
    },
    nh: {
      title: 'New-hire & onboarding',
      sub: 'Nearest in-flight or upcoming class per plan, cross-checked for roster upload. Plans without a class in the window are shown for completeness.',
    },
    shr: {
      title: 'Shrinkage trend',
      sub: 'Out-of-Office + In-Office shrink — compare 8-week actuals against the plan, accept the recommendation or drag plan points to adjust forward weeks.',
    },
    att: {
      title: 'Attrition trend',
      sub: 'Production attrition — last 8 weeks actual vs next 8 weeks plan, per plan. Expand a plan for the full chart.',
    },
    rec: {
      title: 'Staffing recommendations',
      sub: 'OT → cross-util → hire package sequenced for this plan.',
    },
    exe: {
      title: 'Review & execute',
      sub: 'Accepted recommendations queue here for execution.',
    },
  };
  return map[activeTab] || map.ov;
}
