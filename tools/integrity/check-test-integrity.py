#!/usr/bin/env python3
"""Compare protected acceptance assets against a baseline and reject silent weakening.

The baseline policy is authoritative once installed. Protected files that are
modified, removed, or newly added require an exact external human approval,
except for exact build-token-only synchronization explicitly allowed by policy.
"""
from __future__ import annotations
import argparse, fnmatch, hashlib, json, re, sys
from pathlib import Path

sys.dont_write_bytecode = True


def sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def match_any(rel: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(rel, p) for p in patterns)


def is_inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def build_tokens(root: Path) -> set[str]:
    try:
        b = load_json(root / "package-build.json")
    except Exception:
        return set()
    game = str(b.get("game_build") or "")
    studio = str(b.get("studio_build") or "")
    out = {x for x in (game, studio) if x}
    gm = re.search(r"GA-B(\d+)\.(\d+)$", game)
    sm = re.search(r"GKS-B(\d+)$", studio)
    if gm and sm:
        compact_game = gm.group(1) + gm.group(2)
        sb = sm.group(1)
        out |= {
            compact_game + "b" + sb,
            "b" + compact_game + "-b" + sb,
            "gks-studio-b" + sb,
            "ga-game-b" + compact_game + "-b" + sb,
            "appv=" + sb,
            "?v=" + sb,
            "&v=" + sb,
            "v=" + compact_game + "b" + sb,
        }
    return {x for x in out if x}


def normalized_bytes(path: Path, tokens: set[str]) -> bytes:
    data = path.read_bytes()
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return data
    for token in sorted(tokens, key=len, reverse=True):
        text = text.replace(token, "<BUILD_TOKEN>")
    return text.encode("utf-8")


def build_only_equal(a: Path, b: Path, token_union: set[str]) -> bool:
    if not a.is_file() or not b.is_file():
        return False
    return normalized_bytes(a, token_union) == normalized_bytes(b, token_union)


def resolve_policy(baseline: Path, applied: Path) -> tuple[dict, str]:
    bp = baseline / "shared/integrity/test-integrity-policy.json"
    ap = applied / "shared/integrity/test-integrity-policy.json"
    if bp.is_file():
        return load_json(bp), "baseline"
    if ap.is_file():
        return load_json(ap), "bootstrap_applied"
    raise ValueError("TEST_INTEGRITY_POLICY_MISSING")


def validate_approval(path: Path | None, changed: list[dict], policy: dict, errors: list[str], baseline: Path, applied: Path) -> dict | None:
    if not changed:
        if path is not None:
            errors.append("STALE_TEST_CHANGE_APPROVAL")
        return None
    if path is None or not path.is_file():
        errors.append("PROTECTED_TEST_CHANGE_APPROVAL_REQUIRED " + ",".join(x["path"] for x in changed))
        return None
    approval_path = path.resolve()
    if policy.get("approval", {}).get("external_only", False):
        if is_inside(approval_path, baseline) or is_inside(approval_path, applied):
            errors.append("TEST_CHANGE_APPROVAL_MUST_BE_EXTERNAL")
            return None
    try:
        approval = load_json(approval_path)
    except Exception as exc:
        errors.append(f"TEST_CHANGE_APPROVAL_INVALID {exc}")
        return None
    spec = policy.get("approval", {})
    if approval.get("schema_version") != spec.get("schema_version", 1):
        errors.append("TEST_CHANGE_APPROVAL_SCHEMA_VERSION")
    if approval.get("scope") != spec.get("scope", "PROTECTED_TEST_CHANGE"):
        errors.append("TEST_CHANGE_APPROVAL_SCOPE")
    if approval.get("actor_type") != spec.get("actor_type", "human"):
        errors.append("TEST_CHANGE_APPROVAL_ACTOR_NOT_HUMAN")
    if not str(approval.get("approved_by") or "").strip():
        errors.append("TEST_CHANGE_APPROVAL_APPROVER_MISSING")
    entries = approval.get("entries")
    if not isinstance(entries, list):
        errors.append("TEST_CHANGE_APPROVAL_ENTRIES_INVALID")
        entries = []
    by_path = {}
    required_fields = spec.get("required_entry_fields", ["path", "baseline_sha256", "updated_sha256", "reason"])
    for i, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"TEST_CHANGE_APPROVAL_ENTRY_NOT_OBJECT index={i}")
            continue
        rel = str(entry.get("path") or "")
        if not rel or rel in by_path:
            errors.append(f"TEST_CHANGE_APPROVAL_PATH_INVALID index={i} path={rel!r}")
            continue
        by_path[rel] = entry
        for field in required_fields:
            if field not in entry or (field == "reason" and not str(entry.get(field) or "").strip()):
                errors.append(f"TEST_CHANGE_APPROVAL_FIELD_MISSING path={rel} field={field}")
    expected = {x["path"] for x in changed}
    actual = set(by_path)
    if expected != actual:
        errors.append("TEST_CHANGE_APPROVAL_PATH_MISMATCH expected=" + ",".join(sorted(expected)) + " actual=" + ",".join(sorted(actual)))
    for item in changed:
        entry = by_path.get(item["path"])
        if not entry:
            continue
        if entry.get("baseline_sha256") != item["baseline_sha256"]:
            errors.append(f"TEST_CHANGE_APPROVAL_BASELINE_HASH_MISMATCH path={item['path']}")
        if entry.get("updated_sha256") != item["updated_sha256"]:
            errors.append(f"TEST_CHANGE_APPROVAL_UPDATED_HASH_MISMATCH path={item['path']}")
    return approval


