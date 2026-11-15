import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  Database,
  Droplets,
  Eye,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  Network,
  Play,
  Pause,
  Radio,
  RefreshCw,
  RotateCcw,
  Scan,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";

import { ClientOnly } from "@/components/three/ClientOnly";
import { cn } from "@/lib/utils";
import type { FactoryTelemetry, StationKey } from "@/components/three/FactorySimulator3D";

// Lazy load the 3D canvas for smooth client-side loading
const FactorySimulator3D = lazy(() => import("@/components/three/FactorySimulator3D"));

export const Route = createFileRoute("/factory")({
  head: () => ({
    meta: [
      { title: "Live Factory Simulator & Industry Flow — NEXUS-Foundry" },
      {
        name: "description",
        content:
          "End-to-end industrial digital twin flow with live multi-sensor simulation, cross-twin physics & AI model interactions, ISA-95 architecture, and 3D plant cockpit.",
      },
    ],
  }),
  component: FactorySimulatorPage,
});

type DiagramTab = "isa95" | "model-flow" | "sensor-matrix";

interface AnomalyScenario {
  id: string;
  name: string;
  shortDesc: string;
  station: StationKey;
  severity: "critical" | "warning";
  narrative: string;
}

const SCENARIOS: AnomalyScenario[] = [
  {
    id: "sand-moisture",
    name: "Sand Moisture Spike (+1.8%)",
    shortDesc: "Water over-dosing triggers gas blowholes & porosity",
    station: "molding",
    severity: "critical",
    narrative:
      "Sand moisture spikes from 3.4% to 5.2%. Molding Twin flags compactability loss. XGBoost calculates 86.4% pre-pour defect probability (SHAP confirms moisture root cause). ResNet-50 visual station detects voids; pneumatic diverter pushes part to scrap.",
  },
  {
    id: "furnace-undertemp",
    name: "Furnace Under-Temperature (1340°C)",
    shortDesc: "Power interruption causes premature freezing / cold shut",
    station: "furnace",
    severity: "warning",
    narrative:
      "Core induction power drops to 320 kW; melt temperature falls to 1340°C. PINN thermal dissipation predicts premature freeze-off in gating system. Prescriptive loop boosts coil power to 1180 kW.",
  },
  {
    id: "pouring-inclusion",
    name: "Stopper Flutter & Slag Infiltration",
    shortDesc: "Erratic pour speed leads to non-metallic oxide inclusions",
    station: "pouring",
    severity: "critical",
    narrative:
      "Stopper rod wear causes pouring velocity turbulence (flow rate fluctuates between 2.1 and 6.8 kg/s). Optical pyrometer detects oxide scum. ResNet-50 inspection identifies slag surface inclusion.",
  },
];

