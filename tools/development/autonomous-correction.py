#!/usr/bin/env python3
"""Conservative Development Project autonomous-correction helper.

This tool does NOT patch production source. It only:
  * derives a stable Failure Signature from an unresolved Failed Check,
  * decides whether the failure is eligible for a correction proposal,
  * prepares a SOURCE_UPDATE Correction Task only with explicit Human authorization,
  * enforces Compatibility Budget 0 / Exception Budget 0 between source trees.

The actual source correction remains an AI_START SOURCE_UPDATE action and must
converge to an already-existing Current canonical path. Analysis is read-only.
Task generation and parent-task mutation require explicit Human authorization.
Unknown/ambiguous cases fail closed.
"""
from __future__ import annotations
import argparse, copy, hashlib, json, re, sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
ALLOWED_PARENT_WORK_TYPES = {"DEVELOPMENT_ONLY", "SOURCE_UPDATE"}
PROTECTED_MEANING_RE = re.compile(r"\b(schema|security|permission|authorization|balance|game data|specification|仕様|セキュリティ|権限|バランス)\b", re.I)
SOURCE_PATH_RE = re.compile(r"(?:(?:game|studio|modules|shared|assets|bootstrap|tools)/[A-Za-z0-9_./-]+\.(?:js|mjs|cjs|py|php|html|json))")
ERROR_PATTERNS = [
    ("undefined_identifier", re.compile(r"(?:ReferenceError:\s*)?([A-Za-z_$][\w$]*)\s+is\s+not\s+defined", re.I)),
    ("missing_function", re.compile(r"([A-Za-z_$][\w$]*)\s+is\s+not\s+a\s+function", re.I)),
]
BANNED_COMPAT_RE = re.compile(r"\b(?:legacy|compat(?:ibility)?|fallback|shim|adapter|alias|dual[-_ ]?read|dual[-_ ]?write)\b", re.I)
CATCH_RE = re.compile(r"\bcatch\s*(?:\([^)]*\)|\{)")
PRODUCTION_SUFFIXES = {".js", ".mjs", ".cjs", ".html", ".php", ".py"}
PRODUCTION_ROOTS = ("game/", "studio/", "modules/", "shared/", "assets/", "php-runtime/", "cpf/src/")
ROOT_PRODUCTION = {"index.html", "bootstrap-core.js", "bootstrap-ui.js", "ai-gateway.js", "export-core.js"}


def now() -> str:
    return datetime.now(JST).replace(microsecond=0).isoformat()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalized_resolution(check):
    r = check.get("resolution") if isinstance(check.get("resolution"), dict) else {}
    return str(r.get("status") or "Open")


def unresolved_failed(check):
    return str(check.get("status")) == "Failed" and normalized_resolution(check) != "Resolved"


def find_task(project, task_id):
    return next((t for t in project.get("tasks", []) if str(t.get("id")) == task_id), None)


