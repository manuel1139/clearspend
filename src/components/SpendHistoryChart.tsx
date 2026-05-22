import type { ReactNode } from 'react';
import type { SpendHistoryPoint } from '../lib/dashboard';

interface SpendHistoryChartProps {
  headerAction?: ReactNode;
  points: SpendHistoryPoint[];
}

export function SpendHistoryChart({
  headerAction,
  points,
}: SpendHistoryChartProps) {
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
  const maxLabel = maxValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="rounded-4xl bg-[linear-gradient(145deg,#4A1234_0%,#7E2158_45%,#B9387B_100%)] p-5 text-white shadow-[0_24px_80px_rgba(130,37,90,0.28)]">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
          Spend History
        </p>
      </div>

      {headerAction && <div className="mb-4">{headerAction}</div>}

      <div className="mb-3 flex justify-end">
        <div className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white/78">
          Max EUR {maxLabel}
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] p-3 backdrop-blur-sm">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-44 w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF9BCB" />
                <stop offset="50%" stopColor="#FF78B5" />
                <stop offset="100%" stopColor="#FF5FA2" />
              </linearGradient>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(255, 120, 181, 0.34)" />
                <stop offset="100%" stopColor="rgba(255, 120, 181, 0.03)" />
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
                  <circle cx={x} cy={y} r="6" fill="#FF78B5" />
                  <circle
                    cx={x}
                    cy={y}
                    r="11"
                    fill="rgba(255, 120, 181, 0.20)"
                  />
                </g>
              );
            })}
          </svg>

          <div className="mt-3 flex items-center justify-between px-1 text-[11px] tracking-wide text-white/60">
            <span>{points[0]?.label}</span>
            <span>{points[Math.floor(points.length / 2)]?.label}</span>
            <span>{points[points.length - 1]?.label}</span>
          </div>
      </div>
    </div>
  );
}
