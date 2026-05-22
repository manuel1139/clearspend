import type { SpendHistoryPoint } from '../lib/dashboard';

interface SpendHistoryChartProps {
  points: SpendHistoryPoint[];
}

export function SpendHistoryChart({ points }: SpendHistoryChartProps) {
  const width = 320;
  const height = 164;
  const padding = 14;
  const maxValue = Math.max(...points.map((point) => point.cumulative), 1);

  const path = points
    .map((point, index) => {
      const x =
        padding +
        (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        (point.cumulative / maxValue) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const areaPath = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  const highlightedPoints = [0, Math.floor(points.length / 2), points.length - 1]
    .map((index) => points[index])
    .filter(Boolean);

  return (
    <div className="rounded-[2rem] bg-[#0E1433] p-5 text-white shadow-[0_24px_80px_rgba(15,27,84,0.28)]">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">
            Spend History
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Last 30 days
          </h2>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
          Live
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#92A4FF" />
              <stop offset="100%" stopColor="#4163FF" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(120, 147, 255, 0.45)" />
              <stop offset="100%" stopColor="rgba(120, 147, 255, 0.03)" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={padding}
              y1={padding + ratio * (height - padding * 2)}
              x2={width - padding}
              y2={padding + ratio * (height - padding * 2)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 6"
            />
          ))}

          <path d={areaPath} fill="url(#areaGradient)" />
          <path
            d={path}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {highlightedPoints.map((point) => {
            const index = points.findIndex((candidate) => candidate.date === point.date);
            const x =
              padding +
              (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
            const y =
              height -
              padding -
              (point.cumulative / maxValue) * (height - padding * 2);

            return (
              <g key={point.date}>
                <circle cx={x} cy={y} r="6" fill="#4163FF" />
                <circle
                  cx={x}
                  cy={y}
                  r="11"
                  fill="rgba(100,130,255,0.18)"
                />
              </g>
            );
          })}
        </svg>

        <div className="mt-3 flex items-center justify-between px-1 text-[11px] tracking-wide text-white/55">
          <span>{points[0]?.label}</span>
          <span>{points[Math.floor(points.length / 2)]?.label}</span>
          <span>{points[points.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
}
