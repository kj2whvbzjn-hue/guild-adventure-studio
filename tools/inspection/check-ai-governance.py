#!/usr/bin/env python3
"""Validate AI governance from machine-readable definitions, not Markdown startup inventories."""
from pathlib import Path
import json
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]).resolve()
errors: list[str] = []
CANONICAL = "shared/integrity/ai-operating-policy.json"
SEMANTIC_ENTRYPOINT = "AI_START.md"


def text(rel: str) -> str:
    path = root / rel
    if not path.is_file():
        errors.append("MISSING " + rel)
        return ""
    try:
        value = path.read_text(encoding="utf-8")
    except Exception as exc:
        errors.append(f"TEXT_INVALID {rel} {exc}")
        return ""
    if not value.strip():
        errors.append("EMPTY " + rel)
    return value


def json_file(rel: str) -> dict:
    raw = text(rel)
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except Exception as exc:
        errors.append(f"JSON_INVALID {rel} {exc}")
        return {}
    if not isinstance(value, dict):
        errors.append("JSON_ROOT_NOT_OBJECT " + rel)
        return {}
    return value


manifest = json_file("ai-gateway-manifest.json")
policy = json_file(CANONICAL)
start = text(SEMANTIC_ENTRYPOINT)
rules = text("AI_WORK_RULES.md")
artifact_doc = text("docs/operations/ARTIFACT_SUBMISSION_POLICY.md")
compat = json_file("shared/integrity/artifact-submission-policy.json")
index = json_file("AI_PROJECT_INDEX.json")
status = json_file("AI_PROJECT_STATUS.json")
gateway = text("ai-gateway.js")
exporter = text("modules/verification/ai-export.js")

# Single authority.
authority = policy.get("authority", {})
if authority.get("normative") is not True:
    errors.append("CANONICAL_POLICY_NOT_NORMATIVE")
if authority.get("canonical_source") != CANONICAL:
    errors.append("CANONICAL_POLICY_PATH_MISMATCH")
if authority.get("human_markdown_role") != "informative_only":
    errors.append("MARKDOWN_AUTHORITY_NOT_INFORMATIVE")
if authority.get("javascript_role") != "validation_and_execution_only":
    errors.append("JAVASCRIPT_ROLE_INVALID")
if authority.get("fail_closed_when_unavailable") is not True:
    errors.append("CANONICAL_POLICY_NOT_FAIL_CLOSED")

# Explicitly separate AI semantic entrypoint from Gateway machine preload.
startup = policy.get("startup", {})
if startup.get("ai_semantic_entrypoint") != SEMANTIC_ENTRYPOINT:
    errors.append("POLICY_SEMANTIC_ENTRYPOINT_INVALID")
expected_preload = startup.get("gateway_machine_preload_files")
if expected_preload != ["package-build.json", CANONICAL]:
    errors.append("POLICY_MACHINE_PRELOAD_INVALID")
if manifest.get("aiSemanticEntrypoint") != startup.get("ai_semantic_entrypoint"):
    errors.append("MANIFEST_SEMANTIC_ENTRYPOINT_DRIFT")
if manifest.get("operatingPolicyFile") != CANONICAL:
    errors.append("MANIFEST_OPERATING_POLICY_DRIFT")
if manifest.get("gatewayMachinePreloadFiles") != expected_preload:
    errors.append("MANIFEST_MACHINE_PRELOAD_DRIFT")
if "startupGovernanceFiles" in manifest:
    errors.append("LEGACY_STARTUP_GOVERNANCE_FIELD_PRESENT")
if "requiredGovernanceFiles" in manifest:
    errors.append("LEGACY_REQUIRED_GOVERNANCE_FIELD_PRESENT")

expected_advisory = startup.get("advisory_metadata_files", [])
if manifest.get("advisoryMetadataFiles") != expected_advisory:
    errors.append("MANIFEST_ADVISORY_METADATA_DRIFT")
conditionals = policy.get("conditional_documents", [])
expected_conditionals = [x.get("path") for x in conditionals if isinstance(x, dict) and x.get("path")]
expected_machine_policies = list(dict.fromkeys(x.get("machine_policy") for x in conditionals if isinstance(x, dict) and x.get("machine_policy")))
if manifest.get("conditionalGovernanceFiles") != expected_conditionals:
    errors.append("MANIFEST_CONDITIONAL_GOVERNANCE_DRIFT")
