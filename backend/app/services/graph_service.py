"""Graph Service — Neo4j operations for manufacturing ontology."""

from typing import Any

from app.database import neo4j_driver


class GraphService:
    """Service for managing the manufacturing knowledge graph in Neo4j."""

    def _check_driver(self):
        if neo4j_driver is None:
            raise RuntimeError("Neo4j driver not available")

    async def create_entity(self, label: str, pg_id: int, props: dict) -> dict:
        """Create a node in the graph representing a PG entity."""
        self._check_driver()
        async with neo4j_driver.session() as session:
            # Sanitize label to prevent injection
            safe_labels = [
                "Factory", "Workshop", "ProductionLine", "Equipment", "Sensor",
                "Product", "Material", "SalesOrder", "WorkOrder",
                "Supplier", "Customer", "Warehouse",
                "Inspection", "Defect", "Worker",
            ]
            if label not in safe_labels:
                raise ValueError(f"Invalid label: {label}")

            result = await session.run(
                f"CREATE (n:{label} {{pg_id: $pg_id}}) SET n += $props RETURN n",
                pg_id=pg_id,
                props=props,
            )
            records = await result.data()
            return records[0] if records else {}

    async def create_relation(
        self,
        src_label: str,
        src_id: int,
        tgt_label: str,
        tgt_id: int,
        rel_type: str,
        props: dict | None = None,
    ) -> dict:
        """Create a relationship between two entities."""
        self._check_driver()
        safe_rels = [
            "CONTAINS", "PRODUCES", "REQUIRES", "SUPPLIES",
            "INSPECTS", "MAINTAINS", "FEEDS", "ASSIGNED_TO", "STORED_IN",
        ]
        if rel_type not in safe_rels:
            raise ValueError(f"Invalid relation type: {rel_type}")

        async with neo4j_driver.session() as session:
            result = await session.run(
                f"MATCH (a:{src_label} {{pg_id: $src_id}}) "
                f"MATCH (b:{tgt_label} {{pg_id: $tgt_id}}) "
                f"MERGE (a)-[r:{rel_type}]->(b) SET r += $props RETURN r",
                src_id=src_id,
                tgt_id=tgt_id,
                props=props or {},
            )
            records = await result.data()
            return records[0] if records else {}

    async def get_neighbors(self, entity_id: int, limit: int = 50) -> list[dict]:
        """Get all neighbors of an entity."""
        self._check_driver()
        async with neo4j_driver.session() as session:
            result = await session.run(
                "MATCH (n {pg_id: $entity_id})-[r]-(m) "
                "RETURN n, type(r) AS rel_type, labels(m) AS target_labels, m AS target "
                "LIMIT $limit",
                entity_id=entity_id,
                limit=limit,
            )
            return await result.data()

    async def get_shortest_path(self, src_id: int, tgt_id: int, max_hops: int = 6) -> list[dict]:
        """Find shortest path between two entities."""
        self._check_driver()
        async with neo4j_driver.session() as session:
            result = await session.run(
                "MATCH p = shortestPath((a {pg_id: $src_id})-[*..6]-(b {pg_id: $tgt_id})) "
                "RETURN p",
                src_id=src_id,
                tgt_id=tgt_id,
            )
            return await result.data()

    async def get_subgraph(self, entity_id: int, depth: int = 2, limit: int = 100) -> list[dict]:
        """Extract subgraph around an entity."""
        self._check_driver()
        async with neo4j_driver.session() as session:
            result = await session.run(
                f"MATCH (n {{pg_id: $entity_id}})-[r*1..{depth}]-(m) "
                "RETURN n, r, m LIMIT $limit",
                entity_id=entity_id,
                limit=limit,
            )
            return await result.data()

    async def get_stats(self) -> dict[str, Any]:
        """Get graph statistics."""
        self._check_driver()
        async with neo4j_driver.session() as session:
            node_result = await session.run(
                "MATCH (n) RETURN labels(n)[0] AS label, count(*) AS count ORDER BY count DESC"
            )
            node_data = await node_result.data()

            rel_result = await session.run(
                "MATCH ()-[r]->() RETURN type(r) AS rel_type, count(*) AS count ORDER BY count DESC"
            )
            rel_data = await rel_result.data()

            return {
                "total_nodes": sum(r["count"] for r in node_data),
                "total_relationships": sum(r["count"] for r in rel_data),
                "nodes_by_label": node_data,
                "relationships_by_type": rel_data,
            }

    async def build_from_seed(self, seed_data: dict[str, list[dict]]):
        """Build the initial graph from seed data.

        Creates nodes for all entities and establishes CONTAINS/PRODUCES/etc relationships.
        """
        # Create entity nodes
        entity_map = {
            "factories": "Factory",
            "workshops": "Workshop",
            "production_lines": "ProductionLine",
            "equipment": "Equipment",
            "sensors": "Sensor",
            "products": "Product",
            "materials": "Material",
            "suppliers": "Supplier",
            "customers": "Customer",
            "workers": "Worker",
        }

        for data_key, label in entity_map.items():
            if data_key not in seed_data:
                continue
            for entity in seed_data[data_key]:
                props = {k: v for k, v in entity.items() if k != "id"}
                await self.create_entity(label, entity["id"], props)

        # Create CONTAINS relationships (hierarchy)
        if "workshops" in seed_data:
            for ws in seed_data["workshops"]:
                await self.create_relation("Factory", ws["factory_id"], "Workshop", ws["id"], "CONTAINS")

        if "production_lines" in seed_data:
            for pl in seed_data["production_lines"]:
                await self.create_relation("Workshop", pl["workshop_id"], "ProductionLine", pl["id"], "CONTAINS")

        if "equipment" in seed_data:
            for eq in seed_data["equipment"]:
                await self.create_relation("ProductionLine", eq["line_id"], "Equipment", eq["id"], "CONTAINS")

        if "sensors" in seed_data:
            for s in seed_data["sensors"]:
                await self.create_relation("Equipment", s["equipment_id"], "Sensor", s["id"], "FEEDS")


graph_service = GraphService()
