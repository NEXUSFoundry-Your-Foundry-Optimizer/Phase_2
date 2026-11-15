import { createFileRoute } from "@tanstack/react-router";
import { Zap, Flame, Mountain, Droplets, CheckCircle2, Save, Play } from "lucide-react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { postJson, useLiveTwin } from "@/lib/live-api";
import { TwinVisual } from "@/components/three/TwinVisual";
import type { SceneVariant } from "@/components/three/scene";

export const Route = createFileRoute("/agent/pinn")({
  component: PINNPage,
});

type WhatIfResult = {
  error?: string;
  risk?: number;
  previous_risk?: number;
  physics_valid?: boolean;
  cooling_rate?: number;
  recommendation?: string;
  new_predicted_state?: { pour_temp?: number };
};

const TWIN_3D_VARIANTS: Record<"melting" | "molding" | "pouring", SceneVariant> = {
  melting: "furnace",
  molding: "mold",
  pouring: "ladle",
};

const TWIN_LABELS: Record<"melting" | "molding" | "pouring", { name: string; icon: typeof Flame; desc: string }> = {
  melting: { name: "Melting Twin", icon: Flame, desc: "Induction Coreless Furnace" },
  molding: { name: "Molding Twin", icon: Mountain, desc: "Green Sand Mold Machine" },
  pouring: { name: "Pouring Twin", icon: Droplets, desc: "Bottom-Pour Ladle & Stream" },
};

