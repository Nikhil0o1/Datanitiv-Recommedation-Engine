import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api } from '../api/client';
import { emit, emitError } from '../lib/telemetry';
import { loadAllDataRows } from '../utils/planTransform';
import '../styles/copilot-v4.css';
import '../styles/app.css';
import { f2, hm } from '../utils/format';
import { useScenarioEngine } from '../hooks/useScenarioEngine';
import { usePortfolioRecommendations } from '../hooks/usePortfolioRecommendations';
import AgentCursor from './AgentCursor';
import PlanTabs, { tabsForPlan } from './plan/PlanTabs';
import PortfolioLanding from './PortfolioLanding';
import PlanRail from './PlanRail';
import CreatePlanPanel from './CreatePlanPanel';
import v4DnLogo from '../assets/v4DnLogo.js';
import { filterPlans, matchesPlanSearch } from '../utils/planSearch';
import { computeXutil, defaultOtWeekly, fwdCount, hireTiming, planRecWithWeekly, scaleDonorsToXu } from '../utils/planLogic';
import {
  EMPTY_CREATE_PLAN_DRAFT,
  apiFieldToDraftKey,
  createPlanPayload,
  nextCreatePlanField,
} from '../utils/createPlanFields';

const WORKFLOW_STEPS = [
  { key: 'ov', label: 'Overview' },
  { key: 'shr', label: 'Shrinkage' },
  { key: 'att', label: 'Attrition' },
  { key: 'fw', label: 'Forecast' },
  { key: 'hc', label: 'Headcount' },
  { key: 'rec', label: 'Recommend' },
  { key: 'exe', label: 'Execute' },
];

function buildStaffingPackage(plan, capId, planDecisions, otWeeksByCap, allPlans) {
  const ovr = planDecisions[capId]?.recOvr || {};
  const xutil = computeXutil(allPlans);
  const n = fwdCount(plan);
  const weeks = otWeeksByCap[capId];
  const weekly = weeks?.length === n ? weeks : Array(n).fill(defaultOtWeekly(plan, ovr.otPct ?? 5));
  const rec = planRecWithWeekly(
    plan,
    {
      otPct: ovr.otPct ?? 5,
      xr: ovr.xr,
      starts: ovr.starts,
      trainWk: ovr.trainWk,
      nestWk: ovr.nestWk,
      gotBy: xutil.gotBy,
    },
    weekly,
  );
  const timing = hireTiming(plan, ovr);
  const donors = scaleDonorsToXu(xutil.donorsBy?.[capId] || [], rec.xr);
  const donorNote = donors.length
    ? ` from ${donors.slice(0, 3).map((d) => d.cap_id).join(', ')}${donors.length > 3 ? '…' : ''}`
    : '';
  const hireNote =
    rec.starts > 0 ? ` · hire ${rec.starts} (prod +${timing.productiveIn}wk)` : ' · hire 0';
  return { rec, timing, donors, weekly, donorNote, hireNote, otHrs: rec.otHrs };
}

/** Forward planning horizon: this week through next 12 weeks (same window as shrink12 / Overview). */
const SHRINK_MAX = 70;

function clampShrink(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(SHRINK_MAX, Math.max(0, Math.round(n * 100) / 100));
}

function buildEditorWeeks(plan) {
  if (!plan) return [];
  const i0 = plan.curIdx;
  const rows = [];
  for (let i = 0; i < 12; i++) {
    if (i0 + i >= plan.weeks.length) break;
    const idx = i0 + i;
    const baseShrink = plan.sShrinkPlan[idx] ?? plan.sShrink[idx] ?? 0;
    rows.push({
      weekIdx: idx,
      wk: plan.weeks[idx],
      base: baseShrink,
      cur: baseShrink,
      proj: plan.sProj[idx],
    });
  }
  return rows;
}

function mergeEditorWeeks(plan, prev, dirty) {
  const next = buildEditorWeeks(plan);
  if (!dirty || !prev?.length) return next;
  const curByIdx = new Map(prev.map((w) => [w.weekIdx, w.cur]));
  return next.map((w) => (curByIdx.has(w.weekIdx) ? { ...w, cur: curByIdx.get(w.weekIdx) } : w));
}

const ATTR_MAX = 40;

function clampAttr(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(ATTR_MAX, Math.max(0, Math.round(n * 100) / 100));
}

function buildAttrWeeks(plan) {
  if (!plan) return [];
  const i0 = plan.curIdx;
  const opening = Number(plan.hcCur?.opening) || Number(plan.sProj?.[i0]) || 0;
  const rows = [];
  for (let i = 0; i < 12; i++) {
    if (i0 + i >= plan.weeks.length) break;
    const idx = i0 + i;
    const base = plan.sAttrPlan[idx] ?? plan.sAttr[idx] ?? 0;
    const proj = Number(plan.sProj[idx]) || 0;
    rows.push({
      weekIdx: idx,
      wk: plan.weeks[idx],
      base,
      cur: base,
      proj,
      stock: i === 0 ? opening : proj,
    });
  }
  return rows;
}

function mergeAttrWeeks(plan, prev, dirty) {
  const next = buildAttrWeeks(plan);
  if (!dirty || !prev?.length) return next;
  const curByIdx = new Map(prev.map((w) => [w.weekIdx, w.cur]));
  return next.map((w) => (curByIdx.has(w.weekIdx) ? { ...w, cur: curByIdx.get(w.weekIdx) } : w));
}

