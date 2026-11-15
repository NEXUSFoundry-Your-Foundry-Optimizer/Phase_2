from typing import Dict, Any, Optional, List
import logging
import joblib
import pandas as pd

from backend.app.ml.xgboost_model import MODEL_DIR

logger = logging.getLogger(__name__)

PARAM_METADATA = {
    "sand_moisture": {
        "label": "Sand Moisture",
        "unit": "%",
        "nominal": "3.5% - 4.5%",
        "reason_high": "Elevated sand moisture causes rapid steam evolution upon molten contact, leading to gas porosity, blowholes, and sand wash defects.",
        "reason_low": "Low sand moisture weakens green sand bonding, causing mold erosion and friability inclusions.",
    },
    "permeability": {
        "label": "Sand Permeability",
        "unit": "norm",
        "nominal": "100 - 130",
        "reason_high": "Excessive permeability allows rough mold wall penetration and surface finish degradation.",
        "reason_low": "Low mold permeability restricts gas escape during filling, entrapping venting gases as pinholes and blowholes.",
    },
    "compactness": {
        "label": "Compactability",
        "unit": "%",
        "nominal": "40% - 48%",
        "reason_high": "Excess compaction reduces venting channels, increasing gas entrapment probability.",
        "reason_low": "Under-compacted molds suffer from structural collapse and dimensional swelling.",
    },
    "pour_temp": {
        "label": "Pouring Temperature",
        "unit": "°C",
        "nominal": "1430°C - 1470°C",
        "reason_high": "Excessive pouring temperature promotes hydrogen pickup, oxide dross formation, and severe mold wall erosion.",
        "reason_low": "Low pouring temperature causes cold shuts, incomplete cavity filling (misruns), and premature freezing.",
    },
    "melt_temp": {
        "label": "Melt Temperature",
        "unit": "°C",
        "nominal": "1380°C - 1440°C",
        "reason_high": "Overheating in the furnace accelerates refractory lining wear and slag generation.",
        "reason_low": "Insufficient melt temperature delays degassing and homogenization.",
    },
    "pour_speed": {
        "label": "Pour Speed",
        "unit": "m/s",
        "nominal": "0.7 - 0.9 m/s",
        "reason_high": "Excessive pour velocity induces severe turbulence, aspirating air and generating turbulent oxide film defects.",
        "reason_low": "Sluggish pour rate leads to temperature loss and cold shut folds in thin sections.",
    },
    "ambient_air_humidity": {
        "label": "Ambient Air Humidity",
        "unit": "%",
        "nominal": "40% - 60%",
        "reason_high": "High ambient moisture elevates humidity in the foundry atmosphere, increasing dissolved hydrogen in molten iron.",
        "reason_low": "Low humidity accelerates green sand drying at mold surfaces.",
    },
    "ambient_air_temp": {
        "label": "Ambient Air Temperature",
        "unit": "°C",
        "nominal": "20°C - 30°C",
        "reason_high": "Elevated shop temperature slows initial mold cooling gradients.",
        "reason_low": "Cold ambient temperature accelerates surface chilling.",
    },
    "lining_health": {
        "label": "Furnace Lining Health",
        "unit": "%",
        "nominal": "80% - 100%",
        "reason_high": "Healthy refractory integrity minimizes refractory erosion inclusions.",
        "reason_low": "Degraded lining introduces refractory particulate inclusions and thermal loss.",
    },
    "ladle_fill": {
        "label": "Ladle Fill",
        "unit": "%",
        "nominal": "80% - 95%",
        "reason_high": "Optimal ladle volume maintains thermal inertia during transfer.",
        "reason_low": "Low ladle volume causes rapid convective cooling before pour initiation.",
    },
    "shape_2": {
        "label": "CAD Shape Dimension 2 (Hotspot Fillets)",
        "unit": "norm",
        "nominal": "[-0.50, +0.50]",
        "reason_high": "Encodes acute internal junction fillets and boss intersections. High values indicate isolated thermal masses prone to shrinkage voids.",
        "reason_low": "Smooth uniform geometric transitions with progressive feeding channels.",
    },
    "shape_15": {
        "label": "CAD Shape Dimension 15 (Feeder Modulus)",
        "unit": "norm",
        "nominal": "[-0.50, +0.50]",
        "reason_high": "Thermal center volume requires supplementary riser head capacity.",
        "reason_low": "Adequate thermal gradient and direct riser feeding path.",
    },
    "shape_32": {
        "label": "CAD Shape Dimension 32 (Thin-Wall Modulus)",
        "unit": "norm",
        "nominal": "[-0.50, +0.50]",
        "reason_high": "Thin-wall perimeter sections (<6.5mm) increase local chilling rate and cold shut risk.",
        "reason_low": "Balanced wall thickness distribution.",
    },
    "alloy_grade_encoded": {
        "label": "Alloy Grade Index",
        "unit": "",
        "nominal": "Grade 1.0 (Standard Ductile Iron)",
        "reason_high": "Alloy grade composition specifies higher carbon equivalent sensitivity.",
        "reason_low": "Base metallurgical composition.",
    },
}

