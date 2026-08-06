#!/usr/bin/env python3
"""Aggregate deterministic Full shards without accepting mixed inputs."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
PLAN_PATH = ROOT / "shared/integrity/full-inspection-shards.json"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reports-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    expected_shards = set(plan["shards"])
    found = {}
    errors = []

    for path in sorted(args.reports_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"INVALID_REPORT {path.name} {exc}")
            continue
        if data.get("report_type") != "full_shard":
            continue
        shard = data.get("shard")
        if shard in found:
            errors.append(f"DUPLICATE_SHARD {shard}")
        found[shard] = (path, data)

    missing = sorted(expected_shards - set(found))
    extra = sorted(set(found) - expected_shards)
    if missing:
        errors.append("MISSING_SHARDS " + ",".join(missing))
    if extra:
        errors.append("UNKNOWN_SHARDS " + ",".join(extra))

    zip_hashes = {d.get("input_zip_sha256") for _, d in found.values()}
    tree_before = {d.get("source_tree_before_sha256") for _, d in found.values()}
    tree_after = {d.get("source_tree_after_sha256") for _, d in found.values()}
    contexts = {d.get("context") for _, d in found.values()}
    if len(zip_hashes) > 1:
        errors.append("MIXED_INPUT_ZIP_SHA256")
    if len(tree_before) > 1 or len(tree_after) > 1 or tree_before != tree_after:
        errors.append("MIXED_OR_CHANGED_SOURCE_TREE")
    if len(contexts) > 1:
        errors.append("MIXED_CONTEXT")

    executed = set()
    shard_records = []
    for shard in sorted(found):
        path, data = found[shard]
        expected_steps = set(plan["shards"][shard])
        if data.get("context") == "source":
            expected_steps.discard("delete_manifest")
        actual_steps = set(data.get("executed_steps", []))
        if actual_steps != expected_steps:
            errors.append(
                f"STEP_COVERAGE_MISMATCH {shard} "
                f"expected={sorted(expected_steps)} actual={sorted(actual_steps)}"
            )
        overlap = executed & actual_steps
        if overlap:
            errors.append(f"DUPLICATE_STEPS {shard} {sorted(overlap)}")
        executed |= actual_steps
        if data.get("status") != "pass":
            errors.append(f"SHARD_NOT_PASS {shard}")
        if not data.get("source_tree_unchanged"):
            errors.append(f"SHARD_CHANGED_SOURCE {shard}")
        shard_records.append({
            "shard": shard,
            "report_path": str(path.resolve()),
            "report_sha256": sha256_file(path),
            "status": data.get("status"),
            "evidence_set_sha256": data.get("evidence_set_sha256"),
            "executed_steps": sorted(actual_steps),
        })

    status = "FULL_PASS" if not errors else (
        "FULL_INCOMPLETE" if any(x.startswith(("MISSING_SHARDS", "INVALID_REPORT")) for x in errors)
        else "FULL_FAIL"
    )
    result = {
        "schema_version": 1,
        "report_type": "full_aggregate",
        "status": status,
        "input_zip_sha256": next(iter(zip_hashes)) if len(zip_hashes) == 1 else None,
        "source_tree_sha256": next(iter(tree_before)) if len(tree_before) == 1 and tree_before == tree_after else None,
        "context": next(iter(contexts)) if len(contexts) == 1 else None,
        "expected_shards": sorted(expected_shards),
        "received_shards": sorted(found),
        "executed_steps": sorted(executed),
        "shards": shard_records,
        "errors": errors,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{status} shards={len(found)}/{len(expected_shards)} steps={len(executed)} errors={len(errors)}")
    if errors:
        print("\n".join(errors))
    return 0 if status == "FULL_PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
