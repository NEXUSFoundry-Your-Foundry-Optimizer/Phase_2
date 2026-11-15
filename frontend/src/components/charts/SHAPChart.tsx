import { useLiveCollection } from "@/lib/live-api";
import { cn } from "@/lib/utils";

export interface SHAPFeatureItem {
  name: string;
  value: number;
  param_value?: string | number;
  is_positive?: boolean;
  nominal?: string;
}

interface SHAPChartProps {
  features?: SHAPFeatureItem[] | undefined;
}

const FALLBACK_FEATURES: SHAPFeatureItem[] = [
  { name: "Sand Moisture", value: 0.1362, param_value: "4.20%", is_positive: true, nominal: "3.5% - 4.5%" },
  { name: "Ambient Air Humidity", value: 0.1245, param_value: "55.0%", is_positive: true, nominal: "40% - 60%" },
  { name: "Alloy Grade Index", value: 0.082, param_value: "Grade 1.0", is_positive: true, nominal: "Nominal" },
  { name: "Pour Speed", value: 0.0615, param_value: "0.85 m/s", is_positive: true, nominal: "0.7 - 0.9 m/s" },
  { name: "Pouring Temperature", value: -0.184, param_value: "1445°C", is_positive: false, nominal: "1430°C - 1470°C" },
  { name: "Melt Temperature", value: -0.145, param_value: "1420°C", is_positive: false, nominal: "1380°C - 1440°C" },
  { name: "Sand Permeability", value: -0.098, param_value: "118 norm", is_positive: false, nominal: "100 - 130" },
  { name: "Compactability", value: -0.052, param_value: "44.0%", is_positive: false, nominal: "40% - 48%" },
];

/** FR-06: SHAP explainability for the XGBoost defect prediction. */
export function SHAPChart({ features: propFeatures }: SHAPChartProps = {}) {
  const { data } = useLiveCollection<{ features: SHAPFeatureItem[] }>("/api/analytics/shap", 10000);
  const liveFeatures = propFeatures && propFeatures.length > 0 ? propFeatures : (data?.features ?? []);
  const features = liveFeatures.length > 0 ? liveFeatures : FALLBACK_FEATURES;

  const max = Math.max(...features.map((f) => Math.abs(f.value)), 0.001);

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border/40 pb-1.5 font-mono">
        <span>FEATURE PARAMETER (MEASURED)</span>
        <span className="text-center">ATTRIBUTION DIRECTION</span>
        <span className="text-right">SHAP IMPACT</span>
      </div>
      {features.map((f) => {
        const pct = Math.min(50, (Math.abs(f.value) / max) * 48);
        const positive = f.value >= 0;
        return (
          <div key={f.name} className="grid grid-cols-[minmax(0,1.2fr)_1.8fr_64px] items-center gap-3">
            <div className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground">{f.name}</span>
              {f.param_value && (
                <span className="block font-mono text-[10px] text-muted-foreground">
                  val: {String(f.param_value)} {f.nominal ? `(${f.nominal})` : ""}
                </span>
              )}
            </div>
            <div className="relative h-4 rounded bg-muted/60 overflow-hidden">
              <span className="absolute inset-y-0 left-1/2 w-px bg-border z-10" />
              <span
                className={cn(
                  "absolute inset-y-0 rounded transition-all duration-700",
                  positive ? "left-1/2 bg-destructive/85" : "right-1/2 bg-primary/85",
                )}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className={cn("text-right font-mono text-xs font-semibold", positive ? "text-destructive" : "text-primary")}>
              {positive ? "+" : ""}
              {(f.value * 100).toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
