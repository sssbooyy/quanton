import { useId } from "react";
import { sapphireNumber } from "../../lib/sapphireFormat.js";

const CHART_POINTS = [
  { x: 8, y: 72 },
  { x: 52, y: 58 },
  { x: 96, y: 64 },
  { x: 140, y: 44 },
  { x: 184, y: 38 },
  { x: 228, y: 28 },
  { x: 272, y: 22 },
  { x: 312, y: 14 },
];

function buildPath(points) {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function GrowthChart() {
  const uid = useId().replace(/:/g, "");
  const lineId = `chartLine-${uid}`;
  const glowId = `chartGlow-${uid}`;
  const fillId = `chartFill-${uid}`;
  const path = buildPath(CHART_POINTS);
  const areaPath = `${path} L 312 88 L 8 88 Z`;

  return (
    <div className="sapphire-overview__chart">
      <span className="sapphire-overview__chartLabel">Shard velocity</span>
      <svg
        className="sapphire-overview__chartSvg"
        viewBox="0 0 320 88"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={lineId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1E88FF" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#4AB8FF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#76C7FF" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E88FF" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1E88FF" stopOpacity="0" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d={areaPath} fill={`url(#${fillId})`} className="sapphire-overview__chartArea" />

        <path
          d={path}
          fill="none"
          stroke={`url(#${lineId})`}
          strokeWidth="2"
          strokeLinecap="round"
          className="sapphire-overview__chartLine"
          filter={`url(#${glowId})`}
        />

        {CHART_POINTS.map((p, i) => (
          <g key={i} className="sapphire-overview__chartPoint" style={{ "--point-i": i }}>
            <circle cx={p.x} cy={p.y} r="5" fill="rgba(30,136,255,0.15)" />
            <circle cx={p.x} cy={p.y} r="2.5" fill="#76C7FF" className="sapphire-overview__chartDot" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function MiningOverviewCard({ profile, loading }) {
  const shards = profile?.shards;
  const dailyField = profile?.dailyEarnings ?? profile?.shardsEarnedToday;

  return (
    <section className="sapphire-overview sapphire-glass sapphire-glow" aria-label="Mining overview">
      <h2 className="sapphire-sectionTitle">Overview</h2>
      <div className="sapphire-overview__grid">
        <div className="sapphire-overview__metric">
          <span className="sapphire-label">Total Shards</span>
          <span className="sapphire-value sapphire-mono">
            {loading && shards == null ? "—" : sapphireNumber(shards)}
          </span>
        </div>
        <div className="sapphire-overview__metric">
          <span className="sapphire-label">Daily Earnings</span>
          <span className="sapphire-value sapphire-mono">
            {dailyField == null ? "—" : sapphireNumber(dailyField)}
          </span>
        </div>
      </div>
      <GrowthChart />
    </section>
  );
}
