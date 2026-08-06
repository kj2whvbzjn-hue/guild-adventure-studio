#!/usr/bin/env python3
"""Run one deterministic Full inspection shard with read-only evidence."""
from __future__ import annotations
import sys
sys.dont_write_bytecode = True

import argparse
import json
import os
from pathlib import Path
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import run as unified
from evidence import (
    compare_trees, execution_environment, tree_snapshot, utc_now,
    write_evidence_manifest, write_json, zip_entries,
)

PLAN_PATH = ROOT / "shared/integrity/full-inspection-shards.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("shard")
    parser.add_argument("--context", choices=("source", "update"), required=True)
    parser.add_argument("--input-zip", type=Path, required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--timeout", type=int, default=120)
    args = parser.parse_args()

    try:
        evidence_dir = unified.assert_outside_root(args.evidence_dir, "--evidence-dir")
        report_path = unified.assert_outside_root(args.report, "--report") if args.report else None
    except ValueError as exc:
        parser.error(str(exc))
    if not args.input_zip.is_file():
        parser.error(f"--input-zip not found: {args.input_zip}")

    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    if args.shard not in plan["shards"]:
        parser.error(f"unknown shard: {args.shard}")
    selected_names = set(plan["shards"][args.shard])

    all_steps = unified.build_steps("full", None, args.context)
    if args.context == "source":
        all_steps.insert(0, (
            "source_zip_binding",
            [sys.executable, str(ROOT / "tools/inspection/check-source-zip-binding.py"),
             str(ROOT), "--input-zip", str(args.input_zip.resolve()),
             "--json-output", str(evidence_dir / "source-zip-binding.json")],
            True,
        ))
    available = {name for name, _, _ in all_steps}
    # delete_manifest exists only in update context.
    effective_selected = selected_names & available
    unknown = selected_names - available
    if unknown - {"delete_manifest"}:
        parser.error(f"shard contains unavailable steps: {sorted(unknown)}")
    selected_steps = [step for step in all_steps if step[0] in effective_selected]

    env = unified.readonly_env()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    before = tree_snapshot(ROOT)
    zip_info = zip_entries(args.input_zip)
    write_json(evidence_dir / "tree-before.json", before)
    write_json(evidence_dir / "zip-entries.json", zip_info)
    write_json(evidence_dir / "execution.json",
               execution_environment([sys.executable, *sys.argv], ROOT, env))
    write_json(evidence_dir / "input.json", {
        "schema_version": 1,
        "input_zip": str(args.input_zip.resolve()),
        "input_zip_sha256": zip_info["zip_sha256"],
        "shard": args.shard,
        "context": args.context,
        "started_at": utc_now(),
    })

    started = time.time()
    results = []
    for name, command, required in selected_steps:
        results.append(unified.run_step(
            name, command, required=required,
            timeout_seconds=args.timeout, env=env
        ))

    after = tree_snapshot(ROOT)
    delta = compare_trees(before, after)
    write_json(evidence_dir / "tree-after.json", after)
    write_json(evidence_dir / "tree-delta.json", delta)
    results.append({
        "name": "source_tree_immutability",
        "command": [],
        "required": True,
        "status": "pass" if delta["unchanged"] else "fail",
        "returncode": 0 if delta["unchanged"] else 1,
        "timed_out": False,
        "timeout_seconds": args.timeout,
        "duration_ms": 0,
        "stdout": "SOURCE_TREE_UNCHANGED" if delta["unchanged"] else json.dumps(delta, ensure_ascii=False),
        "stderr": "" if delta["unchanged"] else "Inspection modified the source tree.",
    })

    failed = [r for r in results if r["status"] == "fail"]
    report = {
        "schema_version": 1,
        "report_type": "full_shard",
        "shard": args.shard,
        "context": args.context,
        "status": "fail" if failed else "pass",
        "input_zip_sha256": zip_info["zip_sha256"],
        "source_tree_before_sha256": before["tree_sha256"],
        "source_tree_after_sha256": after["tree_sha256"],
        "source_tree_unchanged": delta["unchanged"],
        "planned_steps": sorted(effective_selected),
        "executed_steps": [r["name"] for r in results if r["name"] != "source_tree_immutability"],
        "duration_ms": round((time.time() - started) * 1000),
        "steps": results,
    }
    write_json(evidence_dir / "result.json", report)
    manifest = write_evidence_manifest(evidence_dir)
    report["evidence_set_sha256"] = manifest["evidence_set_sha256"]
    write_json(evidence_dir / "result.json", report)
    write_evidence_manifest(evidence_dir)
    if report_path:
        write_json(report_path, report)

    print(
        f"FULL_SHARD_{report['status'].upper()} shard={args.shard} "
        f"steps={len(report['executed_steps'])} "
        f"tree_unchanged={str(delta['unchanged']).lower()}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