if manifest.get("conditionalMachinePolicyFiles") != expected_machine_policies:
    errors.append("MANIFEST_CONDITIONAL_MACHINE_POLICY_DRIFT")

allowed = manifest.get("allowedFiles", [])
handover = manifest.get("handoverFiles", [])
for rel in [SEMANTIC_ENTRYPOINT, *expected_preload, *expected_advisory, *expected_conditionals, *expected_machine_policies]:
    if rel not in allowed:
        errors.append("NOT_ALLOWLISTED " + rel)
    if not (root / rel).is_file():
        errors.append("GOVERNANCE_FILE_MISSING " + rel)
for rel in [SEMANTIC_ENTRYPOINT, *expected_preload, *expected_conditionals, *expected_machine_policies]:
    if rel not in handover:
        errors.append("NOT_IN_HANDOVER " + rel)
for item in conditionals:
    if not isinstance(item, dict):
        errors.append("CONDITIONAL_DOCUMENT_INVALID")
        continue
    machine_policy = item.get("machine_policy")
    if machine_policy:
        if not (root / machine_policy).is_file():
            errors.append("CONDITIONAL_MACHINE_POLICY_MISSING " + machine_policy)
        if machine_policy not in allowed:
            errors.append("CONDITIONAL_MACHINE_POLICY_NOT_ALLOWLISTED " + machine_policy)

# Markdown is explanation only; it must point to canonical authority and not claim dual authority.
for rel, body in [(SEMANTIC_ENTRYPOINT, start), ("AI_WORK_RULES.md", rules), ("docs/operations/ARTIFACT_SUBMISSION_POLICY.md", artifact_doc)]:
    if CANONICAL not in body:
        errors.append("CANONICAL_POLICY_REFERENCE_MISSING " + rel)
if "規範的な運用ルールの正本ではない" not in start or "唯一の規範的正本" not in start:
    errors.append("START_AUTHORITY_SEMANTICS_MISSING")
if "Legacy machine inventory" in start:
    errors.append("START_LEGACY_INVENTORY_PRESENT")
if "Informative only" not in rules:
    errors.append("WORK_RULES_INFORMATIVE_MARKER_MISSING")
if "Informative only" not in artifact_doc:
    errors.append("ARTIFACT_DOC_INFORMATIVE_MARKER_MISSING")

# Compatibility JSON may exist, but must not define rules.
if compat.get("normative") is not False or compat.get("canonical_source") != CANONICAL:
    errors.append("ARTIFACT_COMPAT_AUTHORITY_INVALID")
for forbidden in ["work_types", "ai_requirements", "default"]:
    if forbidden in compat:
        errors.append("ARTIFACT_COMPAT_DUPLICATES_RULES " + forbidden)

# Advisory metadata must not become a second policy source.
for rel, obj in [("AI_PROJECT_INDEX.json", index), ("AI_PROJECT_STATUS.json", status)]:
    if obj.get("authority") != "informative_only":
        errors.append("ADVISORY_AUTHORITY_INVALID " + rel)
    if obj.get("canonical_operating_policy") != CANONICAL:
        errors.append("ADVISORY_CANONICAL_POINTER_INVALID " + rel)
for forbidden in ["work_types", "working_rules", "conditional_policies", "tests_may_be_relaxed_for_startup_optimization"]:
    if forbidden in index:
        errors.append("INDEX_DUPLICATES_POLICY " + forbidden)
    if forbidden in status:
        errors.append("STATUS_DUPLICATES_POLICY " + forbidden)

# Canonical safety and routing invariants. These are intentionally strict; startup cleanup must not relax gates.
work_modes = policy.get("work_modes", {})
if work_modes.get("READ_ONLY", {}).get("work_type_required") is not False:
    errors.append("READ_ONLY_WORK_TYPE_POLICY_INVALID")
if work_modes.get("EDIT", {}).get("scope_declaration_required") is not True:
    errors.append("EDIT_SCOPE_DECLARATION_MISSING")
work_types = policy.get("work_types", {})
if work_types.get("SOURCE_UPDATE", {}).get("artifact", {}).get("kind") != "direct_studio_update_zip":
    errors.append("SOURCE_UPDATE_ROUTE_INVALID")
