#!/usr/bin/env python3
"""Read-only inspection evidence helpers."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import platform
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

EVIDENCE_SCHEMA_VERSION = 1


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def path_state(value: str) -> dict:
    return {
        "value": value,
        "nfc": unicodedata.is_normalized("NFC", value),
        "nfd": unicodedata.is_normalized("NFD", value),
        "contains_escaped_unicode_pattern": bool(__import__("re").search(r"#U[0-9A-Fa-f]{4,6}", value)),
    }


def tree_snapshot(root: Path) -> dict:
    root = root.resolve()
    entries = []
    for path in sorted(root.rglob("*"), key=lambda p: p.relative_to(root).as_posix()):
        if ".git" in path.parts:
            continue
        rel = path.relative_to(root).as_posix()
        if path.is_symlink():
            target = os.readlink(path)
            entries.append({
                "path": rel,
                "type": "symlink",
                "target": target,
                "path_state": path_state(rel),
            })
        elif path.is_file():
            entries.append({
                "path": rel,
                "type": "file",
                "size": path.stat().st_size,
                "sha256": sha256_file(path),
                "path_state": path_state(rel),
            })
    canonical = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {
        "schema_version": EVIDENCE_SCHEMA_VERSION,
        "root": str(root),
        "file_count": sum(x["type"] == "file" for x in entries),
        "entry_count": len(entries),
        "total_bytes": sum(x.get("size", 0) for x in entries),
        "tree_sha256": sha256_bytes(canonical),
        "entries": entries,
    }


def compare_trees(before: dict, after: dict) -> dict:
    b = {x["path"]: x for x in before["entries"]}
    a = {x["path"]: x for x in after["entries"]}
    added = sorted(set(a) - set(b))
    removed = sorted(set(b) - set(a))
    changed = []
    for rel in sorted(set(a) & set(b)):
        if a[rel] != b[rel]:
            changed.append({"path": rel, "before": b[rel], "after": a[rel]})
    return {
        "unchanged": not added and not removed and not changed,
        "added": added,
        "removed": removed,
        "changed": changed,
        "before_tree_sha256": before["tree_sha256"],
        "after_tree_sha256": after["tree_sha256"],
    }


def zip_entries(zip_path: Path) -> dict:
    zip_path = zip_path.resolve()
    records = []
    with ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = info.filename
            raw_reconstruction = name.encode("utf-8") if info.flag_bits & 0x800 else None
            records.append({
                "name": name,
                "path_state": path_state(name),
                "flag_bits": info.flag_bits,
                "utf8_flag": bool(info.flag_bits & 0x800),
                "raw_name_bytes_base64": base64.b64encode(raw_reconstruction).decode("ascii") if raw_reconstruction is not None else None,
                "compress_type": info.compress_type,
                "compressed_size": info.compress_size,
                "size": info.file_size,
                "crc32": f"{info.CRC:08x}",
                "extra_fields_base64": base64.b64encode(info.extra).decode("ascii"),
            })
    canonical = json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {
        "schema_version": EVIDENCE_SCHEMA_VERSION,
        "zip_path": str(zip_path),
        "zip_size": zip_path.stat().st_size,
        "zip_sha256": sha256_file(zip_path),
        "entry_count": len(records),
        "central_directory_entries_sha256": sha256_bytes(canonical),
        "entries": records,
    }


def execution_environment(command: list[str], cwd: Path, env: dict[str, str]) -> dict:
    selected = {
        key: env.get(key)
        for key in (
            "PYTHONDONTWRITEBYTECODE",
            "PYTHONPYCACHEPREFIX",
            "PYTHONPATH",
            "LANG",
            "LC_ALL",
            "TZ",
        )
    }
    return {
        "schema_version": EVIDENCE_SCHEMA_VERSION,
        "recorded_at": utc_now(),
        "command": command,
        "cwd": str(cwd.resolve()),
        "python_executable": sys.executable,
        "python_version": sys.version,
        "platform": platform.platform(),
        "filesystem_encoding": sys.getfilesystemencoding(),
        "environment": selected,
    }


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_evidence_manifest(directory: Path) -> dict:
    records = []
    for path in sorted(directory.glob("*.json")):
        if path.name == "evidence-manifest.json":
            continue
        records.append({
            "path": path.name,
            "size": path.stat().st_size,
            "sha256": sha256_file(path),
        })
    manifest = {
        "schema_version": EVIDENCE_SCHEMA_VERSION,
        "generated_at": utc_now(),
        "files": records,
    }
    canonical = json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    manifest["evidence_set_sha256"] = sha256_bytes(canonical)
    write_json(directory / "evidence-manifest.json", manifest)
    return manifest
