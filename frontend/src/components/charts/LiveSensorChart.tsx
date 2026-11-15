import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLiveTwin } from "@/lib/live-api";
import { TWINS, type TwinId } from "@/lib/nexus-data";

/**
 * Live telemetry chart with explicit engineering units on both axes.
 *
 *  X axis — elapsed replay time, formatted mm:ss, labelled "Time (mm:ss)".
 *  Y axes — one dedicated axis per series scale, each labelled with its unit
 *  (°C, kW, g, %, AFS, kPa, m/s …) straight from the twin metadata, so no
 *  series is ever artificially rescaled to shoehorn it onto another axis.
 */
const AXIS_LABEL_STYLE = {
  fontSize: 10,
  fill: "var(--color-muted-foreground)",
} as const;

function axisUnitLabel(unit: string) {
  return { value: unit, angle: -90, position: "insideLeft" as const, style: { fontSize: 10, fill: "var(--color-muted-foreground)" } };
}

function seriesName(s: { label: string; unit: string }): string {
  return s.unit ? `${s.label} (${s.unit})` : s.label;
}

export function LiveSensorChart({ twin }: { twin: TwinId }) {
  const meta = TWINS[twin];
  const { history, error } = useLiveTwin(twin);

  // Group series by their axis type: percent-series share one axis [0,100];
  // non-percent series each get their own auto-scaled axis.
  const allPercent = meta.series.every((s) => s.percent);
  const axisIds = ["a", "b", "c"] as const;

  // Map each series index → axis id.
  // If all series are percent we collapse to a single shared left axis "a".
  const seriesAxisId = meta.series.map((s, i) =>
    allPercent ? "a" : (axisIds[i] ?? "c")
  );

  // Deduplicate axes to render.
  const axesToRender = allPercent
    ? [{ id: "a", percent: true, unit: "%", orientation: "left" as const }]
    : meta.series.map((s, i) => ({
        id: axisIds[i] ?? "c",
        percent: !!s.percent,
        unit: s.unit,
        orientation: i === 1 ? ("right" as const) : ("left" as const),
        hide: i === 2,
      }));

  return (
    <div className="h-[300px] w-full">
      {error && <p className="mb-2 text-xs text-warning">{error}</p>}
      {history.length === 0 && !error && <p className="mb-2 text-xs text-muted-foreground">Waiting for live telemetry...</p>}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history} margin={{ top: 10, right: 14, left: -6, bottom: 14 }}>
          <defs>
            {meta.series.map((s, i) => (
              <linearGradient key={s.key} id={`g-${twin}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            label={{ value: "Time (mm:ss)", position: "insideBottom", offset: -6, style: AXIS_LABEL_STYLE }}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          {/* Render deduplicated Y-axes */}
          {axesToRender.map((ax) => {
            const domain: [number | string, number | string] = ax.percent ? [0, 100] : ["auto", "auto"];
            return (
              <YAxis
                key={ax.id}
                yAxisId={ax.id}
                domain={domain}
                orientation={ax.orientation}
                hide={("hide" in ax) ? ax.hide : false}
                {...(ax.unit ? { label: axisUnitLabel(ax.unit) } : {})}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={ax.orientation === "right" ? 42 : 46}
              />
            );
          })}
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--color-foreground)",
            }}
            labelFormatter={(label) => `t+${label}`}
            formatter={(value: number | string, name: string) => [`${value}`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-muted-foreground)" }} formatter={(value) => <span className="text-muted-foreground">{value}</span>} />
          {meta.series.map((s, i) => (
            <Area
              key={s.key}
              yAxisId={seriesAxisId[i]}
              type="monotone"
              dataKey={s.key}
              name={seriesName(s)}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#g-${twin}-${i})`}
              isAnimationActive={false}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