export default function PlanningApp() {
  const workspaceRef = useRef(null);
  const domHandlersRef = useRef({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [data, setData] = useState([]);
  const [triage, setTriage] = useState({ dec: [], auto: [], quiet: [] });
  const [programs, setPrograms] = useState([]);
  const [cycleLabel, setCycleLabel] = useState('Week of Aug 02, 2026');
  const [ledger, setLedger] = useState([]);
  const [memories, setMemories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [portRegion, setPortRegion] = useState('');
  const [portVertical, setPortVertical] = useState('');
  const [portStatus, setPortStatus] = useState('');
  const [planDecisions, setPlanDecisions] = useState({});
  const [otWeeksByCap, setOtWeeksByCap] = useState({});
  const paneRef = useRef(null);
  const stateRef = useRef(null);

  const [state, setState] = useState({
    view: 'port',
    filter: 'all',
    activePlan: 'CAP00010',
    activeTab: 'ov',
    shownTabs: [],
    messages: [],
    bubble: '',
    agentTalk: false,
    agentHear: false,
    agentStatus: 'Standing by',
    savedMin: 0,
    savedBump: false,
    focusCap: null,
    snap: false,
    foldVisible: false,
    revealed: {},
    counts: { c1: '', c2: '' },
    chartOU: null,
    chartShr: null,
    editorReady: false,
    editorWeeks: [],
    attrWeeks: [],
    editSrc: 'plan values',
    netReq: null,
    shrLastEdit: null,
    doneShr: false,
    shrDirty: false,
    attrLastEdit: null,
    doneAttr: false,
    attrDirty: false,
    doneRoster: false,
    doneRec: false,
    execDone: false,
    execMsg: '',
    ledgerAnimated: false,
    memoriesCited: false,
    packages: [],
    createPlan: {
      open: false,
      agentMode: false,
      draft: EMPTY_CREATE_PLAN_DRAFT(),
      highlightField: null,
      openSelect: null,
      busy: false,
      error: '',
    },
  });
  stateRef.current = state;

  const engine = useScenarioEngine(state, setState, { workspaceRef, domHandlersRef });

  const portfolioCapIds = useMemo(() => data.map((p) => p.capId), [data]);
  const portfolioRecs = usePortfolioRecommendations({ enabled: !loading && portfolioCapIds.length > 0, capIds: portfolioCapIds });

  const matchesSearch = useCallback((item) => matchesPlanSearch(item, searchQuery), [searchQuery]);

  const filteredData = useMemo(
    () => filterPlans(data, { query: searchQuery, program: state.filter }),
    [data, searchQuery, state.filter],
  );

  const filteredPackages = useMemo(() => {
    const base =
      state.filter === 'all'
        ? state.packages
        : state.packages.filter((p) => {
            const row = data.find((d) => d.capId === p.cap_id);
            return row?.program === state.filter;
          });
    const active = base.filter((p) => p.status !== 'rejected');
    if (!searchQuery.trim()) return active;
    return active.filter((p) => matchesPlanSearch(p, searchQuery));
  }, [state.packages, state.filter, data, searchQuery]);

  const refreshPortfolio = useCallback(async () => {
    try {
      const [rows, tri, progs, cycle, pkg] = await Promise.all([
        loadAllDataRows(api),
        api.triage(),
        api.programs(),
        api.cycle(),
        api.queue(),
      ]);
      setData(rows);
      setTriage(tri);
      setPrograms(progs);
      setCycleLabel(cycle.week_label);
      setLoadError(null);
      setState((s) => ({
        ...s,
        packages: (pkg || []).map((p) => {
          const prev = s.packages.find((x) => x.id === p.id);
          const posted = p.status === 'posted' || Boolean(p.staffing_applied);
          return {
            ...p,
            ticked: posted ? false : (prev?.ticked ?? false),
            done: posted || Boolean(prev?.done),
          };
        }),
      }));
    } catch (e) {
      console.error(e);
    }
  }, [setState]);

  useEffect(() => {
    if (loading) return;
    emit('ui.context', {
      metadata: {
        cap_id: state.activePlan,
        active_cap_id: state.activePlan,
        active_tab: state.activeTab,
        view: state.view,
        filter: state.filter,
      },
    });
  }, [loading, state.activePlan, state.activeTab, state.view, state.filter]);

  useEffect(() => {
    if (loading) return undefined;
    portfolioRecs.refresh();
    return undefined;
  }, [loading, state.view, state.activePlan, portfolioRecs.refresh]);

  useEffect(() => {
    (async () => {
      try {
        const [rows, tri, progs, cycle, pkg, led, mem] = await Promise.all([
          loadAllDataRows(api),
          api.triage(),
          api.programs(),
          api.cycle(),
          api.queue(),
          api.ledger(),
          api.memories(),
        ]);
        setData(rows);
        setTriage(tri);
        setPrograms(progs);
        setCycleLabel(cycle.week_label);
        setLedger(led.entries || []);
        setMemories(mem);
        setLoadError(null);
        setState((s) => ({
          ...s,
          packages: (pkg || []).map((p) => ({ ...p, ticked: false, done: false })),
          editorWeeks: buildEditorWeeks(rows.find((r) => r.capId === 'CAP00010')),
          attrWeeks: buildAttrWeeks(rows.find((r) => r.capId === 'CAP00010')),
          revealed: { dec: true, auto: true },
          foldVisible: true,
          counts: {
            c1: String(tri.dec?.length ?? ''),
            c2: String(tri.auto?.length ?? ''),
          },
        }));
      } catch (e) {
        console.error(e);
        setLoadError(e?.message || 'Could not load portfolio from API. Is the backend running on port 8077?');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const editorPlanRef = useRef(null);
  useEffect(() => {
    const p = data.find((r) => r.capId === state.activePlan);
    if (!p) return;
    const switched = editorPlanRef.current !== state.activePlan;
    editorPlanRef.current = state.activePlan;
    setState((s) => ({
      ...s,
      ...(switched
        ? {
            shrDirty: false,
            doneShr: false,
            editSrc: 'plan values',
            shrLastEdit: null,
            attrDirty: false,
            doneAttr: false,
            attrLastEdit: null,
          }
        : {}),
      editorWeeks:
        switched || !s.shrDirty ? buildEditorWeeks(p) : mergeEditorWeeks(p, s.editorWeeks, true),
      attrWeeks: switched || !s.attrDirty ? buildAttrWeeks(p) : mergeAttrWeeks(p, s.attrWeeks, true),
    }));
  }, [state.activePlan, data]);

  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0;
  }, [state.view, state.filter]);

  const activePlan = useMemo(() => data.find((p) => p.capId === state.activePlan), [data, state.activePlan]);

  const setEditorWeek = (k, v) => {
    setState((s) => {
      const ew = [...s.editorWeeks];
      if (ew[k]) ew[k] = { ...ew[k], cur: clampShrink(v) };
      return { ...s, editorWeeks: ew, editSrc: 'edited by you', shrLastEdit: k, doneShr: false, shrDirty: true };
    });
  };

  const setAttrWeek = (k, v) => {
    setState((s) => {
      const aw = [...(s.attrWeeks || [])];
      if (aw[k]) aw[k] = { ...aw[k], cur: clampAttr(v) };
      return { ...s, attrWeeks: aw, attrLastEdit: k, doneAttr: false, attrDirty: true };
    });
  };

  const handleApplyAttritionValue = useCallback(() => {
    setState((s) => {
      const aw = s.attrWeeks || [];
      if (!aw.length) return s;
      const idx = s.attrLastEdit != null && aw[s.attrLastEdit] ? s.attrLastEdit : 0;
      const val = clampAttr(aw[idx].cur);
      return {
        ...s,
        attrWeeks: aw.map((w) => ({ ...w, cur: val })),
        doneAttr: false,
        attrDirty: true,
      };
    });
  }, [setState]);

  const handleApplyAttritionPct = useCallback(() => {
    setState((s) => {
      const aw = s.attrWeeks || [];
      if (!aw.length) return s;
      const idx = s.attrLastEdit != null && aw[s.attrLastEdit] ? s.attrLastEdit : 0;
      const src = aw[idx];
      const base = src.base;
      if (base == null || base === 0) {
        const val = clampAttr(src.cur);
        return {
          ...s,
          attrWeeks: aw.map((w) => ({ ...w, cur: val })),
          doneAttr: false,
          attrDirty: true,
        };
      }
      const pct = (src.cur - base) / base;
      return {
        ...s,
        attrWeeks: aw.map((w) => ({
          ...w,
          cur: clampAttr(Math.round(w.base * (1 + pct) * 100) / 100),
        })),
        doneAttr: false,
        attrDirty: true,
      };
    });
  }, [setState]);

  const handleResetAttrition = useCallback(() => {
    setState((s) => ({
      ...s,
      attrWeeks: (s.attrWeeks || []).map((w) => ({ ...w, cur: w.base })),
      doneAttr: false,
      attrDirty: false,
      attrLastEdit: null,
    }));
  }, [setState]);

  const handleApplyShrinkageValue = useCallback(() => {
    setState((s) => {
      const ew = s.editorWeeks || [];
      if (!ew.length) return s;
      const idx = s.shrLastEdit != null && ew[s.shrLastEdit] ? s.shrLastEdit : 0;
      const val = clampShrink(ew[idx].cur);
      return {
        ...s,
        editorWeeks: ew.map((w) => ({ ...w, cur: val })),
        editSrc: `applied ${val.toFixed(1)}% to all weeks`,
        doneShr: false,
        shrDirty: true,
      };
    });
  }, [setState]);

  const handleApplyShrinkagePct = useCallback(() => {
    setState((s) => {
      const ew = s.editorWeeks || [];
      if (!ew.length) return s;
      const idx = s.shrLastEdit != null && ew[s.shrLastEdit] ? s.shrLastEdit : 0;
      const src = ew[idx];
      const base = src.base;
      if (base == null || base === 0) {
        // no % vs base — fall back to absolute value apply
        const val = clampShrink(src.cur);
        return {
          ...s,
          editorWeeks: ew.map((w) => ({ ...w, cur: val })),
          editSrc: `applied ${val.toFixed(1)}% to all weeks`,
          doneShr: false,
          shrDirty: true,
        };
      }
      const pct = (src.cur - base) / base;
      return {
        ...s,
        editorWeeks: ew.map((w) => {
          const next = clampShrink(Math.round(w.base * (1 + pct) * 100) / 100);
          return { ...w, cur: next };
        }),
        editSrc: `applied ${(pct * 100 >= 0 ? '+' : '')}${(pct * 100).toFixed(1)}% to all weeks`,
        doneShr: false,
        shrDirty: true,
      };
    });
  }, [setState]);

  const handleSubmitShrinkage = useCallback(async () => {
    try {
      await api.submitShrinkage(
        stateRef.current.activePlan,
        stateRef.current.editorWeeks.map((w) => ({ week_idx: w.weekIdx, shrink_plan: w.cur })),
      );
      emit('plan.shrinkage.submitted', {
        metadata: { cap_id: stateRef.current.activePlan, week_count: stateRef.current.editorWeeks.length, success: true },
      });
      setState((s) => ({ ...s, doneShr: true, shrDirty: false, editSrc: 'plan values' }));
      await refreshPortfolio();
    } catch (e) {
      setState((s) => ({ ...s, doneShr: false }));
      emitError('plan.shrinkage.failed', e, { cap_id: stateRef.current.activePlan });
      console.error(e);
    }
  }, [setState, refreshPortfolio]);

  const handleResetShrinkage = useCallback(() => {
    setState((s) => ({
      ...s,
      editorWeeks: (s.editorWeeks || []).map((w) => ({ ...w, cur: w.base })),
      editSrc: 'plan values',
      doneShr: false,
      shrDirty: false,
      shrLastEdit: null,
    }));
  }, [setState]);

  const handleSubmitAttrition = useCallback(async () => {
    try {
      await api.submitAttrition(
        stateRef.current.activePlan,
        (stateRef.current.attrWeeks || []).map((w) => ({ week_idx: w.weekIdx, attr_plan: w.cur })),
      );
      emit('plan.attrition.submitted', {
        metadata: { cap_id: stateRef.current.activePlan, week_count: stateRef.current.attrWeeks?.length, success: true },
      });
      setState((s) => ({ ...s, doneAttr: true, attrDirty: false }));
      await refreshPortfolio();
    } catch (e) {
      setState((s) => ({ ...s, doneAttr: false }));
      emitError('plan.attrition.failed', e, { cap_id: stateRef.current.activePlan });
      console.error(e);
    }
  }, [setState, refreshPortfolio]);

  const handleSubmitForecast = useCallback(async (body) => {
    await api.submitForecast(stateRef.current.activePlan, body);
    await refreshPortfolio();
  }, [refreshPortfolio]);

  const handleSaveHeadcount = useCallback(async (body) => {
    await api.updateHeadcount(stateRef.current.activePlan, body);
    await refreshPortfolio();
  }, [refreshPortfolio]);

  const handleMapRoster = useCallback(async (capIdOrOpts, maybeBody) => {
    let id = stateRef.current.activePlan;
    let body = {};
    if (typeof capIdOrOpts === 'string') {
      id = capIdOrOpts;
      body = maybeBody || {};
    } else if (capIdOrOpts && typeof capIdOrOpts === 'object') {
      body = capIdOrOpts;
      id = capIdOrOpts.cap_id || capIdOrOpts.capId || id;
    }
    const payload = {
      ...(body.class_id != null ? { class_id: body.class_id } : {}),
      ...(body.train_hc != null ? { train_hc: body.train_hc } : {}),
      ...(body.employees ? { employees: body.employees } : {}),
      ...(body.source_filename ? { source_filename: body.source_filename } : {}),
    };
    try {
      const res = await api.mapRoster(id, payload);
      setState((s) => ({ ...s, doneRoster: true }));
      emit('plan.roster.mapped', {
        metadata: { cap_id: id, success: true, mapped_fte: res?.mapped_fte, status: res?.status },
      });
      await refreshPortfolio();
      return res;
    } catch (e) {
      emitError('plan.roster.failed', e, { cap_id: id });
      console.error(e);
      setState((s) => ({ ...s, doneRoster: false }));
      throw e;
    }
  }, [setState, refreshPortfolio]);

  const handleAcceptRec = useCallback(async () => {
    const capId = stateRef.current.activePlan;
    const plan = data.find((p) => p.capId === capId);
    if (!plan) return;

    const { rec, timing, donors, weekly, donorNote, hireNote, otHrs } = buildStaffingPackage(
      plan,
      capId,
      planDecisions,
      otWeeksByCap,
      data,
    );

    try {
      const pkg = await api.upsertPackage({
        cap_id: capId,
        ot_hrs: otHrs,
        ot_weeks: weekly.map((v) => Number(v) || 0),
        ot_fte: rec.otFTE,
        xu_fte: rec.xr,
        hire_count: rec.starts,
        train_wk: timing.trainWk,
        nest_wk: timing.nestWk,
        donors,
        description: `OT ${otHrs.toFixed(2)} hrs/wk · loan ${Number(rec.xr).toFixed(2)} FTE${donorNote}${hireNote} · accepted`,
      });
      emit('recommend.accepted', {
        metadata: {
          cap_id: capId,
          package_id: pkg?.id,
          ot_hrs: otHrs,
          ot_weeks: weekly,
          ot_fte: rec.otFTE,
          xu_fte: rec.xr,
          hire_count: rec.starts,
          train_wk: timing.trainWk,
          nest_wk: timing.nestWk,
          donors,
        },
      });
      setState((s) => {
        const mapped = { ...pkg, ticked: true, done: false };
        const idx = s.packages.findIndex((p) => p.id === pkg.id);
        let packages;
        if (idx >= 0) {
          packages = s.packages.map((p, i) => (i === idx ? mapped : p));
        } else {
          packages = [
            ...s.packages.filter((p) => !(p.cap_id === capId && !p.done)),
            mapped,
          ];
        }
        const shownTabs = s.shownTabs.includes('exe') ? s.shownTabs : [...s.shownTabs, 'exe'];
        return {
          ...s,
          doneRec: true,
          packages,
          activeTab: 'exe',
          shownTabs,
          execDone: false,
          execMsg: '',
        };
      });
      setPlanDecisions((d) => ({
        ...d,
        [capId]: { ...(d[capId] || {}), rec: 'acc' },
      }));
    } catch (e) {
      emitError('recommend.accept.failed', e, { cap_id: capId });
      console.error(e);
      setState((s) => ({
        ...s,
        execMsg: e.message || 'Failed to queue package',
      }));
    }
  }, [data, planDecisions, otWeeksByCap, setState]);

  const handleRejectRec = useCallback(async () => {
    const capId = stateRef.current.activePlan;
    const pkg = stateRef.current.packages.find(
      (p) => p.cap_id === capId && !p.done && p.status !== 'posted',
    );
    try {
      if (pkg?.id) await api.patchPackage(pkg.id, { status: 'rejected' });
    } catch (e) {
      console.error(e);
    }
    setState((s) => ({
      ...s,
      doneRec: false,
      execDone: false,
      execMsg: '',
      packages: s.packages.filter((p) => !(p.cap_id === capId && p.status !== 'posted')),
    }));
    setPlanDecisions((d) => ({
      ...d,
      [capId]: { ...(d[capId] || {}), rec: 'rej' },
    }));
  }, []);

  const handleRecOverride = useCallback((patch) => {
    const capId = stateRef.current.activePlan;
    setPlanDecisions((d) => ({
      ...d,
      [capId]: {
        ...(d[capId] || {}),
        rec: 'mod',
        recOvr: { ...(d[capId]?.recOvr || {}), ...patch },
      },
    }));
  }, []);

  const handleDecide = useCallback((kind, sub, mode) => {
    const capId = stateRef.current.activePlan;
    setPlanDecisions((d) => {
      const cur = { ...(d[capId] || {}) };
      if (kind === 'shr') cur.shr = mode;
      else if (kind === 'fw') cur.fw = { ...(cur.fw || {}), [sub]: mode };
      else if (kind === 'rec') cur.rec = mode;
      else if (kind === 'att') cur.att = mode;
      return { ...d, [capId]: cur };
    });
    if (kind === 'shr' && (mode === 'acc' || mode === 'mod')) {
      setState((s) => ({ ...s, editorReady: true, chartShr: { capId, ready: true } }));
    }
  }, [setState]);

  const handleOtWeekChange = useCallback((idx, value) => {
    const capId = stateRef.current.activePlan;
    const plan = data.find((p) => p.capId === capId);
    if (!plan) return;
    const n = fwdCount(plan);
    setOtWeeksByCap((prev) => {
      const base = prev[capId]?.length === n ? [...prev[capId]] : Array(n).fill(defaultOtWeekly(plan));
      base[idx] = value;
      return { ...prev, [capId]: base };
    });
  }, [data]);

  const handleOpenQueue = useCallback(() => {
    setState((s) => ({ ...s, view: 'queue', revealed: { ...s.revealed, pkg: true } }));
  }, []);

  const handleSelectAllPackages = useCallback(() => {
    setState((s) => ({
      ...s,
      packages: s.packages.map((p) => (p.done ? p : { ...p, ticked: true })),
    }));
  }, []);

  const handleClearPackages = useCallback(() => {
    setState((s) => ({
      ...s,
      packages: s.packages.map((p) => ({ ...p, ticked: false })),
    }));
  }, []);

  const handleExecuteSelected = useCallback(async () => {
    const ticked = stateRef.current.packages.filter((p) => p.ticked && !p.done);
    const ids = ticked.map((p) => p.id).filter(Boolean);
    let message = 'No packages selected.';
    let ok = false;
    if (ids.length) {
      try {
        const res = await api.executeQueue(ids);
        message = res?.message || `Posted ${ids.length} package(s) · staffing applied`;
        ok = true;
        emit('queue.executed', {
          metadata: {
            package_ids: ids,
            count: ids.length,
            success: true,
            applied: res?.applied,
          },
        });
      } catch (e) {
        emitError('queue.execute.failed', e, { package_ids: ids });
        console.error(e);
        message = e.message || 'Execute failed';
      }
    }
    setState((s) => ({
      ...s,
      execDone: ok,
      execMsg: message,
      packages: ok
        ? s.packages.map((p) =>
            ids.includes(p.id) ? { ...p, done: true, status: 'posted', ticked: false } : p,
          )
        : s.packages,
    }));
    if (ok) await refreshPortfolio();
    return { message };
  }, [setState, refreshPortfolio]);

  const handleExecutePlan = useCallback(async () => {
    const capId = stateRef.current.activePlan;
    if (!stateRef.current.doneRec) {
      return { message: 'No approved package yet — accept a recommendation first.' };
    }
    let match = stateRef.current.packages.find((p) => p.cap_id === capId && !p.done && p.status !== 'rejected');
    if (!match?.id) {
      const plan = data.find((p) => p.capId === capId);
      if (!plan) {
        return { message: `No plan loaded for ${capId}` };
      }
      try {
        const { rec, timing, donors, weekly, otHrs } = buildStaffingPackage(
          plan,
          capId,
          planDecisions,
          otWeeksByCap,
          data,
        );
        match = await api.upsertPackage({
          cap_id: capId,
          ot_hrs: otHrs,
          ot_weeks: weekly.map((v) => Number(v) || 0),
          ot_fte: rec.otFTE,
          xu_fte: rec.xr,
          hire_count: rec.starts,
          train_wk: timing.trainWk,
          nest_wk: timing.nestWk,
          donors,
        });
      } catch (e) {
        console.error(e);
        return { message: e.message || `No queued package for ${capId}` };
      }
    }
    let message = '';
    let ok = false;
    try {
      const res = await api.executeQueue([match.id]);
      message = res?.message || `Posted 1 package · staffing applied`;
      ok = true;
    } catch (e) {
      console.error(e);
      message = e.message || 'Execute failed';
    }
    setState((s) => ({
      ...s,
      execDone: ok,
      execMsg: message,
      packages: ok
        ? s.packages.map((p) =>
            p.id === match.id || p.cap_id === capId
              ? { ...p, ...match, done: true, status: 'posted', ticked: false }
              : p,
          )
        : s.packages,
    }));
    if (ok) await refreshPortfolio();
    return { message };
  }, [data, planDecisions, otWeeksByCap, setState, refreshPortfolio]);

  const openCreatePlan = useCallback((agentMode = false) => {
    setState((s) => {
      const draft = EMPTY_CREATE_PLAN_DRAFT();
      if (!agentMode && s.filter !== 'all') {
        draft.program = s.filter;
      }
      return {
        ...s,
        view: 'port',
        createPlan: {
          open: true,
          agentMode: Boolean(agentMode),
          draft,
          highlightField: agentMode ? 'program' : null,
          openSelect: null,
          busy: false,
          error: '',
        },
      };
    });
  }, [setState]);

  const closeCreatePlan = useCallback(() => {
    setState((s) => ({
      ...s,
      createPlan: {
        open: false,
        agentMode: false,
        draft: EMPTY_CREATE_PLAN_DRAFT(),
        highlightField: null,
        openSelect: null,
        busy: false,
        error: '',
      },
    }));
  }, [setState]);

  const setCreatePlanField = useCallback((field, value, { finalize = true } = {}) => {
    const key = apiFieldToDraftKey(field);
    const nextVal = finalize ? String(value ?? '').trim() : String(value ?? '');
    flushSync(() => {
      setState((s) => {
        const draft = { ...s.createPlan.draft, [key]: nextVal };
        return {
          ...s,
          createPlan: {
            ...s.createPlan,
            open: true,
            draft,
            highlightField: finalize ? nextCreatePlanField(draft) : key,
            openSelect: finalize ? null : s.createPlan.openSelect,
          },
        };
      });
    });
  }, [setState]);

  const openCreatePlanSelect = useCallback((key) => {
    flushSync(() => {
      setState((s) => ({
        ...s,
        createPlan: {
          ...s.createPlan,
          openSelect: key,
          highlightField: key,
        },
      }));
    });
  }, [setState]);

  const closeCreatePlanSelect = useCallback(() => {
    flushSync(() => {
      setState((s) => ({
        ...s,
        createPlan: { ...s.createPlan, openSelect: null },
      }));
    });
  }, [setState]);

  const submitCreatePlan = useCallback(async () => {
    const cp = stateRef.current.createPlan;
    const payload = createPlanPayload(cp.draft);
    if (!payload.program || !payload.plan_name || !payload.site || !payload.lob) {
      setState((s) => ({
        ...s,
        createPlan: {
          ...s.createPlan,
          error: 'Organization, plan name, site, and LOB are required.',
        },
      }));
      return null;
    }
    setState((s) => ({ ...s, createPlan: { ...s.createPlan, busy: true, error: '' } }));
    try {
      const res = await api.createPlan(payload);
      emit('plan.created', { metadata: { cap_id: res.cap_id, plan_name: res.plan_name } });
      setState((s) => ({
        ...s,
        createPlan: {
          open: false,
          agentMode: false,
          draft: EMPTY_CREATE_PLAN_DRAFT(),
          highlightField: null,
          openSelect: null,
          busy: false,
          error: '',
        },
      }));
      await refreshPortfolio();
      const capId = res.cap_id;
      setTimeout(() => domHandlersRef.current.openPlan?.(capId), 120);
      return res;
    } catch (e) {
      setState((s) => ({
        ...s,
        createPlan: {
          ...s.createPlan,
          busy: false,
          error: e.message || 'Failed to create plan',
        },
      }));
      return null;
    }
  }, [refreshPortfolio]);

  domHandlersRef.current = {
    setFilter: (prog) => {
      emit('filter.changed', { metadata: { program: prog } });
      setState((s) => ({ ...s, filter: prog, view: 'port', focusCap: null }));
    },
    openPlan: (capId) => {
      emit('plan.opened', { metadata: { cap_id: capId, source: 'user', view: 'plan' } });
      const p = data.find((r) => r.capId === capId);
      const rosterOk =
        p?.cls?.status === 'mapped' || p?.cls?.status === 'uploaded';
      const queuedPkg = stateRef.current.packages.find(
        (pkg) => pkg.cap_id === capId && pkg.status === 'queued' && !pkg.done,
      );
      setState((s) => ({
        ...s,
        view: 'plan',
        activePlan: capId,
        focusCap: capId,
        activeTab: 'ov',
        shownTabs: ['ov'],
        editorWeeks: p ? buildEditorWeeks(p) : s.editorWeeks,
        attrWeeks: p ? buildAttrWeeks(p) : s.attrWeeks,
        editorReady: true,
        chartOU: { capId, ready: true, mark: 8, lbl: '' },
        chartShr: { capId, ready: true },
        doneRec: Boolean(queuedPkg),
        doneShr: false,
        shrDirty: false,
        doneAttr: false,
        attrDirty: false,
        doneRoster: rosterOk,
      }));
      if (p) {
        setOtWeeksByCap((prev) => {
          const n = fwdCount(p);
          if (queuedPkg?.ot_weeks?.length === n) {
            return { ...prev, [capId]: queuedPkg.ot_weeks.map((v) => Number(v) || 0) };
          }
          return {
            ...prev,
            [capId]: prev[capId]?.length === n ? prev[capId] : Array(n).fill(defaultOtWeekly(p)),
          };
        });
      }
    },
    openTab: (tab) => {
      emit('tab.changed', { metadata: { cap_id: stateRef.current.activePlan, active_tab: tab, view: 'plan' } });
      setState((s) => ({
        ...s,
        view: 'plan',
        activeTab: tab,
        shownTabs: s.shownTabs.includes(tab) ? s.shownTabs : [...s.shownTabs, tab],
        editorReady: tab === 'shr' || tab === 'ov' ? true : s.editorReady,
      }));
    },
    view: (v) => {
      emit('view.changed', { metadata: { from_view: stateRef.current.view, to_view: v, cap_id: stateRef.current.activePlan } });
      setState((s) => ({
        ...s,
        view: v,
        ...(v === 'queue' ? { revealed: { ...s.revealed, pkg: true } } : {}),
      }));
    },
    mapRoster: handleMapRoster,
    submitShrinkage: handleSubmitShrinkage,
    acceptRec: handleAcceptRec,
    rejectRec: handleRejectRec,
    selectAllPackages: handleSelectAllPackages,
    clearPackages: handleClearPackages,
    executeSelected: handleExecuteSelected,
    executePlan: handleExecutePlan,
    openCreatePlan,
    closeCreatePlan,
    setCreatePlanField,
    openCreatePlanSelect,
    closeCreatePlanSelect,
    submitCreatePlan,
    togglePackage: (capId) => {
      setState((s) => ({
        ...s,
        packages: s.packages.map((p) =>
          p.cap_id === capId && !p.done ? { ...p, ticked: !p.ticked } : p,
        ),
      }));
    },
  };

  const togglePackage = (capId) => {
    engine.markHumanActive();
    setState((s) => ({
      ...s,
      packages: s.packages.map((p) => (p.cap_id === capId ? { ...p, ticked: !p.ticked } : p)),
    }));
  };

  const ticked = state.packages.filter((p) => p.ticked);
  const qOT = ticked.reduce((a, p) => a + (p.ot_hrs || 0), 0);
  const qXU = ticked.reduce((a, p) => a + (p.xu_fte || 0), 0);
  const qHR = ticked.reduce((a, p) => a + (p.hire_count || 0), 0);
  const qOTn = ticked.filter((p) => p.ot_hrs > 0).length;
  const qXUn = ticked.filter((p) => p.xu_fte > 0).length;
  const qHRn = ticked.filter((p) => p.hire_count > 0).length;

  const handleTabClick = (k) => {
    emit('tab.changed', { metadata: { cap_id: state.activePlan, active_tab: k, view: 'plan' } });
    setState((s) => ({
      ...s,
      activeTab: k,
      shownTabs: s.shownTabs.includes(k) ? s.shownTabs : [...s.shownTabs, k],
    }));
  };

  if (loading) {
    return (
      <div className="copilot-app">
        <div className="app-loading">Loading portfolio from database…</div>
      </div>
    );
  }

  const isLanding = state.view === 'port';
  const xutil = computeXutil(data);

  return (
    <div className="copilot-app">
      <div className="topbar">
        <div className="logo">
          <img className="dn-logo" alt="" src={v4DnLogo} />
        </div>
        <div className="brandname">
          CAP-<b>ABILITY</b>
        </div>
        <div className="crumbs" style={{ marginLeft: 6 }}>
          <span>Planning Workspace</span>
          <span className="sep">›</span>
          <span>1OS World</span>
          <span className="sep">›</span>
          <span className="cur">Planning Co-Pilot</span>
        </div>
        <div className="spacer" />
        <div className="plchip">
          <span className="dot" />
          Multi-plan · {cycleLabel}
        </div>
        <div className="iconbtn" aria-hidden>
          🔍
        </div>
        <div className="avatar" aria-hidden>
          MS
        </div>
      </div>

      <main className="copilot-main">
        <div className="wrap" style={{ maxWidth: 1320 }}>
          {loadError ? (
            <div className="insight neg" style={{ marginBottom: 14 }}>
              <div className="ico">!</div>
              <div className="tx">
                <b>Backend connection failed.</b> {loadError}
                <small>Start the API from the backend folder: uvicorn app.main:app --reload --port 8077</small>
              </div>
            </div>
          ) : null}
          {isLanding ? (
            <div className="pilot-head">
              <div className="pilot-badge">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3l1.6 4.9H19l-4 3 1.5 4.9-4.5-3-4.5 3L9 10.9l-4-3h5.4L12 3z"
                    fill="#f5a623"
                  />
                </svg>
              </div>
              <div>
                <h1>Planning Co-Pilot</h1>
                <p>
                  A card per CAP plan with its 12-week outlook · week of <b>{cycleLabel.replace(/^Week of /i, '')}</b> ·
                  click a card to open the plan&apos;s full guided analysis.
                </p>
              </div>
              <div className="live">
                <span className="pulse" />
                Co-Pilot active
              </div>
            </div>
          ) : null}

          {!isLanding ? (
            <div id="backbar" className="backbar-v4">
              <div className="bc-left">
                <button
                  type="button"
                  className="btn-back"
                  onClick={() => {
                    engine.markHumanActive();
                    domHandlersRef.current.view?.('port');
                  }}
                >
                  ← All plans
                </button>
                {activePlan ? (
                  <span className="bc-plan">
                    <span className="capchip">{activePlan.capId}</span> <b>{activePlan.plan}</b>{' '}
                    <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>· detailed analysis</span>
                  </span>
                ) : null}
              </div>
              <div className="mini-stepper">
                {WORKFLOW_STEPS.filter((s) => !activePlan || tabsForPlan(activePlan).includes(s.key)).map((s, i, arr) => {
                  const tabIdx = arr.findIndex((x) => x.key === state.activeTab);
                  const thisIdx = arr.findIndex((x) => x.key === s.key);
                  const done = thisIdx < tabIdx;
                  const active = s.key === state.activeTab;
                  return (
                    <span key={s.key} style={{ display: 'contents' }}>
                      <button
                        type="button"
                        className={`ms-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                        onClick={() => {
                          engine.markHumanActive();
                          handleTabClick(s.key);
                          setState((st) => ({ ...st, view: 'plan' }));
                        }}
                      >
                        <span className="num">{i + 1}</span>
                        <span className="lbl">{s.label}</span>
                      </button>
                      {i < arr.length - 1 ? <span className="ms-conn" /> : null}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className={`appgrid ${isLanding ? 'landing' : 'workflow'}`}>
            {!isLanding ? (
              <PlanRail
                plans={filteredData}
                activeCapId={state.activePlan}
                onSelectPlan={(capId) => {
                  engine.markHumanActive();
                  domHandlersRef.current.openPlan?.(capId);
                }}
                onBackToPortfolio={() => {
                  engine.markHumanActive();
                  domHandlersRef.current.view?.('port');
                }}
              />
            ) : null}

            <div
              className="stage-v4"
              ref={workspaceRef}
              onPointerDownCapture={() => engine.markHumanActive()}
              onKeyDownCapture={() => engine.markHumanActive()}
            >
              <AgentCursor cursor={engine.cursor} />

              <CreatePlanPanel
                open={state.createPlan.open}
                draft={state.createPlan.draft}
                agentMode={state.createPlan.agentMode}
                highlightField={state.createPlan.highlightField}
                openSelect={state.createPlan.openSelect}
                busy={state.createPlan.busy}
                error={state.createPlan.error}
                programOptions={programs}
                onChange={(key, val) => setCreatePlanField(key, val)}
                onSubmit={submitCreatePlan}
                onClose={closeCreatePlan}
              />

              <div className="stage-body" ref={paneRef}>
                {state.view === 'port' && (
                  <PortfolioLanding
                    plans={filteredData}
                    programs={programs}
                    filter={state.filter}
                    search={searchQuery}
                    region={portRegion}
                    vertical={portVertical}
                    statusFilter={portStatus}
                    recsByCap={portfolioRecs.byCap}
                    packages={state.packages}
                    gotBy={xutil.gotBy}
                    onFilterChange={(patch) => {
                      if (patch.search != null) setSearchQuery(patch.search);
                      if (patch.region != null) setPortRegion(patch.region);
                      if (patch.vertical != null) setPortVertical(patch.vertical);
                      if (patch.status != null) setPortStatus(patch.status);
                    }}
                    onExecPortfolio={() => {
                      engine.markHumanActive();
                      domHandlersRef.current.view?.('queue');
                    }}
                    onOpenPlan={(capId) => {
                      engine.markHumanActive();
                      domHandlersRef.current.openPlan?.(capId);
                    }}
                  />
                )}

                {state.view === 'plan' && activePlan && (
                  <div className="panel workflow-panel">
                    <PlanTabs
                      activeTab={state.activeTab}
                      plan={activePlan}
                      state={state}
                      allPlans={data}
                      decisions={planDecisions[activePlan.capId] || {}}
                      otWeeks={otWeeksByCap[activePlan.capId] || []}
                      onEditorChange={setEditorWeek}
                      onSubmitShrinkage={handleSubmitShrinkage}
                      onResetShrinkage={handleResetShrinkage}
                      onApplyShrinkageValue={handleApplyShrinkageValue}
                      onApplyShrinkagePct={handleApplyShrinkagePct}
                      onSubmitAttrition={handleSubmitAttrition}
                      onResetAttrition={handleResetAttrition}
                      onApplyAttritionValue={handleApplyAttritionValue}
                      onApplyAttritionPct={handleApplyAttritionPct}
                      onAttritionChange={setAttrWeek}
                      onSubmitForecast={handleSubmitForecast}
                      onSaveHeadcount={handleSaveHeadcount}
                      onMapRoster={handleMapRoster}
                      onAcceptRec={handleAcceptRec}
                      onRejectRec={handleRejectRec}
                      onOpenQueue={handleOpenQueue}
                      onDecide={handleDecide}
                      onOtWeekChange={handleOtWeekChange}
                      onExecutePlan={handleExecutePlan}
                      onRecOverride={handleRecOverride}
                    />
                  </div>
                )}

                {state.view === 'queue' && (
                  <div className="panel workflow-panel">
                    <div className="panel-head">
                      <div className="ic">🚀</div>
                      <div>
                        <h2>Review &amp; execute</h2>
                        <p>Accepted recommendations queue here for execution.</p>
                      </div>
                    </div>
                    <div className="panel-body">
                      <div className="qcards">
                        <div className="qc">
                          <span className="ic" style={{ background: '#3B6FB5' }}>
                            ⏱
                          </span>
                          <div>
                            <div className="t">Overtime authorizations</div>
                            <div className="s">{qOTn} plans</div>
                          </div>
                          <span className="v" style={{ color: '#3B6FB5' }}>
                            {f2(qOT)} hrs
                          </span>
                        </div>
                        <div className="qc">
                          <span className="ic" style={{ background: '#2E7D5B' }}>
                            ⇄
                          </span>
                          <div>
                            <div className="t">Cross-util / loans</div>
                            <div className="s">{qXUn} donor plans</div>
                          </div>
                          <span className="v" style={{ color: '#2E7D5B' }}>
                            {f2(qXU)} FTE
                          </span>
                        </div>
                        <div className="qc">
                          <span className="ic" style={{ background: '#F5B01A', color: '#1C1B18' }}>
                            🎓
                          </span>
                          <div>
                            <div className="t">New hire requisitions</div>
                            <div className="s">{qHRn} plans</div>
                          </div>
                          <span className="v" style={{ color: '#8A6100' }}>
                            {qHR} agents
                          </span>
                        </div>
                      </div>
                      <div className="selbar" style={{ marginTop: 14 }}>
                        <b>{filteredPackages.filter((p) => p.ticked).length} of {filteredPackages.length}</b> selected ·
                        <span className="mini" onClick={() => handleSelectAllPackages()}>
                          Select all
                        </span>
                        <span className="mini" onClick={() => handleClearPackages()}>
                          Clear
                        </span>
                      </div>
                      <div id="pkgList">
                        {filteredPackages.map((p) => (
                          <div
                            key={p.id}
                            className={`pkg in ${p.ticked ? 'tick' : ''} ${p.done ? 'done' : ''}`}
                            data-cap={p.cap_id}
                            onClick={() => togglePackage(p.cap_id)}
                          >
                            <span className="cbx" />
                            <div>
                              <div className="nm">
                                <span className="pill">{p.cap_id}</span>
                                {p.plan_name || p.cap_id}
                              </div>
                              <div className="sub">{p.description || `OT ${f2(p.ot_hrs)} hrs · loan ${f2(p.xu_fte)} FTE`}</div>
                            </div>
                            <span className="st">{p.status === 'posted' ? 'Posted' : 'Queued'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="acts" style={{ marginTop: 12 }}>
                        <button type="button" className="btn btn-primary" onClick={() => handleExecuteSelected()}>
                          Execute selected →
                        </button>
                      </div>
                      <div className={`done ${state.execDone ? 'on' : ''}`}>
                        <span>✓</span>
                        <span>Packages posted to CAP-ABILITY</span>
                      </div>
                    </div>
                  </div>
                )}

                {state.view === 'time' && (
                  <div className="panel workflow-panel">
                    <div className="panel-body">
                      <div className="ledger">
                        <div id="ledRows">
                          {ledger.map((l) => (
                            <div key={l.id} className="lrow in">
                              <span>{l.label}</span>
                              <span className="hr">{hm(l.minutes)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="memlist">
                        {memories.map((m) => (
                          <div key={m.id} className={`mem ${state.memoriesCited ? 'cite' : ''}`}>
                            <div className="k">{m.rule_text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