function PINNPage() {
  const [activeTwin, setActiveTwin] = useState<"melting" | "molding" | "pouring">("melting");
  const [running, setRunning] = useState<"melting" | "molding" | "pouring" | null>(null);
  const [results, setResults] = useState<WhatIfResult | null>(null);
  const { state: melting } = useLiveTwin("melting");
  const { state: molding } = useLiveTwin("molding");
  const { state: pouring } = useLiveTwin("pouring");
  
  const [setpoint, setSetpoint] = useState("1400");
  const [moisture, setMoisture] = useState("3.5");
  const [speed, setSpeed] = useState("0.68");

  const runSimulation = async (type: "melting" | "molding" | "pouring") => {
    setActiveTwin(type);
    setRunning(type);
    setResults(null);
    try {
      const parameters = type === "melting"
        ? { pour_temp: Number(setpoint), melt_temp: Number(setpoint) }
        : type === "molding"
          ? { sand_moisture: Number(moisture) }
          : { pour_speed: Number(speed) };
      const result = await postJson<WhatIfResult>("/api/v1/simulation/what-if", { twin: type, parameters });
      setResults(result);
    } catch (error) {
      setResults({ error: error instanceof Error ? error.message : "Simulation failed" });
    } finally {
      setRunning(null);
    }
  };

  const liveFor3D = useMemo(() => {
    if (activeTwin === "melting") {
      const targetTemp = results?.new_predicted_state?.pour_temp ?? Number(setpoint);
      return {
        ...melting,
        melt_temp: targetTemp,
        pour_temp: targetTemp,
        temp: targetTemp,
      };
    }
    if (activeTwin === "molding") {
      return {
        ...molding,
        sand_moisture: Number(moisture),
        permeability: Number(molding?.["permeability"] ?? 118),
        compactability: Number(molding?.["compactability"] ?? 44),
      };
    }
    return {
      ...pouring,
      pour_speed: Number(speed),
      ladle_fill_pct: Number(pouring?.["ladle_fill_pct"] ?? 88),
      pre_pour_risk: results?.risk ?? Number(pouring?.["pre_pour_risk"] ?? 0.12),
    };
  }, [activeTwin, melting, molding, pouring, results, setpoint, moisture, speed]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
      <div className="mb-8 flex items-center gap-3 border-b border-border pb-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <Zap className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">What-If Simulation</h1>
          <p className="text-muted-foreground">Physics-Informed Neural Network (PINN) Sandbox</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Controls */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Simulation Controls</h2>
            
            {/* Melting Twin */}
            <div className={cn("mb-4 rounded-lg border p-4 transition-all", activeTwin === "melting" ? "border-primary/60 bg-primary/5" : "border-border/50 bg-background/50")}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <Flame className="size-4 text-orange-500" />
                  Melting Twin
                </div>
                {activeTwin === "melting" && (
                  <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Active 3D
                  </span>
                )}
              </div>
              <div className="mb-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Current Temperature:</span>
                  <span className="font-mono text-foreground">{melting ? `${Number(melting["melt_temp"] ?? 0).toFixed(2)}°C` : "--"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Proposed Setpoint:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={setpoint}
                      onChange={(e) => setSetpoint(e.target.value)}
                      className="w-20 rounded border border-border bg-card px-2 py-1 font-mono text-foreground outline-none focus:border-primary"
                    />
                    <span>°C</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => runSimulation("melting")}
                disabled={running !== null}
                className="flex w-full items-center justify-center gap-2 rounded bg-secondary py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 cursor-pointer"
              >
                {running === "melting" ? <RefreshCwIcon className="size-4 animate-spin" /> : <Play className="size-4" />}
                Run Melting Simulation
              </button>
            </div>

            {/* Molding Twin */}
            <div className={cn("mb-4 rounded-lg border p-4 transition-all", activeTwin === "molding" ? "border-primary/60 bg-primary/5" : "border-border/50 bg-background/50")}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <Mountain className="size-4 text-stone-400" />
                  Molding Twin
                </div>
                {activeTwin === "molding" && (
                  <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Active 3D
                  </span>
                )}
              </div>
              <div className="mb-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Current Moisture:</span>
                  <span className="font-mono text-foreground">{molding ? `${Number(molding["sand_moisture"] ?? 0).toFixed(2)}%` : "--"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Proposed Moisture:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={moisture}
                      onChange={(e) => setMoisture(e.target.value)}
                      className="w-20 rounded border border-border bg-card px-2 py-1 font-mono text-foreground outline-none focus:border-primary"
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => runSimulation("molding")}
                disabled={running !== null}
                className="flex w-full items-center justify-center gap-2 rounded bg-secondary py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 cursor-pointer"
              >
                {running === "molding" ? <RefreshCwIcon className="size-4 animate-spin" /> : <Play className="size-4" />}
                Run Molding Simulation
              </button>
            </div>

            {/* Pouring Twin */}
            <div className={cn("rounded-lg border p-4 transition-all", activeTwin === "pouring" ? "border-primary/60 bg-primary/5" : "border-border/50 bg-background/50")}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <Droplets className="size-4 text-blue-400" />
                  Pouring Twin
                </div>
                {activeTwin === "pouring" && (
                  <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Active 3D
                  </span>
                )}
              </div>
              <div className="mb-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Current Speed:</span>
                  <span className="font-mono text-foreground">{pouring ? `${Number(pouring["pour_speed"] ?? 0).toFixed(2)} m/s` : "--"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Proposed Speed:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={speed}
                      step="0.01"
                      onChange={(e) => setSpeed(e.target.value)}
                      className="w-20 rounded border border-border bg-card px-2 py-1 font-mono text-foreground outline-none focus:border-primary"
                    />
                    <span>m/s</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => runSimulation("pouring")}
                disabled={running !== null}
                className="flex w-full items-center justify-center gap-2 rounded bg-secondary py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50 cursor-pointer"
              >
                {running === "pouring" ? <RefreshCwIcon className="size-4 animate-spin" /> : <Play className="size-4" />}
                Run Pouring Simulation
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Results & 3D View */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className={cn("rounded-xl border border-border bg-card p-6 transition-opacity", !results && "opacity-60")}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Simulation Results</h2>
              <span className="rounded bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground">
                Twin: {TWIN_LABELS[activeTwin].name}
              </span>
            </div>
            {results ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {results.error ? <p className="text-sm text-destructive">{results.error}</p> : <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-background p-4">
                    <div className="text-sm text-muted-foreground">
                      {activeTwin === "melting"
                        ? "New Pour Temperature"
                        : activeTwin === "molding"
                        ? "Simulated Sand Moisture"
                        : "Simulated Pour Speed"}
                    </div>
                    <div className="mt-1 font-mono text-xl font-medium">
                      {activeTwin === "melting"
                        ? `${results.new_predicted_state?.pour_temp?.toFixed(2) ?? setpoint}°C`
                        : activeTwin === "molding"
                        ? `${moisture}%`
                        : `${speed} m/s`}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background p-4">
                    <div className="text-sm text-muted-foreground">New Defect Risk</div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-xl font-medium text-green-500">
                      {((results.risk ?? 0) * 100).toFixed(2)}% <span className="text-sm text-muted-foreground">(from {((results.previous_risk ?? 0) * 100).toFixed(2)}%)</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
                  <CheckCircle2 className="size-5 shrink-0" />
                  <div>
                    <span className="font-semibold">Physics Valid: {results.physics_valid ? "Yes" : "No"}</span>
                    <span className="ml-2 text-primary/80">(cooling rate {results.cooling_rate ?? "--"}°C/sec)</span>
                  </div>
                </div>

                <div className="rounded-lg bg-secondary/50 p-4 text-sm">
                  <span className="font-semibold">Recommendation:</span> {results.recommendation}
                </div></>}

                <div className="flex gap-3 pt-2">
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer">
                    <CheckCircle2 className="size-4" /> Apply Change
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-background py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent cursor-pointer">
                    <Save className="size-4" /> Save Scenario
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex h-[200px] flex-col items-center justify-center text-muted-foreground">
                {running ? (
                  <>
                    <RefreshCwIcon className="mb-4 size-8 animate-spin text-primary" />
                    <p>Solving physics constraints for {TWIN_LABELS[running].name}...</p>
                  </>
                ) : (
                  <p>Run a simulation on any twin to see physics-informed results.</p>
                )}
              </div>
            )}
          </div>

          {/* 3D Simulation View */}
          <div className="flex-1 rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">3D Simulation View</h2>
                <p className="text-xs text-muted-foreground">
                  Active 3D Asset: <strong className="text-foreground">{TWIN_LABELS[activeTwin].name}</strong> ({TWIN_LABELS[activeTwin].desc})
                </p>
              </div>

              {/* Twin Switcher Pills */}
              <div className="flex rounded-lg border border-border bg-background/60 p-1 text-xs">
                {(["melting", "molding", "pouring"] as const).map((t) => {
                  const Icon = TWIN_LABELS[t].icon;
                  const isActive = activeTwin === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setActiveTwin(t)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Real Three.js 3D Twin View */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <TwinVisual
                variant={TWIN_3D_VARIANTS[activeTwin]}
                live={liveFor3D}
                className="h-[320px] w-full"
                label={`Rendering ${TWIN_LABELS[activeTwin].name} 3D Physics Scene`}
              />
            </div>

            {/* Telemetry Status Bar for Active Simulation */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 font-mono text-xs text-muted-foreground">
              {activeTwin === "melting" && (
                <>
                  <span>● Setpoint: <strong className="text-foreground">{setpoint}°C</strong></span>
                  <span>● Live Temp: <strong className="text-foreground">{melting ? `${Number(melting["melt_temp"] ?? 0).toFixed(0)}°C` : "--"}</strong></span>
                  <span>● Cooling: <strong className="text-foreground">{results?.cooling_rate != null ? `${results.cooling_rate}°C/s` : "6.2°C/s"}</strong></span>
                </>
              )}
              {activeTwin === "molding" && (
                <>
                  <span>● Simulated Moisture: <strong className="text-foreground">{moisture}%</strong></span>
                  <span>● Permeability: <strong className="text-foreground">{molding ? `${Number(molding["permeability"] ?? 118).toFixed(0)} norm` : "118 norm"}</strong></span>
                  <span>● Compactability: <strong className="text-foreground">{molding ? `${Number(molding["compactability"] ?? 44).toFixed(0)}%` : "44%"}</strong></span>
                </>
              )}
              {activeTwin === "pouring" && (
                <>
                  <span>● Simulated Speed: <strong className="text-foreground">{speed} m/s</strong></span>
                  <span>● Ladle Fill: <strong className="text-foreground">{pouring ? `${Number(pouring["ladle_fill_pct"] ?? 88).toFixed(0)}%` : "88%"}</strong></span>
                  <span>● Pre-Pour Risk: <strong className="text-foreground">{results?.risk != null ? `${(results.risk * 100).toFixed(2)}%` : "12.00%"}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefreshCwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
