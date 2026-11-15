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

export interface LiveSensorChartProps {
  twin: TwinId;
  seriesIndex?: number;
  height?: number;
}

function seriesName(s: { label: string; unit: string }): string {
  return s.unit ? `${s.label} (${s.unit})` : s.label;
}

export function LiveSensorChart({ twin, seriesIndex, height = 280 }: LiveSensorChartProps) {
  const meta = TWINS[twin] ?? TWINS.melting;
  const { history, error } = useLiveTwin(twin);

  // If a specific seriesIndex is requested, render a dedicated single-component graph
  if (seriesIndex !== undefined && meta.series && meta.series[seriesIndex]) {
    const s = meta.series[seriesIndex];

    // Dedicated color schemes and auto-scaling bounds per twin and component
    let colors = { stroke: s.color, fill: s.color };
    let domain: [number | ((dataMin: number) => number), number | ((dataMax: number) => number)] = ["auto", "auto"];
    let tickFormatter = (v: number) => (typeof v === "number" ? Math.round(v).toString() : String(v));

    if (twin === "melting") {
      if (s.key === "temp") {
        // Melt Temperature (°C)
        colors = { stroke: "#d97706", fill: "#f59e0b" };
        domain = [(dataMin: number) => Math.floor(Math.min(1350, dataMin - 15)), (dataMax: number) => Math.ceil(Math.max(1600, dataMax + 15))];
        tickFormatter = (v: number) => (typeof v === "number" ? Math.round(v).toString() : String(v));
      } else if (s.key === "power") {
        // Power Draw (kW)
        colors = { stroke: "#0284c7", fill: "#38bdf8" };
        domain = [(dataMin: number) => Math.floor(Math.min(700, dataMin - 30)), (dataMax: number) => Math.ceil(Math.max(1350, dataMax + 30))];
        tickFormatter = (v: number) => (typeof v === "number" ? Math.round(v).toString() : String(v));
      } else if (s.key === "vibration") {
        // Vibration (g)
        colors = { stroke: "#7c3aed", fill: "#a855f7" };
        domain = [0, (dataMax: number) => Math.max(0.08, Number((dataMax * 1.35).toFixed(2)))];
        tickFormatter = (v: number) => (typeof v === "number" ? v.toFixed(2) : String(v));
      }
    } else if (twin === "molding") {
      if (s.key === "temp") {
        // Sand Moisture (%)
        colors = { stroke: "#d97706", fill: "#f59e0b" };
        domain = [(dataMin: number) => Math.floor(Math.max(0, dataMin - 1)), (dataMax: number) => Math.ceil(Math.max(10, dataMax + 1))];
        tickFormatter = (v: number) => (typeof v === "number" ? v.toFixed(0) : String(v));
      } else if (s.key === "power") {
        // Permeability (norm)
        colors = { stroke: "#0284c7", fill: "#38bdf8" };
        domain = [(dataMin: number) => Number(Math.max(0, dataMin - 0.05).toFixed(2)), (dataMax: number) => Number(Math.min(1.2, dataMax + 0.05).toFixed(2))];
        tickFormatter = (v: number) => (typeof v === "number" ? v.toFixed(2) : String(v));
      } else if (s.key === "vibration") {
        // Green Strength (kPa)
        colors = { stroke: "#059669", fill: "#10b981" };
        domain = [(dataMin: number) => Math.floor(Math.max(0, dataMin - 10)), (dataMax: number) => Math.ceil(dataMax + 10)];
        tickFormatter = (v: number) => (typeof v === "number" ? Math.round(v).toString() : String(v));
      }
    } else if (twin === "pouring") {
      if (s.key === "temp") {
        // Pour Temperature (°C)
        colors = { stroke: "#d97706", fill: "#f59e0b" };
        domain = [(dataMin: number) => Math.floor(Math.min(1380, dataMin - 15)), (dataMax: number) => Math.ceil(Math.max(1520, dataMax + 15))];
        tickFormatter = (v: number) => (typeof v === "number" ? Math.round(v).toString() : String(v));
      } else if (s.key === "power") {
        // Ladle Fill (%)
        colors = { stroke: "#0284c7", fill: "#38bdf8" };
        domain = [0, 100];
        tickFormatter = (v: number) => (typeof v === "number" ? Math.round(v).toString() : String(v));
      } else if (s.key === "vibration") {
        // Pour Speed (m/s)
        colors = { stroke: "#7c3aed", fill: "#a855f7" };
        domain = [0, (dataMax: number) => Number(Math.max(1.0, dataMax + 0.2).toFixed(1))];
        tickFormatter = (v: number) => (typeof v === "number" ? v.toFixed(2) : String(v));
      }
    } else if (s.percent) {
      domain = [0, 100];
    }

    return (
      <div style={{ height: `${height}px` }} className="w-full">
        {error && <p className="mb-2 text-xs text-warning">{error}</p>}
        {history.length === 0 && !error && (
          <p className="mb-2 text-xs text-muted-foreground">Waiting for live telemetry...</p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 16, right: 28, left: 24, bottom: 12 }}>
            <defs>
              <linearGradient id={`grad-${twin}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.fill} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colors.fill} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              stroke="var(--color-border)"
              tickLine={true}
              axisLine={true}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              minTickGap={28}
              height={46}
              tickMargin={4}
              label={{
                value: "time (mm:ss)",
                position: "insideBottom",
                offset: -2,
                style: { fontSize: 11, fill: "var(--color-muted-foreground)", textAnchor: "middle" },
              }}
            />
            <YAxis
              domain={domain}
              orientation="left"
              stroke="var(--color-border)"
              tickLine={true}
              axisLine={true}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickFormatter={tickFormatter}
              width={78}
              tickMargin={6}
              label={{
                value: `${s.label} (${s.unit})`,
                angle: -90,
                position: "insideLeft",
                offset: 14,
                style: { fontSize: 11, fill: "var(--color-muted-foreground)", textAnchor: "middle" },
              }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-foreground)",
              }}
              labelFormatter={(label) => `Elapsed time: ${label}`}
              formatter={(value: number | string) => [`${value} ${s.unit}`, s.label]}
            />
            <Area
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={colors.stroke}
              strokeWidth={2.5}
              fill={`url(#grad-${twin}-${s.key})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Multi-series fallback for other twins
  const seriesList = meta.series || [];
  const allPercent = seriesList.every((s) => s.percent);
  const axisIds = ["a", "b", "c"] as const;
  const seriesAxisId = seriesList.map((s, i) => (allPercent ? "a" : axisIds[i] ?? "c"));

  const axesToRender = allPercent
    ? [{ id: "a", percent: true, unit: "%", label: "Percentage", orientation: "left" as const }]
    : seriesList.map((s, i) => ({
        id: axisIds[i] ?? "c",
        percent: !!s.percent,
        unit: s.unit,
        label: s.label,
        orientation: i === 1 ? ("right" as const) : ("left" as const),
        hide: i === 2,
      }));

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      {error && <p className="mb-2 text-xs text-warning">{error}</p>}
      {history.length === 0 && !error && (
        <p className="mb-2 text-xs text-muted-foreground">Waiting for live telemetry...</p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history} margin={{ top: 16, right: 28, left: 24, bottom: 12 }}>
          <defs>
            {seriesList.map((s, i) => (
              <linearGradient key={s.key} id={`g-${twin}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            stroke="var(--color-border)"
            tickLine={true}
            axisLine={true}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            minTickGap={28}
            height={46}
            tickMargin={4}
            label={{
              value: "time (mm:ss)",
              position: "insideBottom",
              offset: -2,
              style: { fontSize: 11, fill: "var(--color-muted-foreground)", textAnchor: "middle" },
            }}
          />
          {axesToRender.map((ax) => {
            const domain: [number | string, number | string] = ax.percent ? [0, 100] : ["auto", "auto"];
            return (
              <YAxis
                key={ax.id}
                yAxisId={ax.id}
                domain={domain}
                orientation={ax.orientation}
                hide={"hide" in ax ? ax.hide : false}
                stroke="var(--color-border)"
                tickLine={true}
                axisLine={true}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                width={ax.orientation === "right" ? 64 : 78}
                tickMargin={6}
                label={{
                  value: `${ax.label} (${ax.unit})`,
                  angle: -90,
                  position: "insideLeft",
                  offset: 14,
                  style: { fontSize: 11, fill: "var(--color-muted-foreground)", textAnchor: "middle" },
                }}
              />
            );
          })}
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--color-foreground)",
            }}
            labelFormatter={(label) => `Elapsed time: ${label}`}
            formatter={(value: number | string, name: string) => [`${value}`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--color-muted-foreground)", paddingTop: 4 }}
            formatter={(value) => <span className="text-muted-foreground">{value}</span>}
          />
          {seriesList.map((s, i) => (
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
