import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Flame, Zap, Activity, Droplets, Gauge, Layers } from "lucide-react";
import { LiveSensorChart } from "@/components/charts/LiveSensorChart";
import { TwinVisual } from "@/components/three/TwinVisual";
import type { SceneVariant } from "@/components/three/scene";
import { Reveal } from "@/components/site/Reveal";
import { StatusPill } from "@/components/site/StatusPill";
import { TWINS, TWIN_ORDER, type TwinId } from "@/lib/nexus-data";
import { useNexus } from "@/store/nexus";
import { formatLiveValue, useLiveCollection, useLiveTwin, type LiveAlert } from "@/lib/live-api";
import { QualityInspectionUpload } from "@/components/quality/QualityInspectionUpload";
import { cn } from "@/lib/utils";

const variants: Record<TwinId, SceneVariant> = {
  melting: "furnace",
  molding: "mold",
  pouring: "ladle",
  quality: "inspection",
};

function isTwin(v: unknown): v is TwinId {
  return typeof v === "string" && (TWIN_ORDER as readonly string[]).includes(v);
}

export const Route = createFileRoute("/twins/$twin")({
  loader: ({ params }) => {
    const twin: TwinId = isTwin(params?.twin) ? params.twin : "melting";
    return { twin };
  },
  head: ({ loaderData }) => {
    const twin: TwinId = loaderData?.twin && isTwin(loaderData.twin) ? loaderData.twin : "melting";
    const t = TWINS[twin] || TWINS.melting;
    return {
      meta: [
        { title: `${t.name} — Live State | NEXUS-Foundry` },
        { name: "description", content: t.blurb },
        { property: "og:title", content: `${t.name} — NEXUS-Foundry` },
        { property: "og:description", content: t.blurb },
      ],
    };
  },
  component: TwinPage,
});