export function FactorySimulatorPage() {
  const [selectedStation, setSelectedStation] = useState<StationKey>("overview");
  const [activeDiagramTab, setActiveDiagramTab] = useState<DiagramTab>("isa95");
  const [simulationRunning, setSimulationRunning] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [activeAnomaly, setActiveAnomaly] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(142);

  // Live Simulated Sensor Telemetry State
  const [telemetry, setTelemetry] = useState<FactoryTelemetry>({
    meltTemp: 1485,
    inductionPower: 840,
    furnaceVibration: 0.028,
    liningHealth: 0.88,
    sandMoisture: 3.45,
    compactability: 45.2,
    squeezePressure: 162,
    pourTemp: 1418,
    pourRate: 5.1,
    stopperLift: 18.2,
    coolingSurfaceTemp: 520,
    solidificationPct: 86.5,
    defectRisk: 0.021,
    resnetSigmoid: 0.008,
    activeBatch: "BATCH-20260301-0842",
    anomalyActive: false,
    anomalyType: null,
    conveyorRunning: true,
    simulationSpeed: 1,
  });

  // Sensor Tick Simulation Engine
  useEffect(() => {
    if (!simulationRunning) return;

    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);

      setTelemetry((prev) => {
        const jitter = (Math.random() - 0.5) * 2;

        if (activeAnomaly === "sand-moisture") {
          return {
            ...prev,
            sandMoisture: Math.min(5.4, prev.sandMoisture + 0.15),
            compactability: Math.max(31, prev.compactability - 0.9),
            defectRisk: Math.min(0.864, prev.defectRisk + 0.08),
            resnetSigmoid: Math.min(0.942, prev.resnetSigmoid + 0.09),
            anomalyActive: true,
            anomalyType: "Sand Moisture Spike & Blowhole Hazard",
          };
        }

        if (activeAnomaly === "furnace-undertemp") {
          return {
            ...prev,
            meltTemp: Math.max(1335, prev.meltTemp - 8),
            inductionPower: Math.min(1150, prev.inductionPower + 35),
            pourTemp: Math.max(1365, prev.pourTemp - 6),
            defectRisk: Math.min(0.72, prev.defectRisk + 0.06),
            anomalyActive: true,
            anomalyType: "Crucible Under-Temperature & Cold Shut Hazard",
          };
        }

        if (activeAnomaly === "pouring-inclusion") {
          return {
            ...prev,
            pourRate: 4.8 + Math.sin(Date.now() / 300) * 2.2,
            stopperLift: 18 + Math.cos(Date.now() / 400) * 6,
            defectRisk: Math.min(0.79, prev.defectRisk + 0.07),
            resnetSigmoid: Math.min(0.915, prev.resnetSigmoid + 0.08),
            anomalyActive: true,
            anomalyType: "Stopper Flutter & Slag Entrapment",
          };
        }

        // Nominal baseline state with subtle natural industrial fluctuations
        return {
          ...prev,
          meltTemp: +(1485 + jitter * 2.5).toFixed(1),
          inductionPower: +(840 + jitter * 12).toFixed(0),
          furnaceVibration: +(0.028 + Math.abs(jitter) * 0.003).toFixed(3),
          sandMoisture: +(3.45 + jitter * 0.05).toFixed(2),
          compactability: +(45.2 + jitter * 0.3).toFixed(1),
          squeezePressure: +(162 + jitter * 1.5).toFixed(1),
          pourTemp: +(1418 + jitter * 2.0).toFixed(1),
          pourRate: +(5.1 + jitter * 0.15).toFixed(2),
          stopperLift: +(18.2 + jitter * 0.2).toFixed(1),
          coolingSurfaceTemp: +(520 + jitter * 3.5).toFixed(1),
          solidificationPct: +(86.5 + jitter * 0.2).toFixed(1),
          defectRisk: +(0.021 + Math.abs(jitter) * 0.004).toFixed(3),
          resnetSigmoid: +(0.008 + Math.abs(jitter) * 0.002).toFixed(3),
          anomalyActive: false,
          anomalyType: null,
          simulationSpeed,
          conveyorRunning: simulationRunning,
        };
      });
    }, 1000 / simulationSpeed);

    return () => clearInterval(interval);
  }, [simulationRunning, simulationSpeed, activeAnomaly]);

  const handleTriggerAnomaly = (scenarioId: string) => {
    setActiveAnomaly(scenarioId);
    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (scenario) {
      setSelectedStation(scenario.station);
    }
  };

  const handleResetNominal = () => {
    setActiveAnomaly(null);
    setTelemetry((prev) => ({
      ...prev,
      meltTemp: 1485,
      inductionPower: 840,
      sandMoisture: 3.45,
      compactability: 45.2,
      pourTemp: 1418,
      pourRate: 5.1,
      coolingSurfaceTemp: 520,
      defectRisk: 0.021,
      resnetSigmoid: 0.008,
      anomalyActive: false,
      anomalyType: null,
    }));
  };

  const stationButtons: { key: StationKey; label: string; tag: string }[] = [
    { key: "overview", label: "Overview", tag: "Full Plant" },
    { key: "furnace", label: "1. Melting", tag: "Induction Bay" },
    { key: "molding", label: "2. Molding", tag: "Green Sand" },
    { key: "pouring", label: "3. Pouring", tag: "Auto-Ladle" },
    { key: "cooling", label: "4. Cooling", tag: "Shakeout Bay" },
    { key: "inspection", label: "5. Visual QC", tag: "ResNet-50 Arm" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 pt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* --- Top Industrial Header Banner --- */}
        <div className="flex flex-col gap-4 border-b border-border/80 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                ISA-95 Level 4 Digital Twin Cockpit
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                Stream Sync: <span className="text-emerald-400">OK (WebSocket 1000ms)</span>
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Factory Simulator & Complete Industry Flow
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl">
              Real-time multi-stage sensor simulation of the full foundry shop floor with interacting digital twins,
              physics-informed thermal models (PINN), temporal forecasting (TFT), 50D CAD geometry embeddings, and
              deep visual quality inspection (ResNet-50).
            </p>
          </div>

          {/* Plant Health & Status Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-border bg-surface px-4 py-2 text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Plant State</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    telemetry.anomalyActive ? "bg-destructive animate-ping" : "bg-emerald-400"
                  )}
                />
                <span className={cn("text-sm font-bold", telemetry.anomalyActive ? "text-destructive" : "text-emerald-400")}>
                  {telemetry.anomalyActive ? "ANOMALY ACTIVE" : "OPTIMAL RUN"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface px-4 py-2 text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Active Batch</p>
              <p className="text-sm font-mono font-bold text-foreground">{telemetry.activeBatch}</p>
            </div>

            <div className="rounded-lg border border-border bg-surface px-4 py-2 text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Line Speed</p>
              <p className="text-sm font-mono font-bold text-amber-400">32 Molds / hr</p>
            </div>
          </div>
        </div>

        {/* --- Main 3D Factory Simulator Cockpit --- */}
        <div className="relative rounded-2xl border border-border/80 bg-surface shadow-2xl overflow-hidden">
          {/* Top 3D Control Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-surface-2/90 px-4 py-3 backdrop-blur">
            {/* Station Preset Switcher */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mr-1">Camera Focus:</span>
              {stationButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setSelectedStation(btn.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all",
                    selectedStation === btn.key
                      ? "bg-primary text-primary-foreground shadow-sm font-bold"
                      : "border border-border bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground"
                  )}
                >
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>

            {/* Simulation Controls: Play, Speed, Anomaly Scenarios */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSimulationRunning(!simulationRunning)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground hover:border-primary/40"
              >
                {simulationRunning ? (
                  <>
                    <Pause className="size-3.5 text-amber-400" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="size-3.5 text-emerald-400" /> Resume
                  </>
                )}
              </button>

              <div className="flex items-center rounded-md border border-border bg-background px-1.5 py-0.5">
                {[1, 2, 5].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSimulationSpeed(spd)}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-mono rounded transition-colors",
                      simulationSpeed === spd ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Reset to Nominal */}
              <button
                onClick={handleResetNominal}
                disabled={!activeAnomaly}
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  activeAnomaly
                    ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    : "border border-border/40 text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                <RotateCcw className="size-3.5" /> Reset Nominal
              </button>
            </div>
          </div>

          {/* 3D Viewport Canvas Container */}
          <div className="relative h-[560px] w-full">
            <ClientOnly
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-[#E7DBB8]">
                  <div className="text-center">
                    <div className="mx-auto size-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
                    <p className="mt-4 font-mono text-sm font-semibold text-stone-800">
                      Initializing Three.js 3D Factory Floor Simulator...
                    </p>
                  </div>
                </div>
              }
            >
              <Suspense
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-[#E7DBB8]">
                    <div className="text-center">
                      <div className="mx-auto size-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
                      <p className="mt-4 font-mono text-sm font-semibold text-stone-800">
                        Loading Industrial Shaders & Equipment Meshes...
                      </p>
                    </div>
                  </div>
                }
              >
                <FactorySimulator3D
                  telemetry={telemetry}
                  selectedStation={selectedStation}
                  onSelectStation={(st) => setSelectedStation(st)}
                />
              </Suspense>
            </ClientOnly>

            {/* In-Canvas Floating Station Telemetry HUD */}
            <div className="absolute top-4 right-4 z-10 max-w-sm rounded-xl border border-border/80 bg-background/90 p-4 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between border-b border-border/70 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                    {selectedStation === "overview" ? "Whole Plant Telemetry" : `${selectedStation.toUpperCase()} BAY SENSORS`}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">Live 1000ms</span>
              </div>

              {selectedStation === "furnace" || selectedStation === "overview" ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Flame className="size-3.5 text-amber-500" /> Core Melt Temp:
                    </span>
                    <span className={cn("font-mono font-bold", telemetry.meltTemp < 1390 ? "text-destructive" : "text-foreground")}>
                      {telemetry.meltTemp} °C
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Zap className="size-3.5 text-amber-400" /> Induction Power:
                    </span>
                    <span className="font-mono font-bold text-foreground">{telemetry.inductionPower} kW</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Waves className="size-3.5 text-cyan-400" /> Shell Vibration:
                    </span>
                    <span className="font-mono font-bold text-foreground">{telemetry.furnaceVibration} g</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Cpu className="size-3.5 text-emerald-400" /> Active Model:
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400 font-semibold">LSTM-AE + TFT (48h) + PINN</span>
                  </div>
                </div>
              ) : null}

              {selectedStation === "molding" ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Droplets className="size-3.5 text-blue-400" /> Sand Moisture:
                    </span>
                    <span className={cn("font-mono font-bold", telemetry.sandMoisture > 4.5 ? "text-destructive" : "text-foreground")}>
                      {telemetry.sandMoisture} %
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Layers className="size-3.5 text-amber-400" /> Compactability:
                    </span>
                    <span className="font-mono font-bold text-foreground">{telemetry.compactability} %</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Gauge className="size-3.5 text-emerald-400" /> Squeeze Pressure:
                    </span>
                    <span className="font-mono font-bold text-foreground">{telemetry.squeezePressure} kPa</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Cpu className="size-3.5 text-emerald-400" /> Active Model:
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400 font-semibold">Green Sand Rheology Twin</span>
                  </div>
                </div>
              ) : null}

              {selectedStation === "pouring" ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Flame className="size-3.5 text-amber-500" /> Pouring Stream Temp:
                    </span>
                    <span className="font-mono font-bold text-foreground">{telemetry.pourTemp} °C</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Droplets className="size-3.5 text-amber-400" /> Mass Pour Rate:
                    </span>
                    <span className="font-mono font-bold text-foreground">{telemetry.pourRate} kg/s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ShieldAlert className="size-3.5 text-destructive" /> Pre-Pour Defect Risk:
                    </span>
                    <span className={cn("font-mono font-bold", telemetry.defectRisk > 0.3 ? "text-destructive" : "text-emerald-400")}>
                      {(telemetry.defectRisk * 100).toFixed(1)} %
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Cpu className="size-3.5 text-emerald-400" /> Active Model:
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400 font-semibold">XGBoost + CAD 50D Fusion</span>
                  </div>
                </div>
              ) : null}

              {selectedStation === "cooling" ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Thermometer className="size-3.5 text-amber-500" /> Surface Heat:
                    </span>
                    <span className="font-mono font-bold text-foreground">{telemetry.coolingSurfaceTemp} °C</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Activity className="size-3.5 text-cyan-400" /> Solidification:
                    </span>
                    <span className="font-mono font-bold text-foreground">{telemetry.solidificationPct} %</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Cpu className="size-3.5 text-emerald-400" /> Active Model:
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400 font-semibold">Chvorinov Heat Flux Model</span>
                  </div>
                </div>
              ) : null}

              {selectedStation === "inspection" ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Scan className="size-3.5 text-cyan-400" /> ResNet-50 Sigmoid:
                    </span>
                    <span
                      className={cn(
                        "font-mono font-bold",
                        telemetry.resnetSigmoid > 0.5 ? "text-destructive" : "text-emerald-400"
                      )}
                    >
                      {telemetry.resnetSigmoid.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Eye className="size-3.5 text-primary" /> Visual QC Verdict:
                    </span>
                    <span
                      className={cn(
                        "font-mono font-bold px-2 py-0.5 rounded text-[10px]",
                        telemetry.resnetSigmoid > 0.5
                          ? "bg-destructive/15 text-destructive border border-destructive/30"
                          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      )}
                    >
                      {telemetry.resnetSigmoid > 0.5 ? "DEFECT REJECTED" : "ACCEPTED (PASS)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Cpu className="size-3.5 text-emerald-400" /> Active Model:
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400 font-semibold">ResNet-50 Vision (20M Params)</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bottom In-Canvas Anomaly Trigger Strip */}
            <div className="absolute bottom-3 right-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-background/90 p-2 shadow-lg backdrop-blur">
              <span className="text-[11px] font-mono text-muted-foreground px-2 flex items-center gap-1">
                <Sparkles className="size-3 text-amber-400" /> Inject Anomaly:
              </span>
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => handleTriggerAnomaly(sc.id)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-semibold transition-all",
                    activeAnomaly === sc.id
                      ? "border-destructive bg-destructive text-destructive-foreground shadow-sm"
                      : "border-border bg-surface text-foreground hover:border-destructive/50"
                  )}
                >
                  {sc.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* --- Active Anomaly Cascading Timeline (Cross-Twin Propagation) --- */}
        {activeAnomaly && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertOctagon className="size-5" />
                <h3 className="text-base font-bold">Cascading Cross-Twin Anomaly Propagation Active</h3>
              </div>
              <button
                onClick={handleResetNominal}
                className="text-xs font-mono font-semibold text-muted-foreground hover:text-foreground underline"
              >
                Clear Anomaly
              </button>
            </div>
            <p className="mt-2 text-sm text-foreground/90 leading-relaxed font-sans">
              {SCENARIOS.find((s) => s.id === activeAnomaly)?.narrative}
            </p>

            {/* Step-by-Step Flow Breadcrumbs */}
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-[10px] font-mono uppercase text-destructive font-bold">1. Edge Ingestion</p>
                <p className="text-xs font-semibold text-foreground mt-1">Sensor Value Out-of-Bounds</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Threshold violated at source bay</p>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-[10px] font-mono uppercase text-amber-400 font-bold">2. Digital Twin Alert</p>
                <p className="text-xs font-semibold text-foreground mt-1">Cross-Twin Event Broadcast</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Kafka payload sent downstream</p>
              </div>
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
                <p className="text-[10px] font-mono uppercase text-purple-400 font-bold">3. Pre-Pour XGBoost + SHAP</p>
                <p className="text-xs font-semibold text-foreground mt-1">Defect Probability Spikes</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pre-pour risk: {(telemetry.defectRisk * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-[10px] font-mono uppercase text-destructive font-bold">4. ResNet-50 Inspection</p>
                <p className="text-xs font-semibold text-foreground mt-1">Physical Scrap Diversion</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pneumatic arm pushes to scrap</p>
              </div>
            </div>
          </div>
        )}

        {/* --- Industry Standard Neat Structure Diagrams Section --- */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-lg">
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Network className="size-5 text-primary" />
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Industry 4.0 Factory Architecture & Data Pipeline
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Formal ISA-95 standard architecture showing edge sensors, telemetry ingestion, digital twin layers,
                and closed-loop AI actuation.
              </p>
            </div>

            {/* Diagram Tab Switcher */}
            <div className="flex rounded-lg border border-border bg-surface-2 p-1">
              <button
                onClick={() => setActiveDiagramTab("isa95")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeDiagramTab === "isa95"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                ISA-95 Hierarchy
              </button>
              <button
                onClick={() => setActiveDiagramTab("model-flow")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeDiagramTab === "model-flow"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Model Interaction Matrix
              </button>
              <button
                onClick={() => setActiveDiagramTab("sensor-matrix")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeDiagramTab === "sensor-matrix"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sensor Schedule
              </button>
            </div>
          </div>

          {/* Tab 1: ISA-95 Industrial Hierarchy Flow */}
          {activeDiagramTab === "isa95" && (
            <div className="mt-6 space-y-4">
              {/* Level 5: Prescriptive Closed-Loop Actuation */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                      LEVEL 5: PRESCRIPTIVE CONTROL
                    </span>
                    <span className="text-xs font-semibold text-foreground">Closed-Loop Autonomous Actuation</span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">Latency: &lt; 50ms</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <p className="text-xs font-bold text-foreground">Furnace Power Setpoint</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">IGBT Inverter PID adjustment</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <p className="text-xs font-bold text-foreground">Sand Water Injection</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Automated batch muller trim</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <p className="text-xs font-bold text-foreground">Stopper Servo Actuator</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Dynamic throttling of pour flow</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <p className="text-xs font-bold text-foreground">Scrap Diverter Arm</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Pneumatic reject bin segregation</p>
                  </div>
                </div>
              </div>

              {/* Direction Indicator */}
              <div className="flex justify-center -my-2">
                <div className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-0.5 text-[10px] font-mono text-muted-foreground">
                  ↑ Prescriptive Setpoints &nbsp;|&nbsp; ↓ Telemetry Ingestion
                </div>
              </div>

              {/* Level 4: Cognitive Digital Twins & Physics/AI Models */}
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                      LEVEL 4: COGNITIVE TWINS & MODELS
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      Hybrid Deep Learning & Physics Engines
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">Inference: 8ms - 32ms</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs mb-1">
                      <Flame className="size-3.5" /> Melting Twin
                    </div>
                    <p className="text-[11px] font-mono text-foreground">LSTM-AE + TFT 48h + PINN</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Reconstruction err & thermal horizon</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs mb-1">
                      <Layers className="size-3.5" /> Molding Twin
                    </div>
                    <p className="text-[11px] font-mono text-foreground">Sand Rheology Engine</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Moisture, compactability & venting</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs mb-1">
                      <Box className="size-3.5" /> Pouring Twin
                    </div>
                    <p className="text-[11px] font-mono text-foreground">50D CAD Embedding Fusion</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Chvorinov solidification & gating</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs mb-1">
                      <Scan className="size-3.5" /> Quality Twin
                    </div>
                    <p className="text-[11px] font-mono text-foreground">XGBoost + TreeSHAP + ResNet</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Pre-pour risk & visual defect detection</p>
                  </div>
                </div>
              </div>

              {/* Level 3: Real-Time Event & Time-Series Fabric */}
              <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-400">
                      LEVEL 3: STREAMING FABRIC
                    </span>
                    <span className="text-xs font-semibold text-foreground">Real-Time Event Bus & Cache</span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">Throughput: 12,000 msgs/s</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <p className="text-xs font-bold text-foreground">Apache Kafka Event Bus</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Partitioned cross-twin pub/sub messaging</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <p className="text-xs font-bold text-foreground">InfluxDB v2 Time-Series</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">High-frequency sensor persistence</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                    <p className="text-xs font-bold text-foreground">Redis Memory Cache</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Sub-millisecond twin state synchronization</p>
                  </div>
                </div>
              </div>

              {/* Level 0-2: Field Devices & Edge Control */}
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-400">
                      LEVEL 0-2: FIELD INSTRUMENTATION & EDGE PLC
                    </span>
                    <span className="text-xs font-semibold text-foreground">Sensors & Industrial Controllers</span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">OPC-UA / Modbus TCP</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 text-center">
                    <p className="text-xs font-bold text-foreground">Thermocouples</p>
                    <p className="text-[10px] text-muted-foreground">Type-K (0-1600°C)</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 text-center">
                    <p className="text-xs font-bold text-foreground">Pyrometers</p>
                    <p className="text-[10px] text-muted-foreground">Dual-color optical</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 text-center">
                    <p className="text-xs font-bold text-foreground">Moisture TDR</p>
                    <p className="text-[10px] text-muted-foreground">Dielectric constant</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 text-center">
                    <p className="text-xs font-bold text-foreground">Accelerometers</p>
                    <p className="text-[10px] text-muted-foreground">Piezoelectric 3-axis</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 text-center">
                    <p className="text-xs font-bold text-foreground">Siemens S7-1500</p>
                    <p className="text-[10px] text-muted-foreground">Fail-safe PLC loop</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/80 p-2.5 text-center">
                    <p className="text-xs font-bold text-foreground">GigE Vision Camera</p>
                    <p className="text-[10px] text-muted-foreground">5MP 60 FPS Optical</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Model Interaction & Cross-Twin Data Flow */}
          {activeDiagramTab === "model-flow" && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Cpu className="size-4 text-primary" /> Multi-Model Cross-Stage Interaction Matrix
                </h3>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                  {/* Model 1: LSTM-AE */}
                  <div className="rounded-xl border border-border bg-background p-4 flex flex-col justify-between">
                    <div>
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-500">
                        MODEL 01
                      </span>
                      <h4 className="font-bold text-sm text-foreground mt-2">LSTM Autoencoder</h4>
                      <p className="text-xs text-muted-foreground mt-1">Unsupervised furnace anomaly detection</p>
                      <div className="mt-3 space-y-1.5 text-[11px] font-mono">
                        <p className="text-muted-foreground">
                          Input: <span className="text-foreground">30×7 Window</span>
                        </p>
                        <p className="text-muted-foreground">
                          Threshold: <span className="text-amber-500">0.78 Loss</span>
                        </p>
                        <p className="text-muted-foreground">
                          Latency: <span className="text-foreground">18 ms</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60 text-[10px] text-emerald-400 font-mono">
                      → Triggers TFT 48h
                    </div>
                  </div>

                  {/* Model 2: TFT 48h */}
                  <div className="rounded-xl border border-border bg-background p-4 flex flex-col justify-between">
                    <div>
                      <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-400">
                        MODEL 02
                      </span>
                      <h4 className="font-bold text-sm text-foreground mt-2">Temporal Fusion Transformer</h4>
                      <p className="text-xs text-muted-foreground mt-1">Multi-horizon thermal & energy forecast</p>
                      <div className="mt-3 space-y-1.5 text-[11px] font-mono">
                        <p className="text-muted-foreground">
                          Horizon: <span className="text-foreground">48 Hours</span>
                        </p>
                        <p className="text-muted-foreground">
                          Quantiles: <span className="text-blue-400">P10, P50, P90</span>
                        </p>
                        <p className="text-muted-foreground">
                          Latency: <span className="text-foreground">28 ms</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60 text-[10px] text-emerald-400 font-mono">
                      → Feeds Pouring Twin
                    </div>
                  </div>

                  {/* Model 3: PINN Heat Transfer */}
                  <div className="rounded-xl border border-border bg-background p-4 flex flex-col justify-between">
                    <div>
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                        MODEL 03
                      </span>
                      <h4 className="font-bold text-sm text-foreground mt-2">Physics-Informed NN (PINN)</h4>
                      <p className="text-xs text-muted-foreground mt-1">1D transient heat conduction physics</p>
                      <div className="mt-3 space-y-1.5 text-[11px] font-mono">
                        <p className="text-muted-foreground">
                          Loss: <span className="text-foreground">PDE Residual</span>
                        </p>
                        <p className="text-muted-foreground">
                          Diffusivity: <span className="text-emerald-400">α = 1.12e-5</span>
                        </p>
                        <p className="text-muted-foreground">
                          Convergence: <span className="text-foreground">0.0034</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60 text-[10px] text-emerald-400 font-mono">
                      → Solidification check
                    </div>
                  </div>

                  {/* Model 4: XGBoost + TreeSHAP */}
                  <div className="rounded-xl border border-border bg-background p-4 flex flex-col justify-between">
                    <div>
                      <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-400">
                        MODEL 04
                      </span>
                      <h4 className="font-bold text-sm text-foreground mt-2">XGBoost + TreeSHAP</h4>
                      <p className="text-xs text-muted-foreground mt-1">Pre-pour defect risk & root cause</p>
                      <div className="mt-3 space-y-1.5 text-[11px] font-mono">
                        <p className="text-muted-foreground">
                          Features: <span className="text-foreground">65 + 50D CAD</span>
                        </p>
                        <p className="text-muted-foreground">
                          SHAP: <span className="text-purple-400">Exact TreeSHAP</span>
                        </p>
                        <p className="text-muted-foreground">
                          Latency: <span className="text-foreground">8 ms</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60 text-[10px] text-emerald-400 font-mono">
                      → Flags Visual QC
                    </div>
                  </div>

                  {/* Model 5: ResNet-50 */}
                  <div className="rounded-xl border border-border bg-background p-4 flex flex-col justify-between">
                    <div>
                      <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-400">
                        MODEL 05
                      </span>
                      <h4 className="font-bold text-sm text-foreground mt-2">ResNet-50 Visual QC</h4>
                      <p className="text-xs text-muted-foreground mt-1">Deep convolutional surface inspection</p>
                      <div className="mt-3 space-y-1.5 text-[11px] font-mono">
                        <p className="text-muted-foreground">
                          Resolution: <span className="text-foreground">224×224 RGB</span>
                        </p>
                        <p className="text-muted-foreground">
                          Parameters: <span className="text-rose-400">20.0M Params</span>
                        </p>
                        <p className="text-muted-foreground">
                          Latency: <span className="text-foreground">24 ms</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/60 text-[10px] text-destructive font-mono">
                      → Actuates Reject Arm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Sensor Schedule & Engineering Tolerances Table */}
          {activeDiagramTab === "sensor-matrix" && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-muted-foreground">
                    <th className="py-2.5 px-3 font-semibold">Sensor Tag</th>
                    <th className="py-2.5 px-3 font-semibold">Station / Bay</th>
                    <th className="py-2.5 px-3 font-semibold">Hardware Instrument</th>
                    <th className="py-2.5 px-3 font-semibold">Protocol</th>
                    <th className="py-2.5 px-3 font-semibold">Operational Target</th>
                    <th className="py-2.5 px-3 font-semibold">Alert Threshold</th>
                    <th className="py-2.5 px-3 font-semibold">Target Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-foreground">
                  <tr>
                    <td className="py-2 px-3 font-bold text-amber-500">TT-FURN-01</td>
                    <td className="py-2 px-3">Melting Bay</td>
                    <td className="py-2 px-3">Type-B Immersion Thermocouple</td>
                    <td className="py-2 px-3">Modbus TCP</td>
                    <td className="py-2 px-3">1480 - 1500 °C</td>
                    <td className="py-2 px-3 text-destructive">&lt; 1400 °C</td>
                    <td className="py-2 px-3 text-emerald-400">LSTM-AE / PINN</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-amber-500">KW-FURN-01</td>
                    <td className="py-2 px-3">Melting Bay</td>
                    <td className="py-2 px-3">IGBT Solid-State Power Meter</td>
                    <td className="py-2 px-3">OPC-UA</td>
                    <td className="py-2 px-3">800 - 950 kW</td>
                    <td className="py-2 px-3 text-destructive">&gt; 1200 kW</td>
                    <td className="py-2 px-3 text-emerald-400">TFT (48h)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-blue-400">MT-MOLD-01</td>
                    <td className="py-2 px-3">Molding Line</td>
                    <td className="py-2 px-3">TDR Dielectric Sand Moisture Probe</td>
                    <td className="py-2 px-3">IO-Link</td>
                    <td className="py-2 px-3">3.2 - 3.6 %</td>
                    <td className="py-2 px-3 text-destructive">&gt; 4.8 % / &lt; 2.8 %</td>
                    <td className="py-2 px-3 text-emerald-400">Molding Twin / XGBoost</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-blue-400">PT-MOLD-02</td>
                    <td className="py-2 px-3">Molding Line</td>
                    <td className="py-2 px-3">Hydraulic Squeeze Platen Pressure</td>
                    <td className="py-2 px-3">4-20 mA</td>
                    <td className="py-2 px-3">150 - 180 kPa</td>
                    <td className="py-2 px-3 text-destructive">&lt; 130 kPa</td>
                    <td className="py-2 px-3 text-emerald-400">Molding Twin</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-purple-400">PY-POUR-01</td>
                    <td className="py-2 px-3">Pouring Station</td>
                    <td className="py-2 px-3">Dual-Wavelength IR Pyrometer</td>
                    <td className="py-2 px-3">EtherCAT</td>
                    <td className="py-2 px-3">1410 - 1430 °C</td>
                    <td className="py-2 px-3 text-destructive">&lt; 1380 °C</td>
                    <td className="py-2 px-3 text-emerald-400">XGBoost / TreeSHAP</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-purple-400">FR-POUR-02</td>
                    <td className="py-2 px-3">Pouring Station</td>
                    <td className="py-2 px-3">Stopper Rod Linear Potentiometer</td>
                    <td className="py-2 px-3">CANopen</td>
                    <td className="py-2 px-3">4.8 - 5.4 kg/s</td>
                    <td className="py-2 px-3 text-destructive">&gt; 6.5 kg/s</td>
                    <td className="py-2 px-3 text-emerald-400">XGBoost + CAD 50D</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-cyan-400">CAM-QC-01</td>
                    <td className="py-2 px-3">Visual QC Bay</td>
                    <td className="py-2 px-3">5MP GigE Telecentric Vision Camera</td>
                    <td className="py-2 px-3">GigE Vision</td>
                    <td className="py-2 px-3">Zero Voids / Flaws</td>
                    <td className="py-2 px-3 text-destructive">Sigmoid &gt; 0.50</td>
                    <td className="py-2 px-3 text-rose-400">ResNet-50 Classifier</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* --- Live Multi-Twin Station Telemetry Cards Grid --- */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Station 1 Card */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-md">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
                  <Flame className="size-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Induction Melting Bay</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">Twin ID: melting-twin</p>
                </div>
              </div>
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-muted-foreground">Melt Temperature</span>
                  <span className="font-bold text-foreground">{telemetry.meltTemp} °C</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      telemetry.meltTemp < 1390 ? "bg-destructive" : "bg-amber-500"
                    )}
                    style={{ width: `${Math.min(100, (telemetry.meltTemp / 1600) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono">
                <div className="rounded bg-surface-2 p-2">
                  <p className="text-[10px] text-muted-foreground">Coil Power</p>
                  <p className="font-bold text-foreground">{telemetry.inductionPower} kW</p>
                </div>
                <div className="rounded bg-surface-2 p-2">
                  <p className="text-[10px] text-muted-foreground">Lining Wear</p>
                  <p className="font-bold text-foreground">{(telemetry.liningHealth * 100).toFixed(0)}% OK</p>
                </div>
              </div>
            </div>
          </div>

          {/* Station 2 Card */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-md">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
                  <Layers className="size-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Green Sand Molding Line</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">Twin ID: molding-twin</p>
                </div>
              </div>
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-muted-foreground">Sand Moisture Content</span>
                  <span
                    className={cn(
                      "font-bold",
                      telemetry.sandMoisture > 4.5 ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {telemetry.sandMoisture} %
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      telemetry.sandMoisture > 4.5 ? "bg-destructive" : "bg-blue-500"
                    )}
                    style={{ width: `${Math.min(100, (telemetry.sandMoisture / 6) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono">
                <div className="rounded bg-surface-2 p-2">
                  <p className="text-[10px] text-muted-foreground">Compactability</p>
                  <p className="font-bold text-foreground">{telemetry.compactability} %</p>
                </div>
                <div className="rounded bg-surface-2 p-2">
                  <p className="text-[10px] text-muted-foreground">Squeeze Head</p>
                  <p className="font-bold text-foreground">{telemetry.squeezePressure} kPa</p>
                </div>
              </div>
            </div>
          </div>

          {/* Station 3 Card */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-md">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-purple-500/10 text-purple-400">
                  <Droplets className="size-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Automated Pouring Cell</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">Twin ID: pouring-twin</p>
                </div>
              </div>
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-muted-foreground">Pre-Pour Defect Probability</span>
                  <span
                    className={cn(
                      "font-bold",
                      telemetry.defectRisk > 0.3 ? "text-destructive" : "text-emerald-400"
                    )}
                  >
                    {(telemetry.defectRisk * 100).toFixed(1)} %
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      telemetry.defectRisk > 0.3 ? "bg-destructive" : "bg-emerald-500"
                    )}
                    style={{ width: `${Math.min(100, telemetry.defectRisk * 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono">
                <div className="rounded bg-surface-2 p-2">
                  <p className="text-[10px] text-muted-foreground">Pour Stream</p>
                  <p className="font-bold text-foreground">{telemetry.pourTemp} °C</p>
                </div>
                <div className="rounded bg-surface-2 p-2">
                  <p className="text-[10px] text-muted-foreground">Flow Rate</p>
                  <p className="font-bold text-foreground">{telemetry.pourRate} kg/s</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FactorySimulatorPage;
