# Release Notes v1.23.0-dev — CPF/SGF Management Audit

## CPF-001 Story Pipeline Core

- Added isolated candidate Revision storage.
- Added approve-to-promote flow from candidate Revision to current Node.
- Added stale candidate conflict detection with exit code 4.
- Preserved manual fields during candidate generation and promotion.
- Expanded Workflow Graph validation for cycles, undefined types, unreachable steps, required steps, approval gates, and count constraints.
- Added Generator Registry register, unregister, resolve, list, and compatibility validation.
- Added schema Migration framework and version 1 to version 2 migration.
- Added individual CPF CLI wrapper commands and expanded the unified CLI.
- Added CPF tests to the PHP 8.1–8.4 GitHub Actions matrix.
- Retained the E2E isolation correction so Runtime tests always use the canonical fixture.

## Verification

- CPF automated tests: PASS, 16 checks.
- PHP Runtime and GVF-001–005 tests: PASS.
- Packaged Export validation: PASS.
- Studio core to Export to PHP Runtime E2E: PASS.
- PHP syntax check: PASS on installed PHP 8.4.
- PHP 8.1–8.4 matrix: workflow configured; remote CI execution remains required.

## CPF-002 Formal Planning Update

- Formally adopted Story Preview Rebuild under DEC-CPF-0002.
- Added existing-story import followed by non-destructive plot regeneration.
- Added current/candidate comparison, rationale, impact, warning, and evaluation requirements.
- Added whole, chapter, and field-level adoption requirements.
- Added protection requirements for LOCKED nodes, manual fields, and story milestones.
- Updated CPF phase, execution, implementation, acceptance, and decision documents.

## CPF-002 Implementation Increment 1 / Build 325
- Added Story Importer and normalized JSON input format.
- Added Story Structure Analyzer and preview rebuild readiness diagnostics.
- Added protected draft replacement and manual-field preservation.
- Added story import/analyze CLI commands and sample input.
- Expanded CPF automated tests from 16 to 20.

## CPF-002 Execution Plan Revision / Build 326
- Formally adopted DEC-CPF-0003 Import Safety Hardening.
- Inserted CPF-002A as a mandatory gate before Plot/Chapter Generator.
- Added transaction, rollback, project lock, child synchronization, archive handling, milestone source-of-truth, snapshot versioning, ID separation, and idempotency requirements.
- Added acceptance criteria and abnormal/boundary/concurrency test requirements.
- Updated current phase and next action to CPF-002A.

## CPF/SGF Management Audit / Build 327
- Resolved the DEC-CPF-0002 collision by assigning CPF v1.0 freeze to DEC-CPF-V1-0001.
- Synchronized decision_tracker.json and decision_tracker.csv, including DEC-0011 and DEC-0020.
- Normalized all decision records into the JSON data array.
- Established SGF as the independent automatic scenario generation framework under DEC-SGF-0001/0002.
- Retained CPF-002A as the mandatory CPF/SGF integration and import-safety gate.
- Added CPF/SGF responsibility boundary and SGF phase plan.
- Added tools/audit_project.py for repeatable decision/build/PWA/JSON consistency auditing.
- Updated PWA cache and entry versions to Build 327.

## Scenario Support Framework / Formal Build 328
- Formally adopted DEC-SGF-0003.
- Froze built-in automatic scenario generation, API integration, automatic regeneration, automatic scoring, and automatic approval.
- Redefined SGF as Scenario Support Framework.
- Retained Prompt Builder, design forms, pasted-result intake, Story Preview, consistency validation, candidate Revision, approval, and Export.
- Established copy-and-paste operation with external AI or human writers as the standard workflow.
- Updated Decision Tracker, boundary/phase specifications, release metadata, PWA cache, and audit baseline to Build 328.


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
