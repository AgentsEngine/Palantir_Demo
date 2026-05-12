"""Seed data import script — load JSON data into PostgreSQL and build Neo4j graph."""

import asyncio
import json
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.services.graph_service import graph_service


SEED_DIR = Path(__file__).resolve().parent.parent / "data" / "seed"

# Table name → (JSON file, insert SQL template)
TABLE_CONFIGS = {
    "factories": (
        "factories.json",
        "INSERT INTO factories (id, name, location, capacity, status, description) "
        "VALUES (:id, :name, :location, :capacity, :status, :description)",
    ),
    "workshops": (
        "workshops.json",
        "INSERT INTO workshops (id, name, factory_id, area, workshop_type) "
        "VALUES (:id, :name, :factory_id, :area, :workshop_type)",
    ),
    "production_lines": (
        "production_lines.json",
        "INSERT INTO production_lines (id, name, workshop_id, capacity, oee_target, status) "
        "VALUES (:id, :name, :workshop_id, :capacity, :oee_target, :status)",
    ),
    "equipment": (
        "equipment.json",
        "INSERT INTO equipment (id, name, line_id, model, manufacturer, install_date, status, health_score) "
        "VALUES (:id, :name, :line_id, :model, :manufacturer, :install_date, :status, :health_score)",
    ),
    "sensors": (
        "sensors.json",
        "INSERT INTO sensors (id, name, equipment_id, sensor_type, unit, sampling_rate) "
        "VALUES (:id, :name, :equipment_id, :sensor_type, :unit, :sampling_rate)",
    ),
    "products": (
        "products.json",
        "INSERT INTO products (id, name, sku, category, specs, unit) "
        "VALUES (:id, :name, :sku, :category, :specs, :unit)",
    ),
    "materials": (
        "materials.json",
        "INSERT INTO materials (id, name, material_type, specs, unit, safety_stock) "
        "VALUES (:id, :name, :material_type, :specs, :unit, :safety_stock)",
    ),
    "suppliers": (
        "suppliers.json",
        "INSERT INTO suppliers (id, name, location, rating, lead_time_days, contact) "
        "VALUES (:id, :name, :location, :rating, :lead_time_days, :contact)",
    ),
    "customers": (
        "customers.json",
        "INSERT INTO customers (id, name, industry, region) "
        "VALUES (:id, :name, :industry, :region)",
    ),
    "workers": (
        "workers.json",
        "INSERT INTO workers (id, name, role, department) "
        "VALUES (:id, :name, :role, :department)",
    ),
    "sales_orders": (
        "sales_orders.json",
        "INSERT INTO sales_orders (id, order_no, customer_id, product_id, quantity, due_date, priority, status) "
        "VALUES (:id, :order_no, :customer_id, :product_id, :quantity, :due_date, :priority, :status)",
    ),
    "work_orders": (
        "work_orders.json",
        "INSERT INTO work_orders (id, order_no, sales_order_id, line_id, planned_start, planned_end, "
        "actual_start, actual_end, quantity, completed_quantity, status) "
        "VALUES (:id, :order_no, :sales_order_id, :line_id, :planned_start, :planned_end, "
        ":actual_start, :actual_end, :quantity, :completed_quantity, :status)",
    ),
    "inspections": (
        "inspections.json",
        "INSERT INTO inspections (id, inspection_type, target_type, target_id, result, inspector_id, inspected_at) "
        "VALUES (:id, :inspection_type, :target_type, :target_id, :result, :inspector_id, :inspected_at)",
    ),
    "defects": (
        "defects.json",
        "INSERT INTO defects (id, inspection_id, defect_type, severity, description, root_cause, correction) "
        "VALUES (:id, :inspection_id, :defect_type, :severity, :description, :root_cause, :correction)",
    ),
    "spc_points": (
        "spc_points.json",
        "INSERT INTO spc_points (id, parameter, value, ucl, lcl, cl, equipment_id, timestamp) "
        "VALUES (:id, :parameter, :value, :ucl, :lcl, :cl, :equipment_id, :timestamp)",
    ),
}


async def create_tables(engine):
    """Create all tables from SQLAlchemy models."""
    from app.models.relational import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")


async def seed_postgresql(engine):
    """Load JSON seed data into PostgreSQL."""
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    for table_name, (json_file, sql) in TABLE_CONFIGS.items():
        file_path = SEED_DIR / json_file
        if not file_path.exists():
            print(f"  SKIP {table_name}: {json_file} not found")
            continue

        with open(file_path, encoding="utf-8") as f:
            data = json.load(f)

        async with async_session() as session:
            try:
                await session.execute(text(sql), data)
                await session.commit()
                print(f"  INSERT {table_name}: {len(data)} rows")
            except Exception as e:
                print(f"  ERROR {table_name}: {e}")
                await session.rollback()

    # Handle sensor_readings separately (large file)
    readings_path = SEED_DIR / "sensor_readings.json"
    if readings_path.exists():
        with open(readings_path, encoding="utf-8") as f:
            readings = json.load(f)

        # Batch insert (1000 at a time)
        batch_size = 1000
        reading_sql = (
            "INSERT INTO sensor_readings (id, sensor_id, value, timestamp) "
            "VALUES (:id, :sensor_id, :value, :timestamp)"
        )
        async with async_session() as session:
            for i in range(0, len(readings), batch_size):
                batch = readings[i:i + batch_size]
                try:
                    await session.execute(text(reading_sql), batch)
                    await session.commit()
                except Exception as e:
                    print(f"  ERROR sensor_readings batch {i}: {e}")
                    await session.rollback()
        print(f"  INSERT sensor_readings: {len(readings)} rows")


async def seed_neo4j():
    """Build knowledge graph in Neo4j from seed data."""
    seed_data = {}
    for json_file in SEED_DIR.glob("*.json"):
        key = json_file.stem
        if key not in ("sensor_readings", "spc_points"):
            with open(json_file, encoding="utf-8") as f:
                seed_data[key] = json.load(f)

    await graph_service.build_from_seed(seed_data)
    print("Neo4j graph built.")


async def main():
    print("=== ManuFoundry 数据初始化 ===\n")

    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    print("[1/3] Creating tables...")
    await create_tables(engine)

    print("\n[2/3] Seeding PostgreSQL...")
    await seed_postgresql(engine)

    print("\n[3/3] Building Neo4j graph...")
    try:
        await seed_neo4j()
    except Exception as e:
        print(f"  Neo4j connection failed (skip): {e}")

    await engine.dispose()
    print("\n=== Done! ===")


if __name__ == "__main__":
    asyncio.run(main())
