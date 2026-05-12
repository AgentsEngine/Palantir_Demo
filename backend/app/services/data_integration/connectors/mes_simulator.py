"""Data integration connectors — MES Simulator."""

import json
import random
from datetime import datetime, timedelta


def generate_mes_data(hours: int = 24, factory_id: int = 1) -> list[dict]:
    """Generate simulated MES (Manufacturing Execution System) data.

    Returns work order progress, operation status, and production counts.
    """
    data = []
    base_time = datetime.now() - timedelta(hours=hours)

    work_order_prefixes = ["WO-A", "WO-B", "WO-C"]
    operations = ["切割", "焊接", "组装", "测试", "包装"]
    statuses = ["completed", "in_progress", "pending", "pending"]

    for hour in range(hours):
        timestamp = base_time + timedelta(hours=hour)
        for wo_idx, prefix in enumerate(work_order_prefixes):
            for op_idx, op_name in enumerate(operations):
                if random.random() < 0.7:
                    status = random.choice(statuses)
                    data.append({
                        "timestamp": timestamp.isoformat(),
                        "factory_id": factory_id,
                        "work_order": f"{prefix}-{1001 + wo_idx}",
                        "operation": op_name,
                        "operation_seq": op_idx + 1,
                        "status": status,
                        "quantity_completed": random.randint(0, 50) if status == "completed" else random.randint(0, 30),
                        "quantity_target": 50,
                        "operator_id": f"OP-{random.randint(1, 20):03d}",
                        "equipment_id": f"EQ-{random.randint(1, 15):03d}",
                        "cycle_time_sec": random.uniform(30, 120),
                        "scrap_count": random.randint(0, 2),
                    })

    return data


def generate_erp_data(days: int = 30) -> list[dict]:
    """Generate simulated ERP data — sales orders, purchase orders, inventory."""
    data = []
    base_date = datetime.now() - timedelta(days=days)

    for day in range(days):
        date = base_date + timedelta(days=day)
        # Sales orders
        for _ in range(random.randint(1, 5)):
            data.append({
                "type": "sales_order",
                "date": date.strftime("%Y-%m-%d"),
                "order_no": f"SO-{date.strftime('%Y%m%d')}-{random.randint(1, 999):03d}",
                "customer": f"客户{random.choice(['A', 'B', 'C', 'D', 'E'])}",
                "product_sku": f"SKU-{random.randint(1000, 1099)}",
                "quantity": random.randint(50, 500),
                "unit_price": round(random.uniform(10, 200), 2),
                "due_date": (date + timedelta(days=random.randint(7, 30))).strftime("%Y-%m-%d"),
                "status": random.choice(["confirmed", "in_production", "shipped", "delivered"]),
            })

        # Purchase orders
        for _ in range(random.randint(1, 3)):
            data.append({
                "type": "purchase_order",
                "date": date.strftime("%Y-%m-%d"),
                "order_no": f"PO-{date.strftime('%Y%m%d')}-{random.randint(1, 999):03d}",
                "supplier": f"供应商{random.randint(1, 8)}",
                "material_sku": f"MAT-{random.randint(2000, 2099)}",
                "quantity": random.randint(100, 2000),
                "eta": (date + timedelta(days=random.randint(3, 14))).strftime("%Y-%m-%d"),
                "status": random.choice(["pending", "confirmed", "in_transit", "received"]),
            })

    return data


def generate_iot_data(
    equipment_count: int = 10,
    duration_hours: int = 24,
    interval_minutes: int = 5,
) -> list[dict]:
    """Generate simulated IoT sensor data."""
    data = []
    base_time = datetime.now() - timedelta(hours=duration_hours)

    sensor_types = [
        {"name": "温度", "unit": "°C", "range": (20, 85), "anomaly_range": (90, 110)},
        {"name": "振动", "unit": "mm/s", "range": (0.5, 4.5), "anomaly_range": (5.0, 8.0)},
        {"name": "压力", "unit": "MPa", "range": (0.5, 3.0), "anomaly_range": (3.5, 5.0)},
        {"name": "转速", "unit": "RPM", "range": (1200, 1800), "anomaly_range": (2000, 2500)},
        {"name": "电流", "unit": "A", "range": (5, 25), "anomaly_range": (30, 45)},
    ]

    total_points = duration_hours * 60 // interval_minutes

    for eq_id in range(1, equipment_count + 1):
        for sensor in sensor_types:
            for point_idx in range(total_points):
                timestamp = base_time + timedelta(minutes=point_idx * interval_minutes)
                is_anomaly = random.random() < 0.02  # 2% anomaly rate

                if is_anomaly:
                    value = round(random.uniform(*sensor["anomaly_range"]), 2)
                    status = "alarm"
                else:
                    # Normal value with slight drift based on time
                    base = random.uniform(*sensor["range"])
                    noise = random.uniform(-0.5, 0.5)
                    value = round(max(sensor["range"][0], min(sensor["range"][1], base + noise)), 2)
                    status = "normal"

                data.append({
                    "timestamp": timestamp.isoformat(),
                    "equipment_id": f"EQ-{eq_id:03d}",
                    "sensor_type": sensor["name"],
                    "unit": sensor["unit"],
                    "value": value,
                    "status": status,
                })

    return data


def generate_plc_data(equipment_count: int = 10, hours: int = 1) -> list[dict]:
    """Generate simulated PLC (Programmable Logic Controller) data."""
    data = []
    base_time = datetime.now() - timedelta(hours=hours)

    for eq_id in range(1, equipment_count + 1):
        for minute in range(hours * 60):
            timestamp = base_time + timedelta(minutes=minute)
            data.append({
                "timestamp": timestamp.isoformat(),
                "equipment_id": f"EQ-{eq_id:03d}",
                "run_state": random.choices(
                    ["running", "idle", "fault", "setup"],
                    weights=[75, 15, 3, 7],
                )[0],
                "cycle_count": random.randint(0, 5),
                "good_count": random.randint(0, 5),
                "reject_count": random.randint(0, 1),
                "program_no": f"PRG-{random.randint(1, 10):03d}",
                "alarm_code": random.choice(["", "", "", "E001", "E002", "W001"]) or None,
            })

    return data
