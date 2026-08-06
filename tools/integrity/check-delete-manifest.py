#!/usr/bin/env python3
"""Validate the exceptional deletion request for a Studio update ZIP.

Normal updates contain an empty DELETE_MANIFEST.txt (comments are allowed).
Any real deletion requires a matching human approval file and must satisfy the
repository deletion policy.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path, PurePosixPath
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]).resolve()
manifest_path = root / "DELETE_MANIFEST.txt"
policy_path = root / "shared/integrity/delete-policy.json"

errors: list[str] = []


def load_json(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"{label}_MISSING path={path.relative_to(root)}")
        return {}
    except Exception as exc:
        errors.append(f"{label}_INVALID error={exc}")
        return {}
    if not isinstance(value, dict):
        errors.append(f"{label}_NOT_OBJECT")
        return {}
    return value


policy = load_json(policy_path, "DELETE_POLICY")
if not manifest_path.is_file():
    errors.append("DELETE_MANIFEST_MISSING")
    manifest_lines: list[str] = []
else:
    manifest_lines = manifest_path.read_text(encoding="utf-8-sig").splitlines()

entries: list[str] = []
seen: set[str] = set()
for lineno, raw in enumerate(manifest_lines, 1):
    rel = raw.strip()
    if not rel or rel.startswith("#"):
        continue
    posix = PurePosixPath(rel)
    if rel in seen:
        errors.append(f"DUPLICATE line={lineno} path={rel}")
    seen.add(rel)
    if posix.is_absolute() or ".." in posix.parts or rel.endswith("/") or "\\" in rel:
        errors.append(f"UNSAFE_PATH line={lineno} path={rel}")
    if rel in {"DELETE_MANIFEST.txt", policy.get("approval_file", "DELETE_APPROVAL.json")}:
        errors.append(f"CONTROL_FILE_DELETE line={lineno} path={rel}")
    entries.append(rel)

max_entries = policy.get("max_entries_per_update", 20)
if not isinstance(max_entries, int) or max_entries < 0:
    errors.append("DELETE_POLICY_INVALID_MAX_ENTRIES")
elif len(entries) > max_entries:
    errors.append(f"TOO_MANY_ENTRIES count={len(entries)} max={max_entries}")

protected_exact = set(policy.get("protected_exact_paths", []))
protected_prefixes = tuple(policy.get("protected_prefixes", []))
for rel in entries:
    if rel in protected_exact or any(rel.startswith(prefix) for prefix in protected_prefixes):
        errors.append(f"PROTECTED_PATH path={rel}")

approval_name = policy.get("approval_file", "DELETE_APPROVAL.json")
approval_path = root / approval_name
if entries:
    approval = load_json(approval_path, "DELETE_APPROVAL")
    if approval:
        if approval.get("schema_version") != 1:
            errors.append("DELETE_APPROVAL_SCHEMA_VERSION")
        if approval.get("approval_scope") != "single_update":
            errors.append("DELETE_APPROVAL_SCOPE")
        if approval.get("approval_actor_type") != "human":
            errors.append("DELETE_APPROVAL_ACTOR_NOT_HUMAN")
        approved_by = approval.get("approved_by")
        if not isinstance(approved_by, str) or not approved_by.strip():
            errors.append("DELETE_APPROVAL_APPROVER_MISSING")
        approved_at = approval.get("approved_at")
        try:
            if not isinstance(approved_at, str):
                raise ValueError
            datetime.fromisoformat(approved_at.replace("Z", "+00:00"))
        except Exception:
            errors.append("DELETE_APPROVAL_TIME_INVALID")
        if approval.get("general_instruction_used_as_approval") is not False:
            errors.append("GENERAL_INSTRUCTION_NOT_ALLOWED")
        if approval.get("deletion_controls_changed") is not False:
            errors.append("DELETION_CONTROL_CHANGE_WITH_DELETE_FORBIDDEN")

        approved_entries = approval.get("entries")
        if not isinstance(approved_entries, list):
            errors.append("DELETE_APPROVAL_ENTRIES_INVALID")
            approved_entries = []
        approved_paths: list[str] = []
        allowed_categories = set(policy.get("allowed_categories", []))
        required_text_fields = ("reason", "non_delete_alternative", "impact", "recovery")
        for index, item in enumerate(approved_entries):
            if not isinstance(item, dict):
                errors.append(f"DELETE_APPROVAL_ENTRY_NOT_OBJECT index={index}")
                continue
            path_value = item.get("path")
            if not isinstance(path_value, str) or not path_value:
                errors.append(f"DELETE_APPROVAL_PATH_MISSING index={index}")
                continue
            approved_paths.append(path_value)
            if item.get("category") not in allowed_categories:
                errors.append(f"DELETE_APPROVAL_CATEGORY_INVALID path={path_value}")
            for field in required_text_fields:
                value = item.get(field)
                if not isinstance(value, str) or not value.strip():
                    errors.append(f"DELETE_APPROVAL_FIELD_MISSING path={path_value} field={field}")
        if approved_paths != entries:
            errors.append(
                "DELETE_APPROVAL_PATH_MISMATCH "
                f"manifest={entries!r} approval={approved_paths!r}"
            )
else:
    # An approval file must not silently survive into an ordinary update.
    if approval_path.is_file():
        errors.append("STALE_DELETE_APPROVAL_WITH_EMPTY_MANIFEST")

if errors:
    print("DELETE_MANIFEST_FAIL")
    print("\n".join(errors))
    raise SystemExit(1)

mode = "normal_update_no_delete" if not entries else "exceptional_delete_approved"
print(f"DELETE_MANIFEST_OK entries={len(entries)} mode={mode}")
