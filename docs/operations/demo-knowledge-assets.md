# Demo Knowledge Assets

Last updated: 2026-05-27

This document tracks local scripts that create or seed knowledge-base demo
materials. These scripts support demos, ingestion testing, object binding, and
knowledge graph publishing checks. They are not production connectors.

## Script Inventory

| Script | Purpose | Writes to |
| --- | --- | --- |
| `scripts/seed_demo_knowledge.py` | Seeds bundled Word/Excel/PDF-style demo knowledge assets into the local demo database. | Local backend database and knowledge asset storage paths. |
| `scripts/generate_purchase_pdf.py` | Generates a standalone procurement and supplier-risk PDF for manual upload into the Knowledge Center. | Current Windows user's Desktop. |

## Bundled Seed Assets

The repository includes demo source files under `data/knowledge_assets/`.
`scripts/seed_demo_knowledge.py` and the backend startup seed path use these
assets to populate the local knowledge demo.

Current bundled assets:

| File | Scenario |
| --- | --- |
| `SOP-QA-014-solder-void-recheck.docx` | Solder-void recheck SOP and quality handling guidance. |
| `CAPA-072-solder-void-closure-report.docx` | CAPA closure and effectiveness verification. |
| `supplier-8d-MB-7781-risk-ledger.xlsx` | Supplier 8D, batch risk, and SQE follow-up evidence. |
| `SMT-BGA-process-control-plan.xlsx` | SMT/BGA process control plan and inspection controls. |
| `SMT-03-zone5-temperature-review.pdf` | Reflow oven zone-5 temperature review evidence. |
| `SO-8821-customer-risk-communication-standard.pdf` | Customer delivery-risk communication standard. |

These files are intended to stay small and deterministic so the local demo
database can be rebuilt repeatedly.

## Procurement Supplier-Risk PDF

`scripts/generate_purchase_pdf.py` creates a three-page PDF:

```text
PUR-SQE-2026-0527_procurement_supplier_risk_review.pdf
```

Default output path:

```text
%USERPROFILE%\Desktop\PUR-SQE-2026-0527_procurement_supplier_risk_review.pdf
```

Run it from the repository root:

```powershell
python scripts\generate_purchase_pdf.py
```

The script uses Pillow (`PIL`) and Windows fonts. `Pillow==12.2.0` is already in
`backend/requirements.txt`; install backend dependencies first if the import is
missing.

## What The PDF Is For

The generated PDF is designed as an extra manual upload sample for the current
Knowledge Center workflow:

```text
generate PDF
  -> upload in Knowledge Center
  -> convert/extract text
  -> review evidence
  -> confirm object bindings
  -> optionally publish relationships to graph
```

The document content covers:

- procurement order and incoming-material batch ledger;
- supplier delivery and evidence-completeness performance;
- SQE and purchasing follow-up actions;
- affected work orders and customer order;
- suggested ontology/object bindings;
- graph-publishable relationship evidence.

Suggested object bindings in the sample:

| Object type | Example code | Meaning |
| --- | --- | --- |
| `Supplier` | `SUP-BEICHEN` | Beichen electronic material supplier. |
| `MaterialBatch` | `MB-7781` | Solder paste S12 batch with cold-chain evidence gap. |
| `PurchaseOrder` | `PO-260519-014` | Procurement order containing the risky batch. |
| `WorkOrder` | `WO-260521-017` | Potentially affected manufacturing work order. |
| `CustomerOrder` | `SO-8821` | Potentially affected customer order. |
| `QualityEvent` | `QE-20260521-001` | AOI soldering quality event. |

Suggested graph relationships in the sample:

| Source | Relationship | Target |
| --- | --- | --- |
| Supplier | `SUPPLIES` | Material batch |
| Purchase order | `CONTAINS_BATCH` | Material batch |
| Material batch | `MAY_CAUSE` | BGA soldering defect |
| Material batch | `AFFECTS` | Work order |
| Work order | `AFFECTS_ORDER` | Customer order |

## Boundaries

- This script does not write to PostgreSQL, SQLite, Neo4j, or backend APIs.
- The generated PDF is a local runtime artifact; do not commit the generated
  file.
- The sample is demo data for knowledge ingestion and graph-binding tests, not a
  real supplier quality record.
- If this script is later used in CI or on Linux, replace the Desktop output and
  Windows font assumptions with explicit command-line options.
