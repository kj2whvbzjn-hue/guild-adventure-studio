#!/usr/bin/env python3
"""Validate whether a tree is a GitHub source checkout or a Studio update package."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys

CONTROL = {"DELETE_MANIFEST.txt"}
TRANSIENT_DIRS = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}
TRANSIENT_SUFFIXES = {".pyc", ".pyo", ".tmp", ".bak", ".swp"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default=Path(__file__).resolve().parents[2])
    parser.add_argument("--context", choices=("source", "update"), required=True)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    errors: list[str] = []

    delete_manifest = root / "DELETE_MANIFEST.txt"
    if args.context == "source" and delete_manifest.exists():
        errors.append("SOURCE_CONTAINS_DELETE_MANIFEST")
    if args.context == "update" and not delete_manifest.is_file():
        errors.append("UPDATE_MISSING_DELETE_MANIFEST")

    # Deployment metadata must exist and must not revive removed aggregate/formal build concepts.
    meta_path = root / "studio-update.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"STUDIO_UPDATE_INVALID {exc}")
        meta = {}
    if meta.get("version") != "GKS-B484":
        errors.append(f"STUDIO_VERSION_UNEXPECTED {meta.get('version')!r}")
    if "formal" in json.dumps(meta, ensure_ascii=False).lower() and meta.get("formal_build") not in (None, ""):
        errors.append("FORMAL_BUILD_REINTRODUCED")

    # Reject generated or editor debris from both source and update packages.
    for p in root.rglob("*"):
        rel = p.relative_to(root)
        if any(part in TRANSIENT_DIRS for part in rel.parts):
            errors.append(f"TRANSIENT_PATH {rel.as_posix()}")
            continue
        if p.is_file() and p.suffix.lower() in TRANSIENT_SUFFIXES:
            errors.append(f"TRANSIENT_FILE {rel.as_posix()}")

    # Ensure context control files do not leak into package authority.
    manifest_path = root / "package_manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        listed = {x.get("path") for x in manifest.get("files", [])}
        leaked = sorted(CONTROL & listed)
        for rel in leaked:
            errors.append(f"CONTROL_FILE_LISTED {rel}")
    except Exception as exc:
        errors.append(f"PACKAGE_MANIFEST_INVALID {exc}")

    if errors:
        print("INSPECTION_CONTEXT_FAIL")
        print("\n".join(sorted(set(errors))))
        return 1
    print(f"INSPECTION_CONTEXT_OK context={args.context}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
