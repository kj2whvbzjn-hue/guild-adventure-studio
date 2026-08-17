#!/usr/bin/env python3
"""Conservative impact planner. Any uncertainty escalates to Full."""
from __future__ import annotations
import argparse, fnmatch, hashlib, json, re, sys
from pathlib import Path

sys.dont_write_bytecode = True


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def match(rel: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(rel, p) for p in patterns)


def build_tokens(root: Path) -> set[str]:
    try: b = load_json(root / "package-build.json")
    except Exception: return set()
    game = str(b.get("game_build") or ""); studio = str(b.get("studio_build") or "")
    out = {x for x in (game, studio) if x}
    gm = re.search(r"GA-B(\d+)\.(\d+)$", game); sm = re.search(r"GKS-B(\d+)$", studio)
    if gm and sm:
        cg = gm.group(1) + gm.group(2); sb = sm.group(1)
        out |= {cg+"b"+sb, "b"+cg+"-b"+sb, "gks-studio-b"+sb, "ga-game-b"+cg+"-b"+sb, "appv="+sb, "?v="+sb, "&v="+sb, "v="+cg+"b"+sb}
    return {x for x in out if x}


def normalized(path: Path, tokens: set[str]) -> bytes:
    data = path.read_bytes()
    try: text = data.decode("utf-8")
    except UnicodeDecodeError: return data
    for token in sorted(tokens, key=len, reverse=True): text = text.replace(token, "<BUILD_TOKEN>")
    return text.encode("utf-8")


def build_only(old: Path, new: Path, tokens: set[str]) -> bool:
    return old.is_file() and new.is_file() and normalized(old, tokens) == normalized(new, tokens)


def all_paths(root: Path) -> set[str]:
    return {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and ".git" not in p.parts}


def tree_sha(root: Path) -> str:
    rows=[]
    for p in sorted(root.rglob("*"), key=lambda x:x.relative_to(root).as_posix()):
        if not p.is_file() or ".git" in p.parts:
            continue
        rel=p.relative_to(root).as_posix()
        rows.append(f"{rel}\0{p.stat().st_size}\0{sha(p)}")
    return hashlib.sha256("\n".join(rows).encode("utf-8")).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("baseline_root", type=Path)
    ap.add_argument("applied_root", type=Path)
    ap.add_argument("--test-integrity-report", type=Path)
    ap.add_argument("--json-output", type=Path, required=True)
    args = ap.parse_args()
    baseline = args.baseline_root.resolve(); applied = args.applied_root.resolve()
    policy_path = baseline / "shared/integrity/impact-test-policy.json"
    policy_origin = "baseline"
    if not policy_path.is_file():
        policy_path = applied / "shared/integrity/impact-test-policy.json"; policy_origin = "bootstrap_applied"
    try: policy = load_json(policy_path)
    except Exception as exc:
        print(f"IMPACT_PLAN_FAIL policy {exc}"); return 1
    tokens = build_tokens(baseline) | build_tokens(applied)
    before = all_paths(baseline); after = all_paths(applied)
    raw_changed = sorted((before ^ after) | {r for r in (before & after) if sha(baseline/r) != sha(applied/r)})
    test_integrity = {}
    machine_hash_sync_paths: set[str] = set()
    if args.test_integrity_report and args.test_integrity_report.is_file():
        test_integrity = load_json(args.test_integrity_report)
        machine_hash_sync_paths = {str(x) for x in test_integrity.get("machine_derived_hash_sync_paths", [])}
    ignored = []
    effective = []
    for rel in raw_changed:
        if rel == "package_manifest.json":
            ignored.append({"path": rel, "reason": "package_manifest_generated"}); continue
        if rel == "package-build.json":
            ignored.append({"path": rel, "reason": "component_build_metadata"}); continue
        if rel in machine_hash_sync_paths:
            ignored.append({"path": rel, "reason": "machine_derived_hash_sync_verified"}); continue
        if rel in before and rel in after and build_only(baseline/rel, applied/rel, tokens):
            ignored.append({"path": rel, "reason": "build_token_only"}); continue
        effective.append(rel)
    reasons = []
    require_full = False
    if test_integrity:
        if int(test_integrity.get("protected_changed_count", 0)) > 0:
            require_full = True; reasons.append("protected_acceptance_asset_changed")
    full_patterns = list(policy.get("full_on_patterns", []))
    full_hits = sorted(rel for rel in effective if match(rel, full_patterns))
    if full_hits:
        require_full = True; reasons.append("safety_critical_path:" + ",".join(full_hits[:12]))
    selected_patterns = list(policy.get("always_test_patterns", []))
    matched_rules = []
    unmatched = []
    if not require_full:
        for rel in effective:
            matched = False
            for rule in policy.get("rules", []):
                if match(rel, list(rule.get("source_patterns", []))):
                    matched = True
                    if rule.get("id") not in matched_rules: matched_rules.append(rule.get("id"))
                    selected_patterns.extend(rule.get("test_patterns", []))
            if not matched:
                unmatched.append(rel)
        if unmatched:
            require_full = True; reasons.append("unclassified_change:" + ",".join(unmatched[:12]))
    registry = load_json(applied / "shared/tests/test-registry.json")
    active = [x for x in registry.get("release_gate", []) if "source" in x.get("contexts", ["source", "update"])]
    selected = []
    if not require_full:
        for item in active:
            rel = item.get("path", "")
            if match(rel, selected_patterns) and rel not in selected:
                selected.append(rel)
        # Every declared pattern must resolve when it is not a wildcard-only optional rule.
        unresolved = [p for p in selected_patterns if not any(fnmatch.fnmatchcase(x.get("path", ""), p) for x in active)]
        if unresolved:
            require_full = True; reasons.append("test_pattern_unresolved:" + ",".join(unresolved))
    mode = "full" if require_full else "impact"
    result = {
        "schema_version": 1,
        "status": "pass",
        "mode": mode,
        "policy_origin": policy_origin,
        "baseline_tree_sha256": tree_sha(baseline),
        "applied_tree_sha256": tree_sha(applied),
        "impact_policy_sha256": sha(policy_path),
        "test_registry_sha256": sha(applied / "shared/tests/test-registry.json"),
        "raw_changed_paths": raw_changed,
        "effective_changed_paths": effective,
        "ignored_changes": ignored,
        "matched_rules": matched_rules,
        "selected_tests": selected if not require_full else [],
        "selected_test_count": len(selected) if not require_full else 0,
        "reasons": reasons or (["no_effective_change"] if not effective else ["all_changes_classified"]),
        "timing": policy.get("timing", {}),
    }
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"IMPACT_PLAN_OK mode={mode} changed={len(effective)} selected_tests={result['selected_test_count']} policy={policy_origin}")
    if reasons: print("IMPACT_PLAN_REASON " + " | ".join(reasons))
    return 0

if __name__ == "__main__": raise SystemExit(main())