class SHAPExplainer:
    """
    Provides SHAP feature attribution explanations for XGBoost predictions.
    """
    def __init__(self):
        self.explainer: Optional[Any] = None
        self.feature_names: List[str] = []
        self.load_error: Optional[str] = None
        self._init_explainer()

    def _init_explainer(self):
        try:
            self.explainer = joblib.load(MODEL_DIR / "shap_explainer.pkl")
            self.feature_names = list(joblib.load(MODEL_DIR / "xgboost_feature_names.pkl"))
            self.load_error = None
        except Exception as exc:
            try:
                import shap
                from backend.app.ml.xgboost_model import xgboost_model
                if xgboost_model.model is not None:
                    self.explainer = shap.TreeExplainer(xgboost_model.model)
                    self.feature_names = list(xgboost_model.feature_names)
                    self.load_error = None
                else:
                    self.load_error = f"trained SHAP artifact unavailable: {exc}"
            except Exception as inner_exc:
                self.load_error = f"trained SHAP artifact unavailable: {exc}; fallback: {inner_exc}"

    def explain(self, prediction_id: str, features: Dict[str, Any], query: Optional[str] = None) -> Dict[str, Any]:
        if self.explainer is None:
            self._init_explainer()

        if self.explainer is not None and self.feature_names:
            from backend.app.ml.xgboost_model import xgboost_model

            frame = pd.DataFrame(
                [{name: float(features.get(name, 0.0) or 0.0) for name in self.feature_names}],
                columns=self.feature_names,
            )

            # Transform with scaler if fitted
            if xgboost_model.scaler is not None:
                try:
                    scaled = xgboost_model.scaler.transform(frame)
                    scaled_frame = pd.DataFrame(scaled, columns=self.feature_names)
                    values = self.explainer.shap_values(scaled_frame)[0]
                except Exception:
                    values = self.explainer.shap_values(frame)[0]
            else:
                values = self.explainer.shap_values(frame)[0]

            attributions = {name: round(float(value), 4) for name, value in zip(self.feature_names, values)}
            magnitude_total = sum(abs(value) for value in attributions.values()) or 1.0

            # Sort features by absolute attribution
            sorted_by_abs = sorted(attributions.items(), key=lambda x: abs(x[1]), reverse=True)

            # Determine top risk driver (highest positive attribution pushing risk up, or top magnitude)
            positive_attributions = {k: v for k, v in attributions.items() if v > 0}
            if positive_attributions:
                top_risk_driver = max(positive_attributions, key=lambda k: positive_attributions[k])
            elif sorted_by_abs:
                top_risk_driver = sorted_by_abs[0][0]
            else:
                top_risk_driver = "sand_moisture"

            # Create top feature list with measured values and friendly names
            top_features = []
            for name, val in sorted_by_abs[:8]:
                meta = PARAM_METADATA.get(name, {})
                label = meta.get("label", name.replace("_", " ").title())
                curr_val = features.get(name, 0.0)
                unit = meta.get("unit", "")
                param_display = f"{curr_val:.2f}{unit}" if isinstance(curr_val, (int, float)) and curr_val != 0 else str(curr_val)
                top_features.append({
                    "name": label,
                    "key": name,
                    "value": val,
                    "param_value": param_display,
                    "is_positive": val >= 0,
                    "nominal": meta.get("nominal", "Nominal range"),
                })

            driver_meta = PARAM_METADATA.get(top_risk_driver, {})
            driver_label = driver_meta.get("label", top_risk_driver.replace("_", " ").title())

            # Generate natural language explanation for why this defect occurred
            explanation_data = self.generate_narrative_explanation(
                query=query or "why this defect",
                features=features,
                attributions=attributions,
                top_risk_driver=top_risk_driver,
                driver_label=driver_label,
                top_features=top_features,
            )

            groups = {
                "temperature": ("melt_temp", "pour_temp"),
                "lining": ("lining_health",),
                "geometry": tuple(name for name in self.feature_names if name.startswith("shape_")),
                "molding": ("sand_moisture", "permeability", "compactness"),
                "pouring": ("pour_speed", "pour_duration_sec", "ladle_fill"),
            }
            contribution_groups = {
                label: round(sum(abs(attributions.get(name, 0.0)) for name in names) / magnitude_total * 100, 2)
                for label, names in groups.items()
            }
            expected = self.explainer.expected_value
            base_value = float(expected[0] if hasattr(expected, "__len__") else expected) if expected is not None else 0.0

            return {
                "prediction_id": prediction_id,
                "batch_id": features.get("batch_id", "BATCH-DEFAULT"),
                "base_value": base_value,
                "feature_attributions": attributions,
                "contribution_groups": contribution_groups,
                "top_risk_driver": driver_label,
                "top_risk_driver_key": top_risk_driver,
                "recommendation": f"Monitor {driver_label} before the next pour. {driver_meta.get('reason_high', '')}",
                "top_features": top_features,
                "explanation_text": explanation_data["narrative"],
                "key_parameters": explanation_data["key_parameters"],
                "model_source": "artifact:xgboost_shap_tree_explainer",
            }

        fallback_driver = "Sand Moisture"
        return {
            "prediction_id": prediction_id,
            "batch_id": features.get("batch_id", "BATCH-DEFAULT"),
            "base_value": 0.0,
            "feature_attributions": {},
            "contribution_groups": {},
            "top_risk_driver": fallback_driver,
            "top_risk_driver_key": "sand_moisture",
            "recommendation": f"Monitor {fallback_driver} before the next pour.",
            "top_features": [],
            "explanation_text": "SHAP feature attribution currently synchronizing with model state.",
            "key_parameters": [],
            "model_source": "unavailable:trained_shap_artifact",
            "error": self.load_error,
        }

    def generate_narrative_explanation(
        self,
        query: str,
        features: Dict[str, Any],
        attributions: Dict[str, float],
        top_risk_driver: str,
        driver_label: str,
        top_features: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Generates a detailed engineering explanation explaining why the defect occurred based on parameters.
        """
        pos_drivers = [f for f in top_features if f["value"] > 0]
        neg_drivers = [f for f in top_features if f["value"] < 0]

        driver_meta = PARAM_METADATA.get(top_risk_driver, {})
        driver_val = features.get(top_risk_driver, 0.0)
        driver_unit = driver_meta.get("unit", "")

        param_items = []
        for feat in top_features[:5]:
            meta = PARAM_METADATA.get(feat["key"], {})
            reason = meta.get("reason_high" if feat["value"] > 0 else "reason_low", "Parameter influence within expected bounds.")
            param_items.append({
                "parameter": feat["name"],
                "value": feat["param_value"],
                "impact": f"{'+' if feat['value'] >= 0 else ''}{(feat['value'] * 100):.2f}%",
                "direction": "Risk Driver" if feat["value"] >= 0 else "Stabilizing Factor",
                "explanation": reason,
                "nominal": feat["nominal"],
            })

        narrative_lines = [
            f"**XGBoost + TreeSHAP Diagnostic Analysis:**",
            f"The model's defect risk prediction is primarily governed by **{driver_label}** (current value: `{driver_val}{driver_unit}`), which introduces the strongest attribution (+{abs(attributions.get(top_risk_driver, 0.0))*100:.2f}% relative SHAP impact).",
        ]

        if pos_drivers:
            drivers_str = ", ".join([f"**{d['name']}** (+{d['value']*100:.2f}%)" for d in pos_drivers[:3]])
            narrative_lines.append(f"- **Primary Risk Elevators:** {drivers_str}. {driver_meta.get('reason_high', '')}")

        if neg_drivers:
            neg_str = ", ".join([f"**{d['name']}** ({d['value']*100:.2f}%)" for d in neg_drivers[:2]])
            narrative_lines.append(f"- **Risk Mitigating Factors:** {neg_str} are operating near safe operational setpoints, providing stability.")

        narrative_lines.append(f"- **Operational Action:** Maintain {driver_label} within nominal limits ({driver_meta.get('nominal', 'nominal range')}) prior to ladle tap and pour execution.")

        return {
            "narrative": "\n\n".join(narrative_lines),
            "key_parameters": param_items,
        }

shap_explainer = SHAPExplainer()
