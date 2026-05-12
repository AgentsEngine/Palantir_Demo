"""Generate comprehensive sample manufacturing data for demo."""

import json
import random
from datetime import datetime, timedelta
from pathlib import Path


def generate_all(output_dir: str):
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    random.seed(42)

    # ── Factory hierarchy ──────────────────────────────
    factories = [
        {"id": 1, "name": "宁海智能制造中心", "location": "浙江省宁波市宁海县", "capacity": 50000, "status": "active", "description": "集团总部工厂，涵盖精密加工、装配和检验全流程"},
        {"id": 2, "name": "苏州精密部件厂", "location": "江苏省苏州市工业园区", "capacity": 30000, "status": "active", "description": "专注精密机械部件加工"},
        {"id": 3, "name": "武汉电子组装厂", "location": "湖北省武汉市光谷", "capacity": 80000, "status": "active", "description": "电子元器件组装与测试"},
    ]

    workshops = [
        {"id": i, "name": name, "factory_id": fid, "area": area, "workshop_type": wtype}
        for i, (name, fid, area, wtype) in enumerate([
            ("CNC加工车间", 1, 2000, "machining"),
            ("焊接车间", 1, 1500, "welding"),
            ("装配车间", 1, 3000, "assembly"),
            ("质检中心", 1, 800, "inspection"),
            ("精密铸造车间", 2, 1800, "casting"),
            ("表面处理车间", 2, 1200, "surface"),
            ("SMT贴片车间", 3, 2500, "smt"),
            ("测试老化车间", 3, 2000, "testing"),
        ], start=1)
    ]

    line_names = ["A线", "B线", "C线", "D线"]
    production_lines = []
    line_id = 1
    for ws in workshops:
        n_lines = random.randint(1, 3)
        for j in range(n_lines):
            production_lines.append({
                "id": line_id,
                "name": f"{ws['name']}-{line_names[j]}",
                "workshop_id": ws["id"],
                "capacity": random.randint(500, 2000),
                "oee_target": round(random.uniform(0.82, 0.92), 2),
                "status": random.choice(["running", "running", "running", "idle", "maintenance"]),
            })
            line_id += 1

    # ── Equipment ──────────────────────────────────────
    equipment_types = [
        ("CNC加工中心", "DMG MORI", "CMX 800 V"),
        ("数控车床", "Mazak", "QT-250"),
        ("焊接机器人", "FANUC", "ARC Mate 100iD"),
        ("六轴机器人", "ABB", "IRB 6700"),
        ("注塑机", "海天", "MA3200"),
        ("冲压机", "AIDA", "NC1-2000"),
        ("三坐标测量仪", "Hexagon", "Global S"),
        ("超声波清洗机", "洁盟", "JP-120ST"),
        ("AOI检测设备", "KOH YOUNG", "Zenith"),
        ("贴片机", "FUJI", "NXT-III"),
        ("回流焊", "Heller", "1913 MKIII"),
        ("老化测试箱", "ESPEC", "PL-3KPH"),
        ("AGV搬运车", "海康机器人", "MR-C2S4-2000"),
        ("激光切割机", "Trumpf", "TruLaser 3030"),
        ("液压机", "纵横", "YH-315T"),
    ]

    equipment = []
    eq_id = 1
    for line in production_lines:
        n_eq = random.randint(3, 6)
        for _ in range(n_eq):
            etype, mfr, model = random.choice(equipment_types)
            health = round(random.uniform(35, 100), 1)
            equipment.append({
                "id": eq_id,
                "name": f"{etype}-{eq_id:03d}",
                "line_id": line["id"],
                "model": model,
                "manufacturer": mfr,
                "install_date": (datetime.now() - timedelta(days=random.randint(180, 1825))).strftime("%Y-%m-%d"),
                "status": "running" if health > 60 else ("maintenance" if health > 40 else "fault"),
                "health_score": health,
            })
            eq_id += 1

    # ── Sensors ────────────────────────────────────────
    sensor_types = [
        ("温度传感器", "°C", 10),
        ("振动传感器", "mm/s", 5),
        ("压力传感器", "MPa", 5),
        ("电流传感器", "A", 5),
        ("转速传感器", "RPM", 60),
    ]
    sensors = []
    s_id = 1
    for eq in equipment:
        for stype, unit, rate in random.sample(sensor_types, k=min(3, len(sensor_types))):
            sensors.append({
                "id": s_id,
                "name": f"{stype}-{s_id:03d}",
                "equipment_id": eq["id"],
                "sensor_type": stype,
                "unit": unit,
                "sampling_rate": rate,
            })
            s_id += 1

    # ── Products & Materials ───────────────────────────
    products = [
        {"id": i, "name": name, "sku": sku, "category": cat, "specs": specs, "unit": "个"}
        for i, (name, sku, cat, specs) in enumerate([
            ("高精度轴承组件", "SKU-1001", "机械部件", "内径φ50mm，精度P4"),
            ("伺服电机壳体", "SKU-1002", "铸件", "铝合金ADC12，壁厚3mm"),
            ("工业控制器PCBA", "SKU-1003", "电子组件", "4层板，BGA+QFP"),
            ("液压阀块总成", "SKU-1004", "液压部件", "通径DN10，压力31.5MPa"),
            ("精密齿轮箱", "SKU-1005", "传动部件", "减速比1:50，输出扭矩500Nm"),
            ("传感器模组", "SKU-1006", "电子模块", "含温度+压力双传感器"),
            ("工业连接器", "SKU-1007", "连接器", "M12，8芯，IP67"),
            ("定制密封件", "SKU-1008", "密封件", "氟橡胶，耐温200°C"),
        ], start=1)
    ]

    materials = [
        {"id": i, "name": name, "material_type": mtype, "specs": specs, "unit": unit, "safety_stock": ss}
        for i, (name, mtype, specs, unit, ss) in enumerate([
            ("45#圆钢", "钢材", "φ80mm", "kg", 5000),
            ("铝合金锭ADC12", "有色金属", "标准锭", "kg", 3000),
            ("FR-4覆铜板", "电子材料", "1.6mm 4层", "片", 500),
            ("BGA芯片", "电子元件", "0.5mm间距", "个", 10000),
            ("液压油46#", "油品", "L-HM46", "L", 2000),
            ("氟橡胶生胶", "橡胶", "FKM", "kg", 500),
            ("M12连接器针脚", "连接器零件", "镀金", "个", 20000),
            ("焊锡丝", "焊接材料", "Sn96.5/Ag3.0/Cu0.5 0.5mm", "卷", 200),
        ], start=1)
    ]

    # ── Suppliers ──────────────────────────────────────
    suppliers = [
        {"id": i, "name": name, "location": loc, "rating": round(random.uniform(3.5, 5.0), 1),
         "lead_time_days": lt, "contact": f"contact{i}@supplier.com"}
        for i, (name, loc, lt) in enumerate([
            ("宝钢股份", "上海", 7),
            ("中铝集团", "北京", 10),
            ("生益科技", "广东东莞", 5),
            ("村田制作所", "日本京都", 14),
            ("昆仑润滑", "辽宁大连", 7),
            ("3M中国", "上海", 5),
            ("TE Connectivity", "上海", 10),
            ("千住金属", "日本大阪", 14),
            ("巴斯夫", "上海", 7),
            ("信越化学", "日本东京", 21),
            ("博世", "江苏无锡", 7),
            ("斯凯孚", "上海", 10),
        ], start=1)
    ]

    # ── Customers ──────────────────────────────────────
    customers = [
        {"id": i, "name": name, "industry": ind, "region": reg}
        for i, (name, ind, reg) in enumerate([
            ("三一重工", "工程机械", "湖南长沙"),
            ("中车时代", "轨道交通", "湖南株洲"),
            ("汇川技术", "自动化", "广东深圳"),
            ("大族激光", "激光设备", "广东深圳"),
            ("埃斯顿", "工业机器人", "江苏南京"),
            ("绿的谐波", "精密传动", "江苏苏州"),
        ], start=1)
    ]

    # ── Workers ────────────────────────────────────────
    roles = ["CNC操作员", "焊接工", "装配工", "质检员", "维修工", "班组长", "工艺工程师"]
    workers = [
        {"id": i, "name": f"员工{i:03d}", "role": random.choice(roles), "department": random.choice(["生产部", "质量部", "设备部"])}
        for i in range(1, 31)
    ]

    # ── Write all seed files ───────────────────────────
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
    }

    for name, data in seed_data.items():
        with open(out / f"{name}.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    # Generate sensor readings (24 hours of data)
    now = datetime.now()
    sensor_readings = []
    reading_id = 1
    for sensor in sensors[:50]:  # First 50 sensors
        for hour in range(24):
            ts = now - timedelta(hours=23 - hour)
            base_values = {"温度传感器": 55, "振动传感器": 2.5, "压力传感器": 1.8, "电流传感器": 15, "转速传感器": 1500}
            base = base_values.get(sensor["sensor_type"], 50)
            for minute in range(0, 60, sensor["sampling_rate"]):
                timestamp = ts.replace(minute=minute, second=0, microsecond=0)
                value = round(base + random.uniform(-base * 0.15, base * 0.15), 2)
                sensor_readings.append({
                    "id": reading_id,
                    "sensor_id": sensor["id"],
                    "value": value,
                    "timestamp": timestamp.isoformat(),
                })
                reading_id += 1

    with open(out / "sensor_readings.json", "w", encoding="utf-8") as f:
        json.dump(sensor_readings, f, ensure_ascii=False)

    # Generate SPC data
    spc_points = []
    spc_params = ["焊接温度", "切割尺寸", "扭矩", "平面度", "电阻值"]
    for param_idx, param in enumerate(spc_params):
        cl = [350, 100, 25, 0.05, 50][param_idx]
        sigma = cl * 0.05
        for hour in range(168):  # 7 days hourly
            ts = now - timedelta(hours=167 - hour)
            value = round(random.gauss(cl, sigma), 4)
            spc_points.append({
                "id": len(spc_points) + 1,
                "parameter": param,
                "value": value,
                "ucl": round(cl + 3 * sigma, 4),
                "lcl": round(cl - 3 * sigma, 4),
                "cl": cl,
                "equipment_id": random.randint(1, min(20, len(equipment))),
                "timestamp": ts.isoformat(),
            })

    with open(out / "spc_points.json", "w", encoding="utf-8") as f:
        json.dump(spc_points, f, ensure_ascii=False)

    # Generate inspections
    inspections = []
    for i in range(1, 101):
        insp_type = random.choice(["incoming", "in_process", "final"])
        result = random.choices(["pass", "pass", "pass", "fail", "conditional"], weights=[50, 20, 10, 10, 10])[0]
        target_type = random.choice(["product", "equipment", "material"])
        inspections.append({
            "id": i,
            "inspection_type": insp_type,
            "target_type": target_type,
            "target_id": random.randint(1, 10),
            "result": result,
            "inspector_id": random.randint(1, 30),
            "inspected_at": (now - timedelta(hours=random.randint(1, 720))).isoformat(),
        })

    with open(out / "inspections.json", "w", encoding="utf-8") as f:
        json.dump(inspections, f, ensure_ascii=False)

    # Generate defects
    defect_types = ["尺寸超差", "表面划伤", "焊接气孔", "装配松动", "电气短路", "密封泄漏", "颜色偏差", "标识错误"]
    defects = []
    for i in range(1, 31):
        severity = random.choices(["minor", "major", "critical"], weights=[50, 35, 15])[0]
        defects.append({
            "id": i,
            "inspection_id": random.randint(1, 100),
            "defect_type": random.choice(defect_types),
            "severity": severity,
            "description": f"{random.choice(defect_types)}，{severity}级别",
            "root_cause": random.choice(["操作不当", "设备精度不足", "原材料问题", "工艺参数偏差", "环境因素"]),
            "correction": random.choice(["返工", "报废", "让步接收", "返修", "停线整改"]),
        })

    with open(out / "defects.json", "w", encoding="utf-8") as f:
        json.dump(defects, f, ensure_ascii=False)

    # Generate sales orders and work orders
    sales_orders = []
    work_orders = []
    wo_id = 1
    for i in range(1, 21):
        qty = random.randint(100, 1000)
        so = {
            "id": i,
            "order_no": f"SO-2026-{i:04d}",
            "customer_id": random.randint(1, 6),
            "product_id": random.randint(1, 8),
            "quantity": qty,
            "due_date": (now + timedelta(days=random.randint(7, 60))).strftime("%Y-%m-%dT23:59:59"),
            "priority": random.choice(["low", "normal", "normal", "high", "critical"]),
            "status": random.choice(["pending", "confirmed", "in_progress", "completed"]),
        }
        sales_orders.append(so)

        # Create work orders for each sales order
        for j in range(random.randint(1, 3)):
            status = random.choice(["pending", "in_progress", "completed"])
            completed = random.randint(int(qty * 0.3), qty) if status != "pending" else 0
            work_orders.append({
                "id": wo_id,
                "order_no": f"WO-2026-{wo_id:04d}",
                "sales_order_id": i,
                "line_id": random.randint(1, len(production_lines)),
                "planned_start": (now - timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%dT08:00:00"),
                "planned_end": (now + timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%dT18:00:00"),
                "actual_start": (now - timedelta(days=random.randint(0, 7))).strftime("%Y-%m-%dT08:30:00") if status != "pending" else None,
                "actual_end": now.strftime("%Y-%m-%dT17:00:00") if status == "completed" else None,
                "quantity": qty // random.randint(1, 3),
                "completed_quantity": completed,
                "status": status,
            })
            wo_id += 1

    with open(out / "sales_orders.json", "w", encoding="utf-8") as f:
        json.dump(sales_orders, f, ensure_ascii=False, indent=2)
    with open(out / "work_orders.json", "w", encoding="utf-8") as f:
        json.dump(work_orders, f, ensure_ascii=False, indent=2)

    # Print summary
    print(f"=== ManuFoundry 种子数据生成完成 ===")
    print(f"工厂: {len(factories)} | 车间: {len(workshops)} | 产线: {len(production_lines)}")
    print(f"设备: {len(equipment)} | 传感器: {len(sensors)}")
    print(f"产品: {len(products)} | 物料: {len(materials)}")
    print(f"供应商: {len(suppliers)} | 客户: {len(customers)} | 工人: {len(workers)}")
    print(f"传感器读数: {len(sensor_readings)} | SPC数据点: {len(spc_points)}")
    print(f"检验记录: {len(inspections)} | 缺陷: {len(defects)}")
    print(f"销售订单: {len(sales_orders)} | 工单: {len(work_orders)}")
    print(f"\n输出目录: {out}")


if __name__ == "__main__":
    generate_all("C:/Users/12938/Desktop/文章/Palantir_Demo/data/seed")