function TwinPage() {
  const params = Route.useParams();
  const loaderData = Route.useLoaderData({ strict: false });
  const rawTwin = params?.twin || loaderData?.twin;
  const twin: TwinId = isTwin(rawTwin) ? rawTwin : "melting";
  const meta = TWINS[twin] || TWINS.melting;
  const { state: liveState, error } = useLiveTwin(twin);
  const { data: liveAlerts } = useLiveCollection<LiveAlert[]>(`/api/v1/alerts?twin=${twin}`);
  const values = (meta?.fields ?? []).map((field) => ({
    label: field.label,
    unit: field.unit,
    value: liveState ? formatLiveValue(field.key, liveState[field.key]) : "--",
  }));
  const liveStatus = twin === "melting"
    ? Number(liveState?.["anomaly_score"] ?? 0) > 0.78 ? "critical" : "normal"
    : twin === "pouring"
      ? Number(liveState?.["pre_pour_risk"] ?? 0) > 0.7 ? "critical" : "normal"
      : twin === "quality"
        ? Number(liveState?.["defect_risk"] ?? 0) > 0.5 ? "critical" : "normal"
        : Number(liveState?.["sand_moisture"] ?? 0) > 5 ? "warning" : "normal";
  const focused = useNexus((s) => s.focusedAlert);
  const alerts = liveAlerts ?? [];
  const idx = Math.max(0, TWIN_ORDER.indexOf(twin));
  const prev = TWIN_ORDER[(idx + 3) % 4]!;
  const next = TWIN_ORDER[(idx + 1) % 4]!;

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Digital twin · Stage 0{idx + 1}</p>
            <h1 className="mt-3 text-4xl font-medium tracking-tight lg:text-5xl">{meta.name}</h1>
            <p className="mt-3 max-w-xl text-muted-foreground">{meta.blurb}</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            {twin !== "quality" && <StatusPill status={liveState ? liveStatus : "normal"} />}
            {meta.comingSoon && (
              <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs text-warning">
                Backend integration in progress
              </span>
            )}
            <p className="font-mono text-xs text-muted-foreground">Batch {String(liveState?.batch_id ?? "Waiting for telemetry")} · live via /ws every 2s</p>
            {error && <p className="text-xs text-warning">{error}</p>}
          </div>
        </div>
      </Reveal>

      {twin === "melting" ? (
        <>
          {/* Row 1: Existing section with Three.js card (Left) & Live Simulation Graph - Melt Temp alone (Right) */}
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <TwinVisual
                variant={variants[twin]}
                className="h-[365px] w-full"
                label={`Rendering ${meta.name}`}
                live={liveState as Record<string, unknown> | null}
              />
            </Reveal>

            <Reveal delay={0.08}>
              <div className="surface-panel h-full min-h-[365px] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Flame className="size-4 text-amber-500" />
                      Live Simulation Graph
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Melt temperature telemetry · Calibrated range 1350–1600 °C
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-500 font-semibold">
                      {liveState?.melt_temp != null ? `${Number(liveState.melt_temp).toFixed(1)} °C` : "--"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <LiveSensorChart twin="melting" seriesIndex={0} height={280} />
                </div>
              </div>
            </Reveal>
          </div>

          {/* Row 2: New section below Row 1 with Power Draw (Left, below Three.js) & Vibration (Right, below existing graph) */}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Reveal delay={0.1}>
              <div className="surface-panel h-full min-h-[365px] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Zap className="size-4 text-sky-500" />
                      Power Draw Graph
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Induction coil electrical draw · Calibrated range 700–1400 kW
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-500 font-semibold">
                      {liveState?.power_kw != null ? `${Number(liveState.power_kw).toFixed(1)} kW` : "--"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <LiveSensorChart twin="melting" seriesIndex={1} height={280} />
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="surface-panel h-full min-h-[365px] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Activity className="size-4 text-purple-500" />
                      Vibration Graph
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Furnace structural accelerometer telemetry · Triaxial amplitude
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-500 font-semibold">
                      {liveState?.vibration_g != null ? `${Number(liveState.vibration_g).toFixed(3)} g` : "--"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <LiveSensorChart twin="melting" seriesIndex={2} height={280} />
                </div>
              </div>
            </Reveal>
          </div>
        </>
      ) : twin === "molding" ? (
        <>
          {/* Row 1: Existing section with Three.js card (Left) & Live Simulation Graph - Sand Moisture alone (Right) */}
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <TwinVisual
                variant={variants[twin]}
                className="h-[365px] w-full"
                label={`Rendering ${meta.name}`}
                live={liveState as Record<string, unknown> | null}
              />
            </Reveal>

            <Reveal delay={0.08}>
              <div className="surface-panel h-full min-h-[365px] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Droplets className="size-4 text-amber-500" />
                      Live Simulation Graph
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Sand moisture telemetry · Calibrated range 0–10 %
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-500 font-semibold">
                      {liveState?.sand_moisture != null ? `${Number(liveState.sand_moisture).toFixed(1)} %` : "--"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <LiveSensorChart twin="molding" seriesIndex={0} height={280} />
                </div>
              </div>
            </Reveal>
          </div>

          {/* Row 2: New section below Row 1 with Permeability (Left, below Three.js) & Green Strength (Right, below existing graph) */}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Reveal delay={0.1}>
              <div className="surface-panel h-full min-h-[365px] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Gauge className="size-4 text-sky-500" />
                      Permeability Graph
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Green sand mold air permeability · Normalized index
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-500 font-semibold">
                      {liveState?.permeability != null ? `${Number(liveState.permeability).toFixed(2)} norm` : "--"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <LiveSensorChart twin="molding" seriesIndex={1} height={280} />
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="surface-panel h-full min-h-[365px] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Layers className="size-4 text-emerald-500" />
                      Green Strength Graph
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Compacted sand compressive shear strength · Calibrated range 60–160 kPa
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-semibold">
                      {liveState?.green_strength != null ? `${Number(liveState.green_strength).toFixed(1)} kPa` : "--"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <LiveSensorChart twin="molding" seriesIndex={2} height={280} />
                </div>
              </div>
            </Reveal>
          </div>
        </>
      ) : twin === "pouring" ? (
        <>
          {/* Row 1: Three.js card (Left) & Live Simulation Graph - Pour Temperature alone (Right) */}
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <TwinVisual
                variant={variants[twin]}
                className="h-[365px] w-full"
                label={`Rendering ${meta.name}`}
                live={liveState as Record<string, unknown> | null}
              />
            </Reveal>

            <Reveal delay={0.08}>
              <div className="surface-panel h-full min-h-[365px] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Flame className="size-4 text-amber-500" />
                      Live Simulation Graph
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Pour temperature telemetry · Calibrated range 1380–1520 °C
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-500 font-semibold">
                      {liveState?.pour_temp != null ? `${Number(liveState.pour_temp).toFixed(1)} °C` : "--"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <LiveSensorChart twin="pouring" seriesIndex={0} height={280} />
                </div>
              </div>
            </Reveal>
          </div>

          {/* Row 2: New section below Row 1 with Ladle Fill (Left, below Three.js) & Pour Speed (Right, below existing graph) */}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Reveal delay={0.1}>
              <div className="surface-panel h-full min-h-[365px] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Droplets className="size-4 text-sky-500" />
                      Ladle Fill Graph
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Transfer ladle molten metal capacity · Calibrated range 0–100 %
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-500 font-semibold">
                      {liveState?.ladle_fill_pct != null ? `${Number(liveState.ladle_fill_pct).toFixed(1)} %` : "--"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <LiveSensorChart twin="pouring" seriesIndex={1} height={280} />
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="surface-panel h-full min-h-[365px] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Activity className="size-4 text-purple-500" />
                      Pour Speed Graph
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Stream linear velocity · Calibrated nozzle discharge
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-500 font-semibold">
                      {liveState?.pour_speed != null ? `${Number(liveState.pour_speed).toFixed(2)} m/s` : "--"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <LiveSensorChart twin="pouring" seriesIndex={2} height={280} />
                </div>
              </div>
            </Reveal>
          </div>
        </>
      ) : (
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <TwinVisual
              variant={variants[twin]}
              className="h-[360px] w-full"
              label={`Rendering ${meta.name}`}
              live={liveState as Record<string, unknown> | null}
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="surface-panel h-full p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Live Simulation Graph</h2>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-primary pulse-dot" /> streaming
                </span>
              </div>
              <div className="mt-3">
                <LiveSensorChart twin={twin} />
              </div>
            </div>
          </Reveal>
        </div>
      )}

      <Reveal delay={0.14} className="mt-5">
        <div className="surface-panel p-5">
          <h2 className="text-sm font-medium">Data Info</h2>
          <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
            {values.map((v) => (
              <div key={v.label} className="bg-surface px-4 py-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{v.label}</p>
                <p className="mt-1.5 font-mono text-xl">
                  {v.value}
                  <span className="ml-0.5 text-sm text-muted-foreground">{v.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {twin === "quality" && (
        <Reveal delay={0.16}>
          <QualityInspectionUpload currentBatchId={String(liveState?.batch_id ?? "")} />
        </Reveal>
      )}

      <Reveal delay={0.18} className="mt-5">
        <div className="surface-panel p-5">
          <h2 className="text-sm font-medium">Alert Logs · Recorded Events</h2>
          <div className="mt-4 space-y-2">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">No alerts recorded for this twin today.</p>}
            {alerts.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3 transition-colors",
                  focused === a.id && "border-primary/60 bg-primary/5",
                )}
              >
                <StatusPill status={a.severity} />
                <span className="font-mono text-xs text-muted-foreground">{a.time}</span>
                <span className="text-sm">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
        <Link
          to="/twins/$twin"
          params={{ twin: prev }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" /> {TWINS[prev].name}
        </Link>
        <Link
          to="/twins/$twin"
          params={{ twin: next }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          {TWINS[next].name} <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
