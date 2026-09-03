import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { f1, f2 } from '../utils/format';

function seriesColor(series, v, i) {
  if (!series) return '#2a78d6';
  return typeof series.color === 'function' ? series.color(v, i) : series.color || '#2a78d6';
}

/** Pick x-axis week indices with enough horizontal gap to avoid overlapping MM/DD labels. */
function xTickIndices(n, bw, minLabelPx = 44, xTickStep = null) {
  if (n <= 0) return [];
  if (n === 1) return [0];
  if (xTickStep != null && xTickStep > 0) {
    const indices = [];
    for (let i = 0; i < n; i += xTickStep) indices.push(i);
    const last = n - 1;
    if (indices[indices.length - 1] !== last) indices.push(last);
    return indices;
  }
  const step = Math.max(1, Math.ceil(minLabelPx / Math.max(bw, 1)));
  const indices = [];
  for (let i = 0; i < n; i += step) indices.push(i);
  const last = n - 1;
  const prev = indices[indices.length - 1];
  if (prev !== last) {
    if ((last - prev) * bw < minLabelPx * 0.6) indices[indices.length - 1] = last;
    else indices.push(last);
  }
  return indices;
}

function hoverItems(bars, line, overlayLine, i, yFmt, valueUnit) {
  const unit = valueUnit ? ` ${valueUnit}` : '';
  const items = [];
  (bars || []).forEach((series) => {
    const v = series.data?.[i];
    if (v == null) return;
    items.push({
      label: series.tipLabel || series.label || 'O/U',
      text: `${yFmt(v)}${unit}`,
      color: seriesColor(series, v, i),
    });
  });
  const ov = overlayLine?.data?.[i];
  if (ov != null) {
    items.push({
      label: overlayLine.tipLabel || overlayLine.label || 'Actual',
      text: `${yFmt(ov)}${unit}`,
      color: overlayLine.color || '#2a78d6',
    });
  }
  const lv = line?.data?.[i];
  if (lv != null) {
    items.push({
      label: line.tipLabel || line.label || 'Plan',
      text: `${yFmt(lv)}${unit}`,
      color: line.color || '#c98aa0',
    });
  }
  return items;
}