def protected_file_set(root: Path, patterns: list[str]) -> set[str]:
    out: set[str] = set()
    for path in root.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        rel = path.relative_to(root).as_posix()
        if match_any(rel, patterns):
            out.add(rel)
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("baseline_root", type=Path)
    p.add_argument("applied_root", type=Path)
    p.add_argument("--approval-file", type=Path)
    p.add_argument("--json-output", type=Path)
    args = p.parse_args()
    baseline = args.baseline_root.resolve(); applied = args.applied_root.resolve()
    errors: list[str] = []
    try:
        policy, origin = resolve_policy(baseline, applied)
    except Exception as exc:
        print(f"TEST_INTEGRITY_FAIL\n{exc}")
        return 1
    patterns = list(policy.get("protected_patterns", []))
    if not patterns:
        errors.append("TEST_INTEGRITY_PROTECTED_PATTERNS_EMPTY")
    token_union = build_tokens(baseline) | build_tokens(applied)
    baseline_protected = protected_file_set(baseline, patterns)
    applied_protected = protected_file_set(applied, patterns)
    changed: list[dict] = []
    build_only: list[str] = []
    for rel in sorted(baseline_protected):
        old = baseline / rel; new = applied / rel
        old_hash = sha256(old); new_hash = sha256(new)
        if old_hash == new_hash:
            continue
        if new_hash is not None and policy.get("build_token_only_change", {}).get("allowed_without_approval") and build_only_equal(old, new, token_union):
            build_only.append(rel)
            continue
        changed.append({
            "path": rel,
            "change_kind": "delete" if new_hash is None else "modify",
            "baseline_sha256": old_hash,
            "updated_sha256": new_hash,
        })
    added = sorted(applied_protected - baseline_protected)
    if policy.get("new_protected_files_require_approval", True):
        for rel in added:
            changed.append({
                "path": rel,
                "change_kind": "add",
                "baseline_sha256": None,
                "updated_sha256": sha256(applied / rel),
            })
    changed.sort(key=lambda x: x["path"])
    approval = validate_approval(args.approval_file, changed, policy, errors, baseline, applied)
    report = {
        "schema_version": 2,
        "status": "fail" if errors else "pass",
        "policy_origin": origin,
        "protected_baseline_count": len(baseline_protected),
        "protected_applied_count": len(applied_protected),
        "protected_added_count": len(added),
        "protected_changed_count": len(changed),
        "build_token_only_count": len(build_only),
        "protected_changes": changed,
        "build_token_only_paths": build_only,
        "approval_present": bool(approval),
        "approval_external_only": bool(policy.get("approval", {}).get("external_only", False)),
        "runtime_human_confirmation_required": bool(changed and policy.get("approval", {}).get("runtime_human_confirmation_required", True)),
        "errors": errors,
    }
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if errors:
        print("TEST_INTEGRITY_FAIL")
        print("\n".join(errors))
        return 1
    print(f"TEST_INTEGRITY_OK baseline={len(baseline_protected)} applied={len(applied_protected)} changed={len(changed)} added={len(added)} build_only={len(build_only)} approval={'yes' if approval else 'no'} policy={origin}")
    if changed:
        print("TEST_INTEGRITY_HUMAN_CONFIRMATION_REQUIRED " + ",".join(x["path"] for x in changed))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
