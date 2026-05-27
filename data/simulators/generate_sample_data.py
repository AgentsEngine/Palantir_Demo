"""Generate full manufacturing demo seed data.

The generated files are used by scripts/seed_data.py and local auto-seeding.
Keep relationships stable by assigning explicit ids and referencing only rows
created in this script.
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path


RANDOM_SEED = 20260527
BASE_TIME = datetime(2026, 5, 27, 10, 0, 0)


def dump_json(output_dir: Path, name: str, rows: list[dict]) -> None:
    with (output_dir / f"{name}.json").open("w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


def pick(items: list[str], index: int) -> str:
    return items[index % len(items)]


def generate_all(output_dir: str | None = None) -> None:
    out = Path(output_dir) if output_dir else Path(__file__).resolve().parents[1] / "seed"
    out.mkdir(parents=True, exist_ok=True)
    random.seed(RANDOM_SEED)

    cities = ["上海", "苏州", "宁波", "武汉", "成都", "合肥", "无锡", "常州", "杭州", "青岛"]
    factory_types = ["精密装配", "电子组装", "机加工", "压铸", "新能源部件"]
    factories = [
        {
            "id": i,
            "name": f"{pick(cities, i)}{pick(factory_types, i)}工厂",
            "location": f"{pick(cities, i)}工业园区 {100 + i} 号",
            "capacity": 28000 + i * 2300,
            "status": "active" if i % 13 else "maintenance",
            "description": f"覆盖{pick(factory_types, i)}制造、检验、仓储和追溯业务。",
        }
        for i in range(1, 321)
    ]

    workshop_types = ["machining", "smt", "assembly", "inspection", "warehouse", "surface", "testing", "packaging"]
    workshops = [
        {
            "id": i,
            "name": f"{pick(cities, i)}{pick(workshop_types, i).upper()}车间-{i:03d}",
            "factory_id": ((i - 1) % len(factories)) + 1,
            "area": 650 + (i % 18) * 120,
            "workshop_type": pick(workshop_types, i),
        }
        for i in range(1, 641)
    ]

    production_lines = [
        {
            "id": i,
            "name": f"{workshops[(i - 1) % len(workshops)]['name']}-{chr(65 + (i % 4))}线",
            "workshop_id": ((i - 1) % len(workshops)) + 1,
            "capacity": 420 + (i % 22) * 85,
            "oee_target": round(0.82 + (i % 9) * 0.01, 2),
            "status": random.choices(["running", "idle", "maintenance"], weights=[78, 14, 8])[0],
        }
        for i in range(1, 961)
    ]

    equipment_kinds = [
        ("CNC加工中心", "DMG MORI", "CMX 800 V"),
        ("数控车床", "Mazak", "QT-250"),
        ("焊接机器人", "FANUC", "ARC Mate 100iD"),
        ("六轴机器人", "ABB", "IRB 6700"),
        ("注塑机", "海天", "MA3200"),
        ("冲压机", "AIDA", "NC1-2000"),
        ("三坐标测量仪", "Hexagon", "Global S"),
        ("AOI检测机", "KOH YOUNG", "Zenith"),
        ("贴片机", "FUJI", "NXT-III"),
        ("回流焊", "Heller", "1913 MKIII"),
        ("老化测试箱", "ESPEC", "PL-3KPH"),
        ("AGV搬运车", "海康机器人", "MR-C2S4"),
    ]
    equipment = []
    for i in range(1, 1921):
        kind, maker, model = equipment_kinds[i % len(equipment_kinds)]
        health = round(random.uniform(42, 99), 1)
        equipment.append({
            "id": i,
            "name": f"{kind}-{i:04d}",
            "line_id": ((i - 1) % len(production_lines)) + 1,
            "model": model,
            "manufacturer": maker,
            "install_date": (BASE_TIME - timedelta(days=random.randint(90, 2200))).date().isoformat(),
            "status": "running" if health >= 68 else ("maintenance" if health >= 52 else "fault"),
            "health_score": health,
        })

    sensor_types = [
        ("温度传感器", "°C", 10),
        ("振动传感器", "mm/s", 5),
        ("压力传感器", "MPa", 5),
        ("电流传感器", "A", 5),
        ("转速传感器", "RPM", 30),
    ]
    sensors = []
    for eq in equipment:
        for offset, (sensor_type, unit, rate) in enumerate(random.sample(sensor_types, 3), start=1):
            sensor_id = len(sensors) + 1
            sensors.append({
                "id": sensor_id,
                "name": f"{sensor_type}-{eq['id']:04d}-{offset}",
                "equipment_id": eq["id"],
                "sensor_type": sensor_type,
                "unit": unit,
                "sampling_rate": rate,
            })

    product_categories = ["控制模块", "伺服组件", "液压部件", "连接器", "传感器", "精密壳体", "电控柜", "密封组件"]
    products = [
        {
            "id": i,
            "name": f"{pick(product_categories, i)}-{i:04d}",
            "sku": f"SKU-{100000 + i}",
            "category": pick(product_categories, i),
            "specs": f"版本 V{1 + i % 6}.{i % 10}，客户族群 {pick(['汽车', '能源', '装备', '电子'], i)}",
            "unit": "件",
        }
        for i in range(1, 421)
    ]

    material_types = ["电子元件", "金属材料", "塑胶件", "标准件", "包装材料", "化学品", "线束", "密封材料"]
    materials = [
        {
            "id": i,
            "name": f"{pick(material_types, i)}-{7000 + i}",
            "material_type": pick(material_types, i),
            "specs": f"规格 {chr(65 + i % 6)}-{i % 20:02d}",
            "unit": pick(["件", "kg", "卷", "箱", "L"], i),
            "safety_stock": 120 + (i % 45) * 35,
        }
        for i in range(1, 521)
    ]

    suppliers = [
        {
            "id": i,
            "name": f"{pick(cities, i)}{pick(['精密', '电子', '材料', '物流', '自动化'], i)}供应商-{i:03d}",
            "location": pick(cities, i),
            "rating": round(random.uniform(3.1, 5.0), 1),
            "lead_time_days": random.randint(3, 28),
            "contact": f"supplier{i:03d}@manufoundry.demo",
        }
        for i in range(1, 361)
    ]

    customer_industries = ["汽车零部件", "工程机械", "新能源", "工业自动化", "轨道交通", "消费电子"]
    customers = [
        {
            "id": i,
            "name": f"{pick(cities, i)}{pick(customer_industries, i)}客户-{i:03d}",
            "industry": pick(customer_industries, i),
            "region": pick(cities, i),
        }
        for i in range(1, 361)
    ]

    worker_roles = ["生产操作员", "质量检验员", "维修工程师", "工艺工程师", "仓储操作员", "班组长", "计划员"]
    workers = [
        {
            "id": i,
            "name": f"员工{i:04d}",
            "role": pick(worker_roles, i),
            "department": pick(["生产部", "质量部", "设备部", "工艺部", "供应链部", "仓储部"], i),
        }
        for i in range(1, 721)
    ]

    sales_orders = []
    for i in range(1, 901):
        qty = random.randint(80, 1800)
        due_date = BASE_TIME + timedelta(days=random.randint(1, 90))
        sales_orders.append({
            "id": i,
            "order_no": f"SO-2026-{i:05d}",
            "customer_id": random.randint(1, len(customers)),
            "product_id": random.randint(1, len(products)),
            "quantity": qty,
            "due_date": due_date.replace(hour=23, minute=59).isoformat(),
            "priority": random.choices(["low", "normal", "high", "critical"], weights=[8, 62, 24, 6])[0],
            "status": random.choices(["pending", "confirmed", "in_progress", "completed", "cancelled"], weights=[10, 28, 34, 24, 4])[0],
        })

    work_orders = []
    for i in range(1, 1801):
        status = random.choices(["pending", "in_progress", "completed", "cancelled"], weights=[14, 42, 40, 4])[0]
        quantity = random.randint(50, 1200)
        completed = 0 if status == "pending" else random.randint(int(quantity * 0.15), quantity)
        if status == "completed":
            completed = quantity
        start = BASE_TIME - timedelta(days=random.randint(0, 30), hours=random.randint(0, 16))
        end = start + timedelta(hours=random.randint(6, 96))
        work_orders.append({
            "id": i,
            "order_no": f"WO-2026-{i:05d}",
            "sales_order_id": random.randint(1, len(sales_orders)),
            "line_id": random.randint(1, len(production_lines)),
            "planned_start": start.isoformat(),
            "planned_end": end.isoformat(),
            "actual_start": (start + timedelta(minutes=random.randint(0, 180))).isoformat() if status != "pending" else None,
            "actual_end": (end - timedelta(minutes=random.randint(0, 240))).isoformat() if status == "completed" else None,
            "quantity": quantity,
            "completed_quantity": completed,
            "status": status,
        })

    inspections = []
    for i in range(1, 2201):
        result = random.choices(["pass", "fail", "conditional"], weights=[78, 13, 9])[0]
        target_type = random.choice(["product", "equipment", "material", "work_order"])
        target_limit = {
            "product": len(products),
            "equipment": len(equipment),
            "material": len(materials),
            "work_order": len(work_orders),
        }[target_type]
        inspections.append({
            "id": i,
            "inspection_type": random.choice(["incoming", "in_process", "final"]),
            "target_type": target_type,
            "target_id": random.randint(1, target_limit),
            "result": result,
            "inspector_id": random.randint(1, len(workers)),
            "inspected_at": (BASE_TIME - timedelta(hours=random.randint(1, 1440))).isoformat(),
        })

    defect_types = ["尺寸超差", "表面划伤", "焊接气孔", "装配松动", "电气短路", "密封泄漏", "颜色偏差", "标识错误", "虚焊", "毛刺"]
    failed_inspections = [row["id"] for row in inspections if row["result"] != "pass"]
    defects = []
    for i in range(1, 901):
        defect_type = pick(defect_types, i)
        severity = random.choices(["minor", "major", "critical"], weights=[58, 32, 10])[0]
        defects.append({
            "id": i,
            "inspection_id": random.choice(failed_inspections),
            "defect_type": defect_type,
            "severity": severity,
            "description": f"{defect_type}，等级 {severity}，来源批次 Q-{20260500 + (i % 27):08d}",
            "root_cause": random.choice(["设备精度漂移", "工艺参数偏差", "来料波动", "操作不一致", "环境温湿度异常"]),
            "correction": random.choice(["返工", "报废", "让步接收", "返修", "停线整改", "供应商 8D"]),
        })

    spc_parameters = [
        ("焊接温度", 350.0),
        ("切割尺寸", 100.0),
        ("压入力", 25.0),
        ("平面度", 0.05),
        ("电阻值", 50.0),
        ("扭矩", 12.0),
    ]
    spc_points = []
    for parameter, center in spc_parameters:
        sigma = center * 0.04 if center > 1 else 0.006
        for hour in range(0, 720):
            value = round(random.gauss(center, sigma), 4)
            spc_points.append({
                "id": len(spc_points) + 1,
                "parameter": parameter,
                "value": value,
                "ucl": round(center + 3 * sigma, 4),
                "lcl": round(max(center - 3 * sigma, 0), 4),
                "cl": center,
                "equipment_id": random.randint(1, len(equipment)),
                "timestamp": (BASE_TIME - timedelta(hours=719 - hour)).isoformat(),
            })

    sensor_readings = []
    sensor_baselines = {
        "温度传感器": 58,
        "振动传感器": 2.4,
        "压力传感器": 1.7,
        "电流传感器": 14,
        "转速传感器": 1450,
    }
    for sensor in sensors[:900]:
        baseline = sensor_baselines.get(sensor["sensor_type"], 50)
        for slot in range(24):
            value = round(baseline + random.uniform(-baseline * 0.16, baseline * 0.16), 3)
            sensor_readings.append({
                "id": len(sensor_readings) + 1,
                "sensor_id": sensor["id"],
                "value": value,
                "timestamp": (BASE_TIME - timedelta(hours=23 - slot)).isoformat(),
            })

    seed_data = {
        "factories": factories,
        "workshops": workshops,
        "production_lines": production_lines,
        "equipment": equipment,
        "sensors": sensors,
        "products": products,
        "materials": materials,
        "suppliers": suppliers,
        "customers": customers,
        "workers": workers,
        "sales_orders": sales_orders,
        "work_orders": work_orders,
        "inspections": inspections,
        "defects": defects,
        "spc_points": spc_points,
        "sensor_readings": sensor_readings,
    }

    for name, rows in seed_data.items():
        dump_json(out, name, rows)

    print("=== ManuFoundry seed data generated ===")
    for name, rows in seed_data.items():
        print(f"{name}: {len(rows)}")
    print(f"output: {out}")


if __name__ == "__main__":
    generate_all()
