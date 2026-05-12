"""Pipeline Engine — simplified data transformation pipeline."""

import json
from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class StepType(str, Enum):
    EXTRACT = "extract"
    TRANSFORM = "transform"
    MAP_TO_ONTOLOGY = "map_to_ontology"
    LOAD = "load"
    VALIDATE = "validate"


class PipelineStep(BaseModel):
    name: str
    step_type: StepType
    config: dict
    enabled: bool = True


class PipelineConfig(BaseModel):
    source_type: str  # mes, erp, iot, plc
    steps: list[PipelineStep]
    schedule: str | None = None


class PipelineResult(BaseModel):
    pipeline_id: int
    status: str
    started_at: datetime
    finished_at: datetime | None = None
    records_processed: int = 0
    records_failed: int = 0
    step_results: list[dict] = []
    error_message: str | None = None


class PipelineEngine:
    """Execute data pipeline steps."""

    def __init__(self):
        self.transformers = {
            "clean_nulls": self._clean_nulls,
            "normalize_units": self._normalize_units,
            "deduplicate": self._deduplicate,
            "map_entity": self._map_to_entity,
            "validate_schema": self._validate_schema,
        }

    async def execute(self, pipeline_id: int, config: PipelineConfig, raw_data: list[dict]) -> PipelineResult:
        result = PipelineResult(
            pipeline_id=pipeline_id,
            status="running",
            started_at=datetime.now(),
        )

        current_data = raw_data
        for step in config.steps:
            if not step.enabled:
                continue
            try:
                step_result = {"step": step.name, "type": step.step_type, "status": "started"}
                if step.step_type == StepType.EXTRACT:
                    step_result["records_in"] = len(current_data)
                elif step.step_type == StepType.TRANSFORM:
                    transform_fn = self.transformers.get(step.config.get("operation"))
                    if transform_fn:
                        current_data = transform_fn(current_data, step.config)
                    step_result["records_out"] = len(current_data)
                elif step.step_type == StepType.VALIDATE:
                    current_data = self._validate_schema(current_data, step.config)
                    step_result["valid_records"] = len(current_data)
                elif step.step_type == StepType.LOAD:
                    step_result["records_loaded"] = len(current_data)

                step_result["status"] = "completed"
                result.step_results.append(step_result)
            except Exception as e:
                result.step_results.append({"step": step.name, "status": "failed", "error": str(e)})
                result.status = "failed"
                result.error_message = f"Step '{step.name}' failed: {e}"
                break

        if result.status != "failed":
            result.status = "completed"
        result.records_processed = len(current_data)
        result.finished_at = datetime.now()
        return result

    def _clean_nulls(self, data: list[dict], config: dict) -> list[dict]:
        fields = config.get("fields", [])
        return [row for row in data if all(row.get(f) is not None for f in fields)]

    def _normalize_units(self, data: list[dict], config: dict) -> list[dict]:
        field = config.get("field")
        from_unit = config.get("from_unit")
        to_unit = config.get("to_unit")
        conversions = {("F", "C"): lambda v: (v - 32) * 5 / 9, ("psi", "MPa"): lambda v: v * 0.006895}
        key = (from_unit, to_unit)
        if key in conversions:
            for row in data:
                if field in row and isinstance(row[field], (int, float)):
                    row[field] = round(conversions[key](row[field]), 4)
        return data

    def _deduplicate(self, data: list[dict], config: dict) -> list[dict]:
        key_fields = config.get("key_fields", ["id"])
        seen = set()
        result = []
        for row in data:
            key = tuple(row.get(f) for f in key_fields)
            if key not in seen:
                seen.add(key)
                result.append(row)
        return result

    def _map_to_entity(self, data: list[dict], config: dict) -> list[dict]:
        mapping = config.get("field_mapping", {})
        return [{mapping.get(k, k): v for k, v in row.items()} for row in data]

    def _validate_schema(self, data: list[dict], config: dict) -> list[dict]:
        required = config.get("required_fields", [])
        return [row for row in data if all(row.get(f) is not None for f in required)]
