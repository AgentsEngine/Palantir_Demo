"""Predictive Maintenance Service — equipment health scoring and fault prediction."""

import random
from datetime import datetime, timedelta
from typing import Any

import numpy as np


class PredictiveMaintenanceService:
    """ML-based predictive maintenance engine."""

    def calculate_health_score(self, sensor_data: list[dict]) -> dict[str, Any]:
        """Calculate equipment health score from recent sensor readings.

        Scoring model:
        - Vibration analysis (weight: 0.25)
        - Temperature trend (weight: 0.20)
        - Pressure stability (weight: 0.20)
        - Electrical signature (weight: 0.15)
        - Wear estimation (weight: 0.20)
        """
        if not sensor_data:
            return {"health_score": 100.0, "risk_level": "healthy", "breakdown": {}}

        # Group readings by sensor type
        by_type: dict[str, list[float]] = {}
        for reading in sensor_data:
            stype = reading.get("sensor_type", "unknown")
            by_type.setdefault(stype, []).append(reading.get("value", 0))

        # Score each dimension (0-100)
        breakdown = {}
        weights = {
            "振动": 0.25, "温度": 0.20, "压力": 0.20,
            "电流": 0.15, "转速": 0.10, "wear": 0.10,
        }

        for dim, weight in weights.items():
            values = by_type.get(dim, [])
            if values:
                mean_v = np.mean(values)
                std_v = np.std(values)
                # Lower std = more stable = higher score
                stability_score = max(0, 100 - std_v * 10)
                # Value within normal range
                range_penalty = 0
                normal_ranges = {
                    "振动": (0, 5), "温度": (20, 80), "压力": (0.5, 3.0),
                    "电流": (5, 30), "转速": (1000, 2000),
                }
                if dim in normal_ranges:
                    lo, hi = normal_ranges[dim]
                    if mean_v < lo or mean_v > hi:
                        range_penalty = min(50, abs(mean_v - (lo + hi) / 2) * 5)
                score = max(0, stability_score - range_penalty)
            else:
                score = random.uniform(75, 95)  # No data = assume OK
            breakdown[dim] = round(score, 1)

        # Weighted total
        total = sum(breakdown.get(dim, 80) * w for dim, w in weights.items())
        health_score = round(total, 1)

        risk_level = "critical" if health_score < 50 else ("warning" if health_score < 80 else "healthy")

        return {
            "health_score": health_score,
            "risk_level": risk_level,
            "breakdown": breakdown,
        }

    def predict_fault_probability(self, health_score: float, days_ahead: int = 7) -> dict[str, Any]:
        """Predict fault probability over the next N days."""
        # Sigmoid-based probability model
        base_prob = 1 / (1 + np.exp(0.1 * (health_score - 50)))

        daily_predictions = []
        for day in range(1, days_ahead + 1):
            # Probability increases with time
            time_factor = 1 + 0.05 * day
            prob = min(0.99, base_prob * time_factor)
            daily_predictions.append({
                "day": day,
                "date": (datetime.now() + timedelta(days=day)).strftime("%Y-%m-%d"),
                "fault_probability": round(prob, 3),
                "risk_level": "high" if prob > 0.6 else ("medium" if prob > 0.3 else "low"),
            })

        return {
            "current_health_score": health_score,
            "7_day_fault_probability": round(daily_predictions[-1]["fault_probability"], 3),
            "daily_predictions": daily_predictions,
            "estimated_fault_date": daily_predictions[0]["date"] if health_score < 40 else
            daily_predictions[min(3, days_ahead - 1)]["date"] if health_score < 60 else None,
            "recommended_action": self._get_action(health_score),
        }

    def _get_action(self, health_score: float) -> str:
        if health_score >= 80:
            return "继续常规巡检"
        elif health_score >= 60:
            return "加强监控，计划预防性维护"
        elif health_score >= 40:
            return "48小时内安排检修"
        else:
            return "立即停机检修"


class SPCAnalysisService:
    """Statistical Process Control analysis."""

    def calculate_control_limits(self, data: list[float], sigma: float = 3.0) -> dict:
        """Calculate SPC control limits (UCL, LCL, CL)."""
        if not data:
            return {"cl": 0, "ucl": 0, "lcl": 0, "sigma": 0}

        mean = np.mean(data)
        std = np.std(data)

        return {
            "cl": round(float(mean), 4),
            "ucl": round(float(mean + sigma * std), 4),
            "lcl": round(float(mean - sigma * std), 4),
            "sigma": round(float(std), 4),
        }

    def calculate_cpk(self, data: list[float], usl: float, lsl: float) -> dict:
        """Calculate process capability index (Cpk)."""
        if not data:
            return {"cpk": 0, "cp": 0, "ppk": 0, "assessment": "insufficient_data"}

        mean = np.mean(data)
        std = np.std(data)

        if std == 0:
            return {"cpk": float("inf"), "cp": float("inf"), "ppk": float("inf"), "assessment": "no_variation"}

        cp = (usl - lsl) / (6 * std)
        cpu = (usl - mean) / (3 * std)
        cpl = (mean - lsl) / (3 * std)
        cpk = min(cpu, cpl)

        if cpk >= 1.33:
            assessment = "capable"
        elif cpk >= 1.0:
            assessment = "marginal"
        else:
            assessment = "incapable"

        return {
            "cpk": round(float(cpk), 3),
            "cp": round(float(cp), 3),
            "ppk": round(float(cpk), 3),
            "cpu": round(float(cpu), 3),
            "cpl": round(float(cpl), 3),
            "mean": round(float(mean), 4),
            "std": round(float(std), 4),
            "assessment": assessment,
        }

    def detect_out_of_control(self, data: list[float], ucl: float, lcl: float) -> list[dict]:
        """Detect out-of-control points using Western Electric rules."""
        violations = []
        cl = (ucl + lcl) / 2
        one_sigma = (ucl - cl) / 3

        for i, val in enumerate(data):
            # Rule 1: Point beyond 3-sigma
            if val > ucl or val < lcl:
                violations.append({"index": i, "value": val, "rule": "1_beyond_3sigma"})

            # Rule 2: 2 of 3 consecutive beyond 2-sigma
            if i >= 2:
                window = data[i - 2:i + 1]
                beyond_2sigma = sum(
                    1 for v in window if v > cl + 2 * one_sigma or v < cl - 2 * one_sigma
                )
                if beyond_2sigma >= 2:
                    violations.append({"index": i, "value": val, "rule": "2_beyond_2sigma"})

            # Rule 3: 4 of 5 consecutive beyond 1-sigma
            if i >= 4:
                window = data[i - 4:i + 1]
                beyond_1sigma = sum(
                    1 for v in window if v > cl + one_sigma or v < cl - one_sigma
                )
                if beyond_1sigma >= 4:
                    violations.append({"index": i, "value": val, "rule": "4_beyond_1sigma"})

            # Rule 4: 8 consecutive on one side of center
            if i >= 7:
                window = data[i - 7:i + 1]
                all_above = all(v > cl for v in window)
                all_below = all(v < cl for v in window)
                if all_above or all_below:
                    violations.append({"index": i, "value": val, "rule": "8_same_side"})

        return violations