/** Generic SVG bar (+ optional draggable line) series chart. */
export default function SeriesChart({
  weeks = [],
  curIdx = 0,
  bars = [],
  line = null,
  overlayLine = null,
  yFmt = (v) => f1(v),
  tipFmt = null,
  height = 200,
  markThisWeek = true,
  zeroLine = false,
  /** Allow dragging line points from this index (usually curIdx). */
  dragFromIdx = null,
  dragUntilIdx = null,
  onDragPoint = null,
  snap = 0.5,
  minV = 0,
  maxV = 95,
  valueUnit = '',
  thinBars = true,
  /** Chart.js barPercentage × categoryPercentage (landing O/U uses 0.6 × 0.82). */
  barRatio = null,
  /** Fixed corner radius; omit for pill-shaped bars. */
  barRadius = null,
  /** Remove wrapper top margin (landing chartbox). */
  flush = false,
  dragHint = null,
  hideDragHint = false,
  /** Horizontal guide line at a fixed Y value, e.g. target attrition rate. */
  guideLine = null,
  /** Fixed Y-axis scale, e.g. { min: 0, max: 35, step: 5 } for shrinkage %. */
  fixedYScale = null,
  /** Force x-axis label every N weeks (e.g. 2 for biweekly). */
  xTickStep = null,
  /** v4 reference styling (grid, labels, THIS WK marker). */
  chartTheme = null,
  thisWeekLabel = null,
  /** Extra left margin for %-axis labels (attrition). */
  marginLeft = null,
  /** Stretch chart to container width (Chart.js-style responsive). */
  responsive = false,
}) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [containerW, setContainerW] = useState(0);
  const dragIdxRef = useRef(null);
  const onDragRef = useRef(onDragPoint);
  onDragRef.current = onDragPoint;
  const [dragIdx, setDragIdx] = useState(null);
  const lineData = line?.data || null;
  const overlayData = overlayLine?.data || null;

  useLayoutEffect(() => {
    if (!responsive) return;
    const el = wrapRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (w > 0) setContainerW(Math.round(w));
  }, [responsive]);

  useEffect(() => {
    if (!responsive) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w > 0) setContainerW(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive]);

  const n = weeks.length || bars[0]?.data?.length || lineData?.length || overlayData?.length || 0;
  const layout = useMemo(() => {
    if (!n) return null;
    const W = responsive && containerW > 0 ? containerW : 640;
    const H = height;
    const L = marginLeft ?? (fixedYScale?.step != null && fixedYScale.step < 1 ? 50 : 44);
    const R = 12;
    const T = 18;
    const B = 30;
    const vals = [];
    bars.forEach((b) => (b.data || []).forEach((v) => v != null && vals.push(v)));
    if (lineData) lineData.forEach((v) => v != null && vals.push(v));
    if (overlayData) overlayData.forEach((v) => v != null && vals.push(v));
    if (!vals.length) vals.push(0);
    if (zeroLine) vals.push(0);
    // keep headroom while dragging
    if (dragFromIdx != null) {
      vals.push(minV, maxV);
    }
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const pad = (mx - mn) * 0.12 || 1;
    const lo = fixedYScale ? (fixedYScale.min ?? 0) : mn - pad;
    const hi = fixedYScale ? (fixedYScale.max ?? mx + pad) : mx + pad;
    const Y = (x) => T + ((H - T - B) * (1 - (x - lo) / (hi - lo || 1)));
    const fromY = (py) => {
      const t = (py - T) / (H - T - B || 1);
      return hi - t * (hi - lo);
    };
    const bw = (W - L - R) / n;
    return { W, H, L, R, T, B, lo, hi, Y, fromY, bw, zy: Y(0) };
  }, [n, height, bars, lineData, overlayData, zeroLine, dragFromIdx, minV, maxV, responsive, containerW, fixedYScale, marginLeft]);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const valueFromClientY = useCallback(
    (clientY) => {
      const lay = layoutRef.current;
      if (!svgRef.current || !lay) return null;
      const rect = svgRef.current.getBoundingClientRect();
      const py = ((clientY - rect.top) / rect.height) * lay.H;
      let v = lay.fromY(py);
      if (v < minV) v = minV;
      if (v > maxV) v = maxV;
      v = Math.round(v / snap) * snap;
      return Math.round(v * 100) / 100;
    },
    [minV, maxV, snap],
  );

  const endDrag = useCallback(() => {
    dragIdxRef.current = null;
    setDragIdx(null);
  }, []);

  const pickHoverIndex = useCallback(
    (clientX) => {
      const lay = layoutRef.current;
      const count = weeks.length;
      if (!svgRef.current || !lay || !count) return null;
      const rect = svgRef.current.getBoundingClientRect();
      if (!rect.width) return null;
      const svgX = ((clientX - rect.left) / rect.width) * lay.W;
      const i = Math.floor((svgX - lay.L) / lay.bw);
      if (i < 0 || i >= count) return null;
      return i;
    },
    [weeks.length],
  );

  const handleSvgMouseMove = useCallback(
    (e) => {
      if (dragIdxRef.current != null) return;
      setHoverI(pickHoverIndex(e.clientX));
    },
    [pickHoverIndex],
  );

  const handleSvgMouseLeave = useCallback(() => {
    if (dragIdxRef.current == null) setHoverI(null);
  }, []);

  const onDragStart = (i, e) => {
    if (dragFromIdx == null || i < dragFromIdx || !onDragRef.current) return;
    if (dragUntilIdx != null && i > dragUntilIdx) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    // pointerdown + mousedown both fire in some browsers — only start once
    if (dragIdxRef.current != null) return;
    e.preventDefault();
    e.stopPropagation();
    dragIdxRef.current = i;
    setDragIdx(i);
    setHoverI(null);

    // Listen for both pointer + mouse moves (Playwright / some browsers only emit one)
    const move = (ev) => {
      if (dragIdxRef.current == null) return;
      const v = valueFromClientY(ev.clientY);
      if (v != null) onDragRef.current?.(dragIdxRef.current, v);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('pointercancel', up);
      endDrag();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('mousemove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('mouseup', up);
    window.addEventListener('pointercancel', up);
  };

  const [hoverI, setHoverI] = useState(null);

  if (!n || !layout) return null;
  const { W, H, L, R, T, B, lo, Y, bw, zy } = layout;
  const canDrag = dragFromIdx != null && typeof onDragPoint === 'function';
  const ratio = barRatio ?? (thinBars ? 0.18 : 0.56);
  const barW = thinBars ? Math.max(2.2, Math.min(4.2, bw * ratio)) : bw * ratio;
  const barRx = barRadius != null ? Math.min(barRadius, barW / 2) : barW / 2;
  const hoverTips = hoverI == null ? [] : hoverItems(bars, line, overlayLine, hoverI, tipFmt || yFmt, valueUnit);
  const xTicks = xTickIndices(n, bw, 44, xTickStep);
  const weekMarker =
    thisWeekLabel ?? (chartTheme === 'v4' ? 'THIS WK' : 'THIS WEEK');
  const hoverX = hoverI != null ? L + bw * hoverI + bw * 0.5 : 0;
  let hoverAnchorY = T + 24;
  if (hoverI != null) {
    const vals = [];
    bars.forEach((b) => {
      const v = b.data?.[hoverI];
      if (v != null) vals.push(v);
    });
    if (overlayData?.[hoverI] != null) vals.push(overlayData[hoverI]);
    if (lineData?.[hoverI] != null) vals.push(lineData[hoverI]);
    if (vals.length) hoverAnchorY = Y(vals.reduce((s, v) => s + v, 0) / vals.length);
  }

  const grid = [];
  if (fixedYScale?.step) {
    const ymin = fixedYScale.min ?? lo;
    const ymax = fixedYScale.max ?? hi;
    const step = fixedYScale.step;
    const count = Math.max(0, Math.round((ymax - ymin) / step));
    for (let t = 0; t <= count; t++) {
      const vv = Math.round((ymin + t * step) * 1000) / 1000;
      const yy = Y(vv);
      grid.push(
        <g key={`y${t}`}>
          <line className="gl" x1={L} y1={yy} x2={W - R} y2={yy} />
          <text className="al" x={L - 6} y={yy + 3} textAnchor="end">
            {yFmt(vv)}
          </text>
        </g>,
      );
    }
  } else {
    for (let t = 0; t <= 4; t++) {
      const vv = lo + ((layout.hi - lo) * t) / 4;
      const yy = Y(vv);
      grid.push(
        <g key={t}>
          <line className="gl" x1={L} y1={yy} x2={W - R} y2={yy} />
          <text className="al" x={L - 6} y={yy + 3} textAnchor="end">
            {yFmt(vv)}
          </text>
        </g>,
      );
    }
  }

  let overlayPath = '';
  if (overlayData) {
    const pts = overlayData
      .map((v, i) => (v == null ? null : `${L + bw * i + bw * 0.5},${Y(v)}`))
      .filter(Boolean);
    overlayPath = pts.length ? `M ${pts.join(' L ')}` : '';
  }

  let linePath = '';
  if (lineData) {
    const pts = lineData
      .map((v, i) => (v == null ? null : `${L + bw * i + bw * 0.5},${Y(v)}`))
      .filter(Boolean);
    linePath = pts.length ? `M ${pts.join(' L ')}` : '';
  }

  return (
    <div
      ref={wrapRef}
      className={`chart on ${canDrag ? 'draggable-chart' : ''}${flush ? ' chart-flush' : ''}${responsive ? ' chart-responsive' : ''}${chartTheme === 'v4' ? ' chart-v4' : ''}`}
      style={{ marginTop: flush ? 0 : 8, position: 'relative', width: responsive ? '100%' : undefined }}
    >
      {canDrag && !hideDragHint ? (
        <div className="dragnote" style={{ marginBottom: 4 }}>
          {dragHint || `↕ Drag the plan points for any future week (snaps to ${snap})`}
        </div>
      ) : null}
      <div className="chart-plot" style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio={responsive ? 'xMinYMid meet' : undefined}
          style={{
            width: responsive ? '100%' : undefined,
            height: H,
            display: 'block',
            touchAction: canDrag ? 'none' : undefined,
            cursor: dragIdx != null ? 'ns-resize' : canDrag ? 'crosshair' : 'default',
          }}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
        >
        {grid}
        {guideLine != null && guideLine.value != null ? (
          <line
            className="guide-line"
            x1={L}
            y1={Y(guideLine.value)}
            x2={W - R}
            y2={Y(guideLine.value)}
            stroke={guideLine.color || '#2b2f36'}
            strokeWidth="1.2"
            strokeDasharray={guideLine.dash || '5 4'}
          />
        ) : null}
        {zeroLine ? <line className="zl" x1={L} y1={zy} x2={W - R} y2={zy} /> : null}
        {bars.map((series, si) =>
          (series.data || []).map((v, i) => {
            if (v == null) return null;
            const color = typeof series.color === 'function' ? series.color(v, i) : series.color || '#2a78d6';
            const bx = L + bw * i + bw * 0.5 - barW / 2;
            const dim = hoverI != null && hoverI !== i;
            if (zeroLine) {
              const y = v >= 0 ? Y(v) : zy;
              const h = Math.max(1.5, Math.abs(Y(v) - zy));
              return (
                <rect
                  key={`${si}-${i}`}
                  x={bx}
                  y={y}
                  width={barW}
                  height={h}
                  rx={barRx}
                  fill={color}
                  opacity={dim ? 0.38 : hoverI === i ? 1 : 0.92}
                />
              );
            }
            const y = Y(v);
            const h = Math.max(1.5, Y(lo) - y);
            return (
              <rect
                key={`${si}-${i}`}
                x={bx}
                y={y}
                width={barW}
                height={h}
                rx={barRx}
                fill={color}
                opacity={dim ? 0.38 : hoverI === i ? 1 : 0.92}
              />
            );
          }),
        )}
        {overlayPath ? (
          <path
            d={overlayPath}
            fill="none"
            stroke={overlayLine.color || '#2a78d6'}
            strokeWidth="2"
          />
        ) : null}
        {overlayData &&
          overlayData.map((v, i) => {
            if (v == null) return null;
            return (
              <circle
                key={`ov${i}`}
                cx={L + bw * i + bw * 0.5}
                cy={Y(v)}
                r={3.5}
                fill={overlayLine.color || '#2a78d6'}
                stroke="#fff"
                strokeWidth="1.2"
              />
            );
          })}
        {linePath && !line?.hidePath ? (
          <path d={linePath} fill="none" stroke={line.color || '#c98aa0'} strokeWidth="2" strokeDasharray={line.dash || undefined} />
        ) : null}
        {lineData &&
          lineData.map((v, i) => {
            if (v == null) return null;
            const forward = i >= curIdx;
            if (!forward && dragFromIdx != null) return null;
            const draggable = canDrag && i >= dragFromIdx && (dragUntilIdx == null || i <= dragUntilIdx);
            return (
              <circle
                key={`pt${i}`}
                cx={L + bw * i + bw * 0.5}
                cy={Y(v)}
                r={draggable ? (dragIdx === i ? 6 : 5) : 3.5}
                fill={line.color || '#c98aa0'}
                stroke="#fff"
                strokeWidth="1.2"
                style={{ cursor: draggable ? 'ns-resize' : 'default' }}
                onPointerDown={(e) => onDragStart(i, e)}
                onMouseDown={(e) => onDragStart(i, e)}
              />
            );
          })}
        {markThisWeek && curIdx >= 0 && curIdx < n ? (
          <>
            <line
              x1={L + bw * curIdx + bw * 0.5}
              y1={T}
              x2={L + bw * curIdx + bw * 0.5}
              y2={H - B}
              stroke="#f5a623"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text x={L + bw * curIdx + bw * 0.5} y={T - 4} textAnchor="middle" fill="#f5a623" style={{ fontSize: 9, fontWeight: 700 }}>
              {weekMarker}
            </text>
          </>
        ) : null}
        {hoverI != null && hoverI >= 0 && hoverI < n ? (
          <line
            x1={hoverX}
            y1={T}
            x2={hoverX}
            y2={H - B}
            stroke="#eb6834"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity={0.9}
          />
        ) : null}
        {xTicks.map((i) => (
          <text key={`x${i}`} className="al" x={L + bw * i + bw * 0.5} y={H - 7} textAnchor="middle">
            {weeks[i]}
          </text>
        ))}
        {Array.from({ length: n }, (_, i) => (
          <rect
            key={`hit${i}`}
            x={L + bw * i}
            y={T}
            width={bw}
            height={Math.max(1, H - T - B)}
            fill="transparent"
            pointerEvents="none"
          />
        ))}
        </svg>
        {hoverI != null && hoverTips.length > 0 ? (
          <div
            className="chart-tip chart-tip-pointed"
            style={{
              left: `${(hoverX / W) * 100}%`,
              top: `${(hoverAnchorY / H) * 100}%`,
            }}
          >
            <div className="chart-tip-wk">{weeks[hoverI] || ''}</div>
            {hoverTips.map((t, ti) => (
              <div key={`${t.label}-${ti}`} className="chart-tip-row">
                <i style={{ background: t.color }} />
                <span>
                  {t.label}: {t.text}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {bars.some((b) => b.label) || overlayLine?.label || line?.label ? (
        <div className="lgd" style={{ marginTop: 6 }}>
          {bars.map((b) =>
            b.label ? (
              <span key={b.label}>
                <i style={{ background: typeof b.color === 'string' ? b.color : '#2a78d6' }} />
                {b.label}
              </span>
            ) : null,
          )}
          {overlayLine?.label ? (
            <span>
              <i style={{ background: overlayLine.color || '#2a78d6' }} />
              {overlayLine.label}
            </span>
          ) : null}
          {line?.label && line.showLegend !== false ? (
            <span>
              <i style={{ background: line.color || '#c98aa0' }} />
              {line.label}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SparkMini({
  values = [],
  weeks = [],
  color = '#2a78d6',
  width = 148,
  height = 36,
  markIdx = 0,
  unit = '',
  format = f2,
  label = '',
}) {
  const [hoverI, setHoverI] = useState(null);
  const n = values.length;
  if (!n) return null;
  const nums = values.map((v) => (v == null ? 0 : v));
  const mn = Math.min(...nums, 0);
  const mx = Math.max(...nums, 0);
  const pad = 3;
  const span = mx - mn || 1;
  const step = n > 1 ? (width - 2) / (n - 1) : width;
  const X = (i) => 1 + i * step;
  const Y = (v) => height - pad - ((v - mn) / span) * (height - pad * 2);
  const pts = nums.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const path = pts.length ? `M ${pts.join(' L ')}` : '';
  const hi = hoverI != null ? hoverI : null;
  const tipVal = hi != null ? values[hi] : null;

  return (
    <div className="spark-wrap">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="spark-svg"
        onMouseLeave={() => setHoverI(null)}
      >
        {markIdx >= 0 && markIdx < n ? (
          <line
            x1={X(markIdx)}
            y1={1}
            x2={X(markIdx)}
            y2={height - 1}
            stroke="#f5a623"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        ) : null}
        {path ? (
          <path d={path} fill="none" stroke={color} strokeWidth="1.35" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        {hi != null && tipVal != null ? (
          <circle cx={X(hi)} cy={Y(tipVal)} r="2.6" fill={color} stroke="#fff" strokeWidth="1" />
        ) : null}
        {nums.map((_, i) => (
          <rect
            key={i}
            x={Math.max(0, X(i) - step / 2)}
            y={0}
            width={Math.max(step, 6)}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverI(i)}
          />
        ))}
      </svg>
      {hi != null && tipVal != null ? (
        <div className="chart-tip spark-tip" style={{ left: `${(X(hi) / width) * 100}%` }}>
          <div className="chart-tip-wk">{weeks[hi] || `W${hi + 1}`}</div>
          <div className="chart-tip-row">
            <i style={{ background: color }} />
            {label ? `${label}: ` : ''}
            {format(tipVal)}
            {unit ? ` ${unit}` : ''}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated call SparkMini as a component; kept for existing `{sparkMini({...})}` sites. */
export function sparkMini(props) {
  return <SparkMini {...props} />;
}

export function KpiTrendCard({
  heading,
  value,
  suffix = '',
  caption,
  color = '#2a78d6',
  values = [],
  weeks = [],
  markIdx = 0,
  unit = '',
  tone = '',
  format = f2,
}) {
  return (
    <div className={`kpi-trend ${tone}`} style={{ '--kpi-accent': color }}>
      {heading ? <span className="kpi-trend-h">{heading}</span> : null}
      <b>
        {format(value)}
        {suffix}
      </b>
      <SparkMini
        values={values}
        weeks={weeks}
        color={color}
        markIdx={markIdx}
        unit={unit}
        format={format}
        label={heading || caption}
      />
      {caption ? <span>{caption}</span> : null}
    </div>
  );
}

export function DecisionBar({ decision, onAccept, onModify, onReject }) {
  return (
    <div className="rec-actions" data-act="decision-bar">
      <button type="button" className={`abtn acc ${decision === 'acc' ? 'on' : ''}`} data-act="dec-acc" onClick={onAccept}>
        ✓ Accept
      </button>
      {onModify ? (
        <button type="button" className={`abtn mod ${decision === 'mod' ? 'on' : ''}`} data-act="dec-mod" onClick={onModify}>
          ✎ Modify
        </button>
      ) : null}
      <button type="button" className={`abtn rej ${decision === 'rej' ? 'on' : ''}`} data-act="dec-rej" onClick={onReject}>
        ✕ Reject
      </button>
      <span className="rec-badge">
        {decision === 'acc' ? '✓ Accepted' : decision === 'mod' ? '✎ Modified' : decision === 'rej' ? '✕ Rejected' : ''}
      </span>
    </div>
  );
}