def extract_failure(check):
    text = "\n".join([str(check.get("result") or ""), str(check.get("evidence") or "")])
    case = ""
    m = re.search(r"(?:failed\s+case|Failed\s+case)\s*=\s*([A-Za-z0-9_.:-]+)", text)
    if m:
        case = m.group(1).rstrip(".,;:)")
    error_kind = "unknown"
    symbol = ""
    for kind, rx in ERROR_PATTERNS:
        m = rx.search(text)
        if m:
            error_kind, symbol = kind, m.group(1)
            break
    paths = sorted(set(SOURCE_PATH_RE.findall(text)))
    root_cause = ""
    m = re.search(r"Root cause:\s*(.+?)(?:\n|Current Quick|Required split|$)", text, re.S | re.I)
    if m:
        root_cause = re.sub(r"\s+", " ", m.group(1)).strip()
    raw = {
        "check_id": str(check.get("id") or ""),
        "target_id": str(check.get("target_id") or ""),
        "case": case,
        "error_kind": error_kind,
        "symbol": symbol,
        "source_paths": paths,
        "root_cause": root_cause,
    }
    canonical = json.dumps(raw, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    raw["signature"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:20]
    return raw, text


def existing_correction_count(project, parent_id):
    prefix = parent_id + "-CORR-"
    return sum(1 for t in project.get("tasks", []) if str(t.get("id") or "").startswith(prefix))


def existing_correction_ids_for_signature(project, signature):
    needle = str(signature or "")
    if not needle:
        return []
    matches = []
    for task in project.get("tasks", []):
        text = "\n".join([str(task.get("title") or ""), str(task.get("acceptance_criteria") or "")])
        if needle in text:
            matches.append(str(task.get("id") or ""))
    return sorted(x for x in matches if x)


def analyze(project, check_id=None):
    checks = project.get("checks", []) if isinstance(project.get("checks"), list) else []
    if check_id:
        candidates = [c for c in checks if str(c.get("id")) == check_id]
    else:
        candidates = [c for c in checks if unresolved_failed(c) and c.get("blocking") is not False]
    results = []
    for check in candidates:
        failure, text = extract_failure(check)
        parent = find_task(project, failure["target_id"]) if str(check.get("target_type")) == "Task" else None
        reasons = []
        if not unresolved_failed(check): reasons.append("check_not_unresolved_failed")
        if not parent: reasons.append("target_task_missing")
        elif str(parent.get("work_type")) not in ALLOWED_PARENT_WORK_TYPES: reasons.append("parent_work_type_not_eligible")
        if failure["error_kind"] not in {"undefined_identifier", "missing_function"}: reasons.append("failure_kind_not_safe_auto")
        if not failure["source_paths"]: reasons.append("source_path_not_identified")
        if PROTECTED_MEANING_RE.search(failure["root_cause"]): reasons.append("protected_meaning_change_possible")
        retries = existing_correction_count(project, failure["target_id"])
        duplicate_ids = existing_correction_ids_for_signature(project, failure["signature"])
        if duplicate_ids: reasons.append("failure_signature_already_has_correction")
        if retries >= 2: reasons.append("retry_budget_exhausted")
        results.append({
            "check_id": str(check.get("id") or ""),
            "parent_task_id": failure["target_id"],
            "failure": failure,
            "retry_count": retries,
            "max_retries": 2,
            "existing_same_signature_task_ids": duplicate_ids,
            "decision": "correction_candidate" if not reasons else "fail_closed",
            "reasons": reasons,
            "required_ai_proof": [
                "cause_is_unique_and_reproducible",
                "an_existing_current_canonical_path_is_identified_from_source",
                "no_spec_data_schema_security_meaning_change",
                "compatibility_budget_0",
                "exception_budget_0",
                "parent_e2e_is_not_run_or_resolved_by_the_correction_task",
            ],
        })
    return results


def next_correction_id(project, parent_id):
    used = {str(t.get("id")) for t in project.get("tasks", [])}
    for i in range(1, 3):
        cid = f"{parent_id}-CORR-{i:03d}"
        if cid not in used:
            return cid
    return ""


def prepare(project, check_id, human_instruction, approve_execution=False):
    rows = analyze(project, check_id)
    if len(rows) != 1:
        raise SystemExit("AUTOCORR_PREPARE_FAIL expected exactly one check")
    row = rows[0]
    if row["decision"] != "correction_candidate":
        raise SystemExit("AUTOCORR_PREPARE_FAIL " + ",".join(row["reasons"]))
    instruction = str(human_instruction or "").strip()
    if not instruction:
        raise SystemExit("AUTOCORR_PREPARE_FAIL explicit Human instruction is required")
    parent = find_task(project, row["parent_task_id"])
    cid = next_correction_id(project, parent["id"])
    if not cid:
        raise SystemExit("AUTOCORR_PREPARE_FAIL retry budget exhausted")
    stamp = now()
    order = parent.get("execution_order")
    if isinstance(order, (int, float)):
        correction_order = max(0, int(order) - 1)
    else:
        correction_order = None
    signature = row["failure"]["signature"]
    symbol = row["failure"]["symbol"] or "identified symbol"
    paths = ", ".join(row["failure"]["source_paths"])
    correction = {
        "id": cid,
        "box_id": parent.get("box_id"),
        "title": f"Auto Correction {signature}: Current正規経路へ収束する",
        "status": "Todo",
        "execution_order": correction_order,
        "depends_on": list(parent.get("depends_on") or []),
        "acceptance_criteria": (
            f"- Failure Signature `{signature}` / `{row['check_id']}` の一意な原因だけを修正する。\n"
            f"- 検出symbol `{symbol}`、source `{paths}` を既存Current正規経路へ収束し、互換wrapper/fallbackを作らない。\n"
            "- Compatibility Budget 0 / Exception Budget 0。legacy/compat/fallback/shim/adapter/alias、dual-read/dual-write、silent recovery、廃止API wrapperを新設しない。\n"
            "- エラー処理自体が修正目的でない限り、変更production fileのcatch数を増やさない。\n"
            "- Game仕様、Balance、Game Data、Save Schema意味、Security境界、Test/Gateを変更しない。\n"
            "- Targeted / Quick / Accept / Releaseを通す。Correction Task自身は親E2Eを実行・resolveしない。\n"
            "- Human Apply後に親Taskを再開し、親Task自身が同一E2Eを独立再実行してPassed Checkから元Failedをresolveする。"
        ),
        "work_type": "SOURCE_UPDATE",
        "requires_human_approval": True,
        "approval": {
            "status": "Approved" if approve_execution else "Pending",
            "by": "human_instruction" if approve_execution else "",
            "at": stamp if approve_execution else "",
        },
        "created_at": stamp,
        "updated_at": stamp,
    }
    project.setdefault("tasks", []).append(correction)
    # Parent is blocked by the generated correction and will resume only after it is Done.
    parent["status"] = "Blocked"
    deps = list(parent.get("depends_on") or [])
    if cid not in deps:
        deps.append(cid)
    parent["depends_on"] = deps
    parent["updated_at"] = stamp
    project.setdefault("history", []).append({
        "at": stamp,
        "type": "AutonomousCorrectionTaskGenerated",
        "summary": f"{row['check_id']} -> {cid}; failure_signature={signature}; Human-authorized proposal; execution_approval={'Approved' if approve_execution else 'Pending'}; parent={parent['id']}; source edit not yet executed; human_instruction={instruction}"
    })
    return project, {**row, "generated_task_id": cid}


def production_files(root: Path):
    for p in root.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in PRODUCTION_SUFFIXES:
            continue
        rel = p.relative_to(root).as_posix()
        if rel in ROOT_PRODUCTION or rel.startswith(PRODUCTION_ROOTS):
            if rel.startswith(("game/tests/", "studio/tests/", "shared/tests/")):
                continue
            yield rel, p


def text_counts(path: Path):
    try: text = path.read_text(encoding="utf-8")
    except Exception: return {"compat": 0, "catch": 0}
    return {"compat": len(BANNED_COMPAT_RE.findall(text)), "catch": len(CATCH_RE.findall(text))}


def budget(baseline: Path, target: Path):
    bmap = dict(production_files(baseline)); tmap = dict(production_files(target))
    violations = []
    changed = []
    for rel in sorted(set(bmap) | set(tmap)):
        bp, tp = bmap.get(rel), tmap.get(rel)
        if bp is None or tp is None:
            # Deletion/new production files are not safe-auto by default.
            violations.append({"path": rel, "reason": "production_file_added_or_removed"})
            continue
        if hashlib.sha256(bp.read_bytes()).digest() == hashlib.sha256(tp.read_bytes()).digest():
            continue
        bc, tc = text_counts(bp), text_counts(tp)
        changed.append({"path": rel, "baseline": bc, "target": tc})
        if tc["compat"] > bc["compat"]:
            violations.append({"path": rel, "reason": "compatibility_budget_increased", "baseline": bc["compat"], "target": tc["compat"]})
        if tc["catch"] > bc["catch"]:
            violations.append({"path": rel, "reason": "exception_budget_increased", "baseline": bc["catch"], "target": tc["catch"]})
    return {"status": "PASS" if not violations else "FAIL", "changed_production_files": changed, "violations": violations}


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    a = sp.add_parser("analyze")
    a.add_argument("--project", required=True, type=Path)
    a.add_argument("--check-id")
    a.add_argument("--json-output", type=Path)
    p = sp.add_parser("prepare")
    p.add_argument("--project", required=True, type=Path)
    p.add_argument("--check-id", required=True)
    p.add_argument("--output-project", required=True, type=Path)
    p.add_argument("--human-authorized", action="store_true")
    p.add_argument("--human-instruction")
    p.add_argument("--human-approve-execution", action="store_true", help="Use only when the same explicit Human instruction authorizes execution of the generated Correction Task.")
    p.add_argument("--json-output", type=Path)
    b = sp.add_parser("budget")
    b.add_argument("--baseline-source", required=True, type=Path)
    b.add_argument("--target-source", required=True, type=Path)
    b.add_argument("--json-output", type=Path)
    args = ap.parse_args()
    if args.cmd == "analyze":
        result = {"schema_version": 1, "results": analyze(load_json(args.project), args.check_id)}
    elif args.cmd == "prepare":
        if not args.human_authorized:
            raise SystemExit("AUTOCORR_PREPARE_FAIL --human-authorized is required after explicit Human instruction")
        project, decision = prepare(load_json(args.project), args.check_id, args.human_instruction, args.human_approve_execution)
        write_json(args.output_project, project)
        result = {"schema_version": 1, "decision": decision, "output_project": str(args.output_project)}
    else:
        result = {"schema_version": 1, **budget(args.baseline_source.resolve(), args.target_source.resolve())}
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if getattr(args, "json_output", None):
        args.json_output.write_text(text + "\n", encoding="utf-8")
    print(text)
    if args.cmd == "budget" and result["status"] != "PASS":
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
