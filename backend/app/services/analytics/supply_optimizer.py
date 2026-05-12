"""Supply Chain Optimization Service."""

import random
from datetime import datetime, timedelta
from typing import Any

import numpy as np


class SupplyOptimizerService:
    """Supply chain analysis and optimization."""

    def calculate_safety_stock(
        self,
        avg_daily_demand: float,
        demand_std: float,
        lead_time_days: int,
        lead_time_std: float,
        service_level: float = 0.95,
    ) -> dict[str, Any]:
        """Calculate optimal safety stock using statistical model.

        Safety Stock = Z * sqrt(LT * σ_d² + d² * σ_LT²)
        """
        from scipy.stats import norm
        z_score = norm.ppf(service_level)
        safety_stock = z_score * np.sqrt(
            lead_time_days * demand_std ** 2 + avg_daily_demand ** 2 * lead_time_std ** 2
        )
        reorder_point = avg_daily_demand * lead_time_days + safety_stock

        return {
            "safety_stock": round(float(safety_stock), 1),
            "reorder_point": round(float(reorder_point), 1),
            "avg_daily_demand": avg_daily_demand,
            "lead_time_days": lead_time_days,
            "service_level": service_level,
            "z_score": round(float(z_score), 3),
        }

    def evaluate_supplier_risk(self, supplier_data: dict) -> dict[str, Any]:
        """Evaluate supplier risk based on multiple factors."""
        factors = {
            "delivery_reliability": supplier_data.get("on_time_rate", 0.9),
            "quality_rating": supplier_data.get("quality_score", 0.95) / 5,
            "financial_stability": supplier_data.get("financial_score", 0.8),
            "geopolitical_risk": 1 - supplier_data.get("geo_risk", 0.2),
            "concentration_risk": 1 - supplier_data.get("revenue_share", 0.3),
        }

        weights = {
            "delivery_reliability": 0.30,
            "quality_rating": 0.25,
            "financial_stability": 0.20,
            "geopolitical_risk": 0.15,
            "concentration_risk": 0.10,
        }

        risk_score = sum(factors[k] * weights[k] for k in factors)
        risk_score = round((1 - risk_score) * 100, 1)

        risk_level = "high" if risk_score > 60 else ("medium" if risk_score > 30 else "low")

        return {
            "supplier_id": supplier_data.get("id"),
            "supplier_name": supplier_data.get("name"),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "factors": {k: round(v * 100, 1) for k, v in factors.items()},
        }

    def optimize_inventory(
        self,
        current_stock: float,
        safety_stock: float,
        reorder_point: float,
        order_quantity: float,
        daily_demand: float,
        lead_time: int,
    ) -> dict[str, Any]:
        """Generate inventory optimization recommendations."""
        days_of_stock = current_stock / max(daily_demand, 0.01)
        stock_status = "surplus"
        if current_stock < safety_stock:
            stock_status = "critical"
        elif current_stock < reorder_point:
            stock_status = "reorder_needed"
        elif days_of_stock > 30:
            stock_status = "overstock"

        recommendations = []
        if stock_status == "critical":
            recommendations.append("立即下紧急订单补货")
        elif stock_status == "reorder_needed":
            recommendations.append(f"建议下单 {order_quantity} 件，预计 {lead_time} 天到货")
        elif stock_status == "overstock":
            recommendations.append("库存偏高，建议减少下次采购量或延迟下单")

        return {
            "current_stock": current_stock,
            "safety_stock": round(safety_stock, 1),
            "reorder_point": round(reorder_point, 1),
            "days_of_stock": round(days_of_stock, 1),
            "stock_status": stock_status,
            "recommendations": recommendations,
        }
