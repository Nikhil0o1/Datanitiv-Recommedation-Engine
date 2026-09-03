import { useMemo } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { f2 } from '../utils/format';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

function ouColor(v, future) {
  if (v == null) return 'transparent';
  if (v < 0) return future ? '#f3b0ab' : '#e0483f';
  return future ? '#a9dcc6' : '#1a9e6a';
}

function markerPlugin(curIdx) {
  return {
    id: `wk_${curIdx}`,
    afterDraw(chart) {
      const x = chart.scales.x.getPixelForValue(curIdx);
      const { top, bottom } = chart.chartArea;
      const g = chart.ctx;
      g.save();
      g.strokeStyle = '#f5a623';
      g.lineWidth = 1.5;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(x, top);
      g.lineTo(x, bottom);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#f5a623';
      g.font = '700 9px -apple-system,sans-serif';
      g.textAlign = 'center';
      g.fillText('THIS WK', x, top - 1);
      g.restore();
    },
  };
}

function zeroLinePlugin() {
  return {
    id: 'zl',
    afterDraw(chart) {
      const y = chart.scales.y.getPixelForValue(0);
      const { left, right } = chart.chartArea;
      const g = chart.ctx;
      g.save();
      g.strokeStyle = '#c3c9d2';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(left, y);
      g.lineTo(right, y);
      g.stroke();
      g.restore();
    },
  };
}

function ouOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#2b2f36',
        padding: 9,
        cornerRadius: 8,
        callbacks: {
          label(ctx) {
            return ctx.parsed.y == null ? null : `O/U: ${f2(ctx.parsed.y)} FTE`;
          },
        },
        filter(item) {
          return item.parsed.y != null;
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#8a95a3',
          font: { size: 9.5 },
          maxRotation: 0,
          autoSkip: false,
          callback(_value, index) {
            return index % 2 === 0 ? this.getLabelForValue(_value) : '';
          },
        },
        border: { color: '#eef1f5' },
      },
      y: {
        grid: { color: '#eef1f5' },
        border: { display: false },
        ticks: {
          color: '#8a95a3',
          font: { size: 9.5 },
          callback: (v) => f2(v),
        },
      },
    },
  };
}

/** Landing expand O/U chart — Chart.js config matches planning_copilot_v4_19.html */
export default function LandingOuChart({ plan }) {
  const curIdx = plan.curIdx ?? 0;
  const weeks = plan.weeks || [];
  const sOU = plan.sOU || [];

  const chartData = useMemo(() => {
    const past = sOU.map((v, i) => (i <= curIdx ? v : null));
    const future = sOU.map((v, i) => (i >= curIdx ? v : null));
    return {
      labels: weeks,
      datasets: [
        {
          label: 'Actual/plan',
          data: past,
          backgroundColor: past.map((v) => ouColor(v, false)),
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.82,
        },
        {
          label: 'Forecast',
          data: future,
          backgroundColor: future.map((v) => ouColor(v, true)),
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.82,
        },
      ],
    };
  }, [weeks, sOU, curIdx]);

  const plugins = useMemo(
    () => [markerPlugin(curIdx), zeroLinePlugin()],
    [curIdx],
  );

  return (
    <div className="relative mt-1.5 h-[200px] w-full">
      <Bar data={chartData} options={ouOptions()} plugins={plugins} />
    </div>
  );
}