if "Export/**" not in work_types.get("SOURCE_UPDATE", {}).get("artifact", {}).get("forbids", []):
    errors.append("SOURCE_UPDATE_EXPORT_BOUNDARY_MISSING")
if work_types.get("GAME_DATA_UPDATE", {}).get("artifact", {}).get("kind") != "studio_project_json":
    errors.append("GAME_DATA_ROUTE_INVALID")
if work_types.get("HYBRID", {}).get("must_be_separate") is not True:
    errors.append("HYBRID_SEPARATION_INVALID")
if policy.get("deletion", {}).get("default") != "prohibited":
    errors.append("DELETION_DEFAULT_INVALID")
if policy.get("deletion", {}).get("general_instruction_counts_as_approval") is not False:
    errors.append("DELETION_APPROVAL_POLICY_INVALID")
test_gate = policy.get("test_and_gate_integrity", {})
if test_gate.get("relaxation_for_startup_optimization") is not False:
    errors.append("TEST_GATE_RELAXATION_ENABLED")
if test_gate.get("required_failure_result") != "FAIL":
    errors.append("REQUIRED_FAILURE_NOT_FAIL")
if test_gate.get("timeout_result") != "FAIL" or test_gate.get("timeout_failure_kind") != "timeout":
    errors.append("TIMEOUT_POLICY_RELAXED")
if test_gate.get("protected_change_requires_external_human_approval") is not True:
    errors.append("PROTECTED_CHANGE_APPROVAL_RELAXED")
if policy.get("artifact_submission", {}).get("fail_closed_when_policy_unavailable") is not True:
    errors.append("ARTIFACT_POLICY_NOT_FAIL_CLOSED")
for key in ["undeclared_changes_forbidden", "required_checks_must_pass", "deletions_exclusions_and_unresolved_items_must_be_reported"]:
    if policy.get("completion", {}).get(key) is not True:
        errors.append("COMPLETION_POLICY_INVALID " + key)

# Gateway must consume policy values rather than re-declare them.
for token in ["loadGovernance", "aiSemanticEntrypoint", "gatewayMachinePreloadFiles", "operatingPolicyFile", "policy.artifact_submission", "policy.work_types", "policy.test_and_gate_integrity", "governance:await loadGovernance()"]:
    if token not in gateway:
        errors.append("GATEWAY_WIRING_MISSING " + token)
for forbidden in ["LEGACY_", "startupGovernanceFiles", "requiredGovernanceFiles", "artifactRouting:'by_work_type'", "sourceUpdateArtifact:'direct_studio_update_zip'", "gameDataArtifact:'studio_project_json'", "hybridArtifactsMustBeSeparate:true", "deletionDefault:'prohibited'"]:
    if forbidden in gateway:
        errors.append("GATEWAY_HARDCODE_OR_LEGACY_PRESENT " + forbidden)

# Studio AI export consumes the same manifest; no legacy fixed 8-file startup list.
for token in ["loadGovernanceExportFiles", "manifest.aiSemanticEntrypoint", "manifest.gatewayMachinePreloadFiles", "manifest.conditionalGovernanceFiles", "manifest.conditionalMachinePolicyFiles", CANONICAL]:
    if token not in exporter:
        errors.append("AI_EXPORT_WIRING_MISSING " + token)
if "LEGACY_" in exporter:
    errors.append("AI_EXPORT_LEGACY_DEFINITION_PRESENT")
for old in ["governance/AI_PROJECT_INDEX.json", "governance/AI_PROJECT_STATUS.json", "governance/package_manifest.json"]:
    if old in exporter:
        errors.append("AI_EXPORT_LEGACY_STARTUP_REFERENCE_PRESENT " + old)

if errors:
    print("AI_GOVERNANCE_FAIL")
    print("\n".join(errors))
    raise SystemExit(1)
print(
    "AI_GOVERNANCE_OK "
    f"semantic_entrypoint={manifest.get('aiSemanticEntrypoint')} "
    f"machine_preload={len(expected_preload)} conditional={len(expected_conditionals)} "
    "canonical_policy=single_source gateway=policy_driven exporter=manifest_driven "
    "test_gate_strength=unchanged fail_closed=true"
)
