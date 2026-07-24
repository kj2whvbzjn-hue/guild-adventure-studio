# Formal Release Notes — Build 328

## Release identity

- Product: GK Studio v1.23.0-dev
- Build: 328
- Status: Formal release baseline
- Decision: DEC-SGF-0003

## Main change

SGF is redefined from Scenario Generation Framework to Scenario Support Framework. Built-in automatic scenario generation is frozen, while implemented support components are retained and reused.

## Active features

- Story Importer and Structure Analyzer
- Chapter/Section design forms
- Prompt Builder and copy-ready instructions
- Manual or external-AI result paste/import
- Story Preview and current/candidate comparison
- Consistency and dependency validation
- Candidate Revision history
- Explicit approval and Export

## Frozen features

- Built-in AI generation
- External AI API connector
- Automatic regeneration
- Automatic quality scoring
- Automatic adoption or merge

## Management synchronization

- Added DEC-SGF-0003.
- Reclassified DEC-SGF-0001/0002 for support-framework reuse without deleting history.
- Synchronized decision_tracker.json and decision_tracker.csv.
- Updated VERSION.txt, studio-update.json, manifest.webmanifest, and sw.js to Build 328.
- Updated SGF phase and CPF/SGF boundary specifications.
- Added formal decision application and Build 328 audit documents.

## CPF-002A implementation increment

CPF-002A Import Safety Hardening is now locally implemented. Added input schema and pre-write validation, project import locking, stale-lock recovery, transaction backup/rollback, child-node archive synchronization, protected-child conflict handling, dependency rebuild, revisioned hash snapshots, and identical-input idempotency.

The active implementation status is:

- Story Importer / Structure Analyzer: implemented.
- CPF-002A Import Safety Hardening: locally implemented; remote PHP 8.1–8.4 CI unconfirmed.
- Chapter/Section Design Form and Prompt Builder: next development phase; not yet claimed as completed UI.
- Built-in automatic Plot/Chapter generation: frozen by DEC-SGF-0003.

Build 328 management corrections in this increment:

- Corrected `CPF_FORMAL_RELEASE_MANIFEST.json` from Build 327 to Build 328.
- Corrected previous-build and audit-document references.
- Removed obsolete automatic-generation responsibility from `CPF_PHASE_PLAN.md`.
- Added manifest/build and frozen-function checks to `tools/audit_project.py`.


## SSF-001 / SSF-002 incremental implementation

- Added Chapter/Section scenario design form.
- Added copy-ready prompt assembly with source snapshot metadata.
- Added legacy-data normalization for design records.
- Advanced the next target to SSF-003 Paste Intake through CPF-002A.


## SSF-003 incremental implementation

- Added pasted-result intake for Chapter and Section targets.
- Added pre-save validation for empty, oversized, script-bearing, and NUL-bearing input.
- Added candidate Revision storage with target snapshot, design version, source update time, author, note, timestamp, and deterministic content hash.
- Added identical-input idempotency.
- Confirmed that pasted prose never overwrites current scenario text and never triggers automatic approval or merge.
- Advanced the next target to SSF-004 Story Preview and current/candidate comparison.


## SSF-004 incremental implementation

- Added read-only current/candidate preview for Chapter and Section targets.
- Added side-by-side full-text comparison and deterministic line-oriented diff.
- Added source Design-version and source-update staleness warnings.
- Added advisory consistency checks for required events, prohibited conditions, target length, empty/oversized content, script elements, and NUL characters.
- Approval, merge, promotion, and Export remain prohibited in this phase.
- Advanced the next development target to SSF-005 protected-field and allowed-change controls.


## SSF-005 incremental implementation

- Added explicit candidate rejection with mandatory reason.
- Added whole-candidate explicit approval with confirmation checkbox and mandatory approval comment.
- Promotion changes only the target `summary`; identifiers, ordering, title, design data, child nodes, workflow status, and other protected fields are verified unchanged.
- Added prior-approved Revision supersession, canonical before/after hashes, and approval audit fields.
- Added separate Export-readiness linkage requiring an approved Revision and matching canonical hash.
- Export readiness does not automatically execute Export.
- Partial adoption, automatic merge, automatic approval, and automatic Export remain prohibited.
- Corrected the SSF-004 NUL-character validation expression and added a regression contract check.
- Advanced the next target to the Build 329 integration gate.


## Build 329 integration gate — Increment 1

- Added approved-scenario Export acceptance validation.
- Blocks Export for workflow-managed Chapter/Section nodes that are not explicitly Export-ready.
- Requires the approved Revision text and canonical SHA-256 to match the current summary.
- Excludes Studio-only `candidate_revisions`, `design`, and `export_control` metadata from Runtime Export JSON.
- Added automated positive and negative contract tests.
- Remote PHP matrix CI and physical-device browser validation remain unconfirmed.

## Build 329 integration gate — Controlled 10-chapter import

- Added the authoritative Guild Adventure Story ten-chapter controlled-import fixture.
- Preserved stable Chapter IDs CH001–CH010, confirmed bosses, joins, miasma awakening, queen timing, and final capital-retaking constraints.
- Added an automated real-data import test covering first import, normalization, structure analysis, idempotent re-import, revision snapshot, and SHA-256.
- Corrected README version and removed obsolete automatic-generation language.
- Advanced the next local target to impact/dependency review against the controlled real scenario data.


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
