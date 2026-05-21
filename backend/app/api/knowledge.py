"""Knowledge base APIs for the local RAG MVP.

The first version intentionally keeps data in a stable demo contract and uses
local TF-IDF retrieval. This makes the feature runnable without external
embedding services while preserving the API shape needed for a future vector
store.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

router = APIRouter()


class KnowledgeSearchBody(BaseModel):
    query: str
    limit: int = 5
    object_type: str | None = None
    object_id: str | None = None


KNOWLEDGE_SOURCES = [
    {
        "id": "quality-sop",
        "name": "质量 SOP",
        "type": "sop",
        "owner": "质量管理部",
        "status": "indexed",
        "document_count": 2,
        "description": "质量异常、缺陷复核、批次冻结和 CAPA 编写规范。",
    },
    {
        "id": "historical-capa",
        "name": "历史 CAPA",
        "type": "capa",
        "owner": "质量工程团队",
        "status": "indexed",
        "document_count": 2,
        "description": "过往质量异常闭环、根因分析、纠正预防措施和审批记录。",
    },
    {
        "id": "supplier-reports",
        "name": "供应商整改报告",
        "type": "supplier_report",
        "owner": "采购与供应商质量",
        "status": "indexed",
        "document_count": 1,
        "description": "供应商提交的 8D、整改说明、批次说明和交付承诺。",
    },
    {
        "id": "equipment-logs",
        "name": "设备日志",
        "type": "equipment_log",
        "owner": "设备工程团队",
        "status": "indexed",
        "document_count": 1,
        "description": "设备报警、温区波动、维护备注和工程师复核记录。",
    },
]


KNOWLEDGE_DOCUMENTS = [
    {
        "id": "doc-sop-qe-001",
        "source_id": "quality-sop",
        "title": "焊点虚焊异常处置 SOP",
        "doc_type": "SOP",
        "status": "indexed",
        "updated_at": "2026-05-20 18:30",
        "summary": "定义 AOI 发现焊点虚焊后的复核、批次隔离、CAPA 和客户影响评估动作。",
        "linked_objects": [
            {"type": "QualityEvent", "id": "QE-20260521-001", "name": "电控模块焊点虚焊异常"},
            {"type": "Defect", "id": "defect-001", "name": "焊点虚焊"},
        ],
    },
    {
        "id": "doc-capa-052",
        "source_id": "historical-capa",
        "title": "CAPA-052 焊锡膏储存异常复盘",
        "doc_type": "CAPA",
        "status": "indexed",
        "updated_at": "2026-04-12 16:10",
        "summary": "历史 CAPA 记录显示焊锡膏冷藏运输和回温时间异常会显著提高虚焊风险。",
        "linked_objects": [
            {"type": "CAPA", "id": "capa-052", "name": "CAPA-052"},
            {"type": "MaterialBatch", "id": "material-batch-mb-7781", "name": "MB-7781 / 焊锡膏 S12"},
        ],
    },
    {
        "id": "doc-supplier-bc-8d",
        "source_id": "supplier-reports",
        "title": "北辰电子材料 8D 整改报告",
        "doc_type": "SupplierReport",
        "status": "indexed",
        "updated_at": "2026-05-18 10:45",
        "summary": "供应商说明同批次焊锡膏存在冷链温度记录缺口，承诺补充批次追溯和运输温控证明。",
        "linked_objects": [
            {"type": "Supplier", "id": "supplier-s-023", "name": "北辰电子材料"},
            {"type": "MaterialBatch", "id": "material-batch-mb-7781", "name": "MB-7781 / 焊锡膏 S12"},
        ],
    },
    {
        "id": "doc-equipment-smt-03",
        "source_id": "equipment-logs",
        "title": "SMT-03 回流焊温区 5 波动记录",
        "doc_type": "EquipmentLog",
        "status": "indexed",
        "updated_at": "2026-05-21 09:35",
        "summary": "设备日志显示温区 5 在异常前 20 分钟有轻微偏移，建议工程师复核温控曲线。",
        "linked_objects": [
            {"type": "Equipment", "id": "equipment-smt-03", "name": "SMT-03 回流焊"},
            {"type": "WorkOrder", "id": "workorder-260521-017", "name": "WO-260521-017"},
        ],
    },
    {
        "id": "doc-customer-risk",
        "source_id": "quality-sop",
        "title": "客户交付风险沟通规范",
        "doc_type": "SOP",
        "status": "indexed",
        "updated_at": "2026-05-10 14:00",
        "summary": "当质量异常影响客户订单时，应先确认替代批次，再由销售或客服发出交付风险说明。",
        "linked_objects": [
            {"type": "CustomerOrder", "id": "order-so-8821", "name": "SO-8821 / 华东客户"},
            {"type": "QualityEvent", "id": "QE-20260521-001", "name": "电控模块焊点虚焊异常"},
        ],
    },
]


KNOWLEDGE_CHUNKS = [
    {
        "id": "chunk-sop-qe-001-1",
        "document_id": "doc-sop-qe-001",
        "source_ref": "焊点虚焊异常处置 SOP / 第 2 节",
        "chunk_text": "AOI 连续发现焊点虚焊且缺陷率超过 2.0% 管控线时，应立即触发质量异常事件，并由质量经理确认影响范围。",
    },
    {
        "id": "chunk-sop-qe-001-2",
        "document_id": "doc-sop-qe-001",
        "source_ref": "焊点虚焊异常处置 SOP / 第 3 节",
        "chunk_text": "处置顺序建议为：冻结风险物料批次，发起复检，生成 CAPA 草稿，通知采购确认供应商批次风险。",
    },
    {
        "id": "chunk-capa-052-1",
        "document_id": "doc-capa-052",
        "source_ref": "CAPA-052 / 根因分析",
        "chunk_text": "历史案例 CAPA-052 显示，焊锡膏冷藏运输温度异常、回温时间不足和开封后暴露时间过长，均会增加焊点虚焊概率。",
    },
    {
        "id": "chunk-capa-052-2",
        "document_id": "doc-capa-052",
        "source_ref": "CAPA-052 / 纠正预防措施",
        "chunk_text": "纠正措施包括补充冷链记录、限制开封后使用时长、增加首件复检频率，并要求供应商提供批次温控证明。",
    },
    {
        "id": "chunk-supplier-bc-1",
        "document_id": "doc-supplier-bc-8d",
        "source_ref": "北辰电子材料 8D 整改报告 / D4",
        "chunk_text": "北辰电子材料承认 MB-7781 批次存在运输温控记录缺口，建议先冻结该批次待判定库存并补充供应商复核。",
    },
    {
        "id": "chunk-equipment-smt-03-1",
        "document_id": "doc-equipment-smt-03",
        "source_ref": "SMT-03 设备日志 / 09:12-09:35",
        "chunk_text": "SMT-03 回流焊温区 5 在 09:12 后出现轻微偏移，虽然未触发停机，但建议创建设备检查任务并复核温控曲线。",
    },
    {
        "id": "chunk-customer-risk-1",
        "document_id": "doc-customer-risk",
        "source_ref": "客户交付风险沟通规范 / 第 1 节",
        "chunk_text": "当异常影响客户订单时，应在质量经理确认隔离范围后，由销售确认替代批次和交付承诺，不建议直接承诺原交期。",
    },
]


def _document_by_id(document_id: str) -> dict[str, Any]:
    return next(item for item in KNOWLEDGE_DOCUMENTS if item["id"] == document_id)


def _source_by_id(source_id: str) -> dict[str, Any]:
    return next(item for item in KNOWLEDGE_SOURCES if item["id"] == source_id)


def _chunk_payload(chunk: dict[str, Any], score: float | None = None) -> dict[str, Any]:
    document = _document_by_id(chunk["document_id"])
    source = _source_by_id(document["source_id"])
    payload = {
        **chunk,
        "document_title": document["title"],
        "document_type": document["doc_type"],
        "document_summary": document["summary"],
        "source_name": source["name"],
        "source_type": source["type"],
        "linked_objects": document["linked_objects"],
    }
    if score is not None:
        payload["score"] = round(float(score), 4)
    return payload


@lru_cache(maxsize=1)
def _retriever():
    corpus = [
        f"{_document_by_id(chunk['document_id'])['title']} {_document_by_id(chunk['document_id'])['summary']} {chunk['chunk_text']}"
        for chunk in KNOWLEDGE_CHUNKS
    ]
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4))
    matrix = vectorizer.fit_transform(corpus)
    return vectorizer, matrix


def _matches_object(document: dict[str, Any], object_type: str | None, object_id: str | None) -> bool:
    if not object_type and not object_id:
        return True
    normalized_id = (object_id or "").lower()
    normalized_type = (object_type or "").lower()
    for linked in document["linked_objects"]:
        if normalized_type and linked["type"].lower() != normalized_type:
            continue
        if not normalized_id:
            return True
        if normalized_id in linked["id"].lower() or normalized_id in linked["name"].lower():
            return True
    return False


@router.get("/sources")
async def list_sources():
    return {"data": KNOWLEDGE_SOURCES}


@router.get("/documents")
async def list_documents(source_id: str | None = None):
    documents = KNOWLEDGE_DOCUMENTS
    if source_id:
        documents = [item for item in documents if item["source_id"] == source_id]
    return {"data": documents}


@router.get("/documents/{document_id}/chunks")
async def list_document_chunks(document_id: str):
    if not any(item["id"] == document_id for item in KNOWLEDGE_DOCUMENTS):
        raise HTTPException(status_code=404, detail="Knowledge document not found")
    chunks = [chunk for chunk in KNOWLEDGE_CHUNKS if chunk["document_id"] == document_id]
    return {"data": [_chunk_payload(chunk) for chunk in chunks]}


@router.get("/related")
async def get_related_knowledge(object_type: str | None = None, object_id: str | None = None, limit: int = 4):
    matched_documents = [
        document
        for document in KNOWLEDGE_DOCUMENTS
        if _matches_object(document, object_type, object_id)
    ]
    related = []
    for document in matched_documents:
        chunks = [chunk for chunk in KNOWLEDGE_CHUNKS if chunk["document_id"] == document["id"]]
        first_chunk = chunks[0] if chunks else None
        source = _source_by_id(document["source_id"])
        related.append({
            **document,
            "source_name": source["name"],
            "source_type": source["type"],
            "source_ref": first_chunk["source_ref"] if first_chunk else document["title"],
            "chunk_text": first_chunk["chunk_text"] if first_chunk else document["summary"],
            "score": 0.88 if object_type or object_id else 0.72,
        })
    return {"data": related[: max(1, min(limit, 10))]}


@router.post("/search")
async def search_knowledge(body: KnowledgeSearchBody):
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    vectorizer, matrix = _retriever()
    query_vector = vectorizer.transform([query])
    scores = cosine_similarity(query_vector, matrix).flatten()
    ranked = sorted(enumerate(scores), key=lambda item: item[1], reverse=True)

    results = []
    for index, score in ranked:
        if score <= 0:
            continue
        chunk = KNOWLEDGE_CHUNKS[index]
        document = _document_by_id(chunk["document_id"])
        if not _matches_object(document, body.object_type, body.object_id):
            continue
        results.append(_chunk_payload(chunk, float(score)))
        if len(results) >= max(1, min(body.limit, 10)):
            break

    return {
        "data": {
            "query": query,
            "answer": "已根据本地知识库检索到相关 SOP、历史 CAPA 或供应商证据，MVP 阶段返回候选引用，由业务用户确认后再进入流程。",
            "results": results,
        }
    }
