#!/usr/bin/env python3
"""Read-only inspection evidence helpers."""
from __future__ import annotations

import base64
import binascii
import hashlib
import struct
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


def _find_eocd(data: bytes) -> int:
    start = max(0, len(data) - 65557)
    return data.rfind(b"PK\x05\x06", start)


def _parse_extra_fields(extra: bytes) -> list[dict]:
    fields = []
    offset = 0
    while offset + 4 <= len(extra):
        header_id, size = struct.unpack_from("<HH", extra, offset)
        offset += 4
        payload = extra[offset:offset + size]
        if len(payload) != size:
            fields.append({"header_id": f"0x{header_id:04x}", "truncated": True})
            break
        record = {
            "header_id": f"0x{header_id:04x}",
            "size": size,
            "payload_base64": base64.b64encode(payload).decode("ascii"),
        }
        if header_id == 0x7075:
            record["type"] = "unicode_path"
            if size >= 5:
                version = payload[0]
                name_crc32 = struct.unpack_from("<I", payload, 1)[0]
                utf8_bytes = payload[5:]
                record.update({
                    "version": version,
                    "name_crc32": f"{name_crc32:08x}",
                    "unicode_name_bytes_base64": base64.b64encode(utf8_bytes).decode("ascii"),
                })
                try:
                    record["unicode_name"] = utf8_bytes.decode("utf-8", "strict")
                    record["unicode_name_decode_ok"] = True
                except UnicodeDecodeError as exc:
                    record["unicode_name_decode_ok"] = False
                    record["decode_error"] = {"start": exc.start, "end": exc.end}
            else:
                record["invalid"] = "payload_too_short"
        fields.append(record)
        offset += size
    return fields


def _central_directory_records(zip_path: Path) -> list[dict]:
    data = zip_path.read_bytes()
    eocd = _find_eocd(data)
    if eocd < 0:
        raise ValueError("ZIP_EOCD_NOT_FOUND")
    count = struct.unpack_from("<H", data, eocd + 10)[0]
    offset = struct.unpack_from("<I", data, eocd + 16)[0]
    if count == 0xFFFF or offset == 0xFFFFFFFF:
        raise ValueError("ZIP64_CENTRAL_DIRECTORY_NOT_SUPPORTED_FOR_RAW_EVIDENCE")
    records = []
    for index in range(count):
        if offset + 46 > len(data) or data[offset:offset + 4] != b"PK\x01\x02":
            raise ValueError(f"CENTRAL_DIRECTORY_INVALID index={index} offset={offset}")
        flags = struct.unpack_from("<H", data, offset + 8)[0]
        crc32 = struct.unpack_from("<I", data, offset + 16)[0]
        compressed_size = struct.unpack_from("<I", data, offset + 20)[0]
        file_size = struct.unpack_from("<I", data, offset + 24)[0]
        name_len, extra_len, comment_len = struct.unpack_from("<HHH", data, offset + 28)
        name_start = offset + 46
        raw_name = data[name_start:name_start + name_len]
        extra = data[name_start + name_len:name_start + name_len + extra_len]
        fields = _parse_extra_fields(extra)
        unicode_path = next((f for f in fields if f.get("type") == "unicode_path"), None)
        utf8_flag = bool(flags & 0x800)
        decoded_name = None
        decode_source = None
        decode_error = None
        if utf8_flag:
            try:
                decoded_name = raw_name.decode("utf-8", "strict")
                decode_source = "general_purpose_utf8_flag"
            except UnicodeDecodeError as exc:
                decode_error = {"encoding": "utf-8", "start": exc.start, "end": exc.end}
        elif all(b < 0x80 for b in raw_name):
            decoded_name = raw_name.decode("ascii")
            decode_source = "ascii_without_utf8_flag"
        elif unicode_path and unicode_path.get("unicode_name_decode_ok"):
            expected_crc = f"{binascii.crc32(raw_name) & 0xffffffff:08x}"
            unicode_path["raw_name_crc32"] = expected_crc
            unicode_path["crc_matches_raw_name"] = unicode_path.get("name_crc32") == expected_crc
            if unicode_path["crc_matches_raw_name"] and unicode_path.get("version") == 1:
                decoded_name = unicode_path["unicode_name"]
                decode_source = "unicode_path_extra_field_0x7075"
        if decoded_name is None and decode_error is None:
            decode_error = {"encoding": "unsupported_unflagged_non_ascii", "raw_length": len(raw_name)}
        records.append({
            "index": index,
            "central_directory_offset": offset,
            "raw_name_bytes_base64": base64.b64encode(raw_name).decode("ascii"),
            "raw_name_bytes_hex": raw_name.hex(),
            "flag_bits": flags,
            "utf8_flag": utf8_flag,
            "decoded_name": decoded_name,
            "decode_source": decode_source,
            "decode_error": decode_error,
            "path_state": path_state(decoded_name) if decoded_name is not None else None,
            "crc32": f"{crc32:08x}",
            "compressed_size": compressed_size,
            "size": file_size,
            "extra_fields": fields,
            "extra_fields_base64": base64.b64encode(extra).decode("ascii"),
        })
        offset += 46 + name_len + extra_len + comment_len
    return records


def zip_entries(zip_path: Path) -> dict:
    zip_path = zip_path.resolve()
    raw_records = _central_directory_records(zip_path)
    with ZipFile(zip_path) as zf:
        infos = zf.infolist()
        if len(infos) != len(raw_records):
            raise ValueError("ZIPINFO_CENTRAL_DIRECTORY_COUNT_MISMATCH")
        records = []
        for raw, info in zip(raw_records, infos):
            record = dict(raw)
            record["library_name"] = info.filename
            record["library_path_state"] = path_state(info.filename)
            record["library_matches_decoded_name"] = raw.get("decoded_name") == info.filename
            record["library_flag_bits"] = info.flag_bits
            records.append(record)
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
