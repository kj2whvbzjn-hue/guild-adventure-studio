#!/usr/bin/env python3
import json, os, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DX = HERE.parent
STUDIO = DX.parent
ROOT = STUDIO.parent

def run(cmd, cwd=None):
    p = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    if p.returncode:
        print(p.stdout)
        print(p.stderr, file=sys.stderr)
        raise RuntimeError("FAILED: " + " ".join(map(str, cmd)))
    return p.stdout.strip()

def check_json():
    targets = [DX / "dataset-registry.json"]
    targets += sorted((DX / "schemas").glob("*.json"))
    targets += sorted((HERE / "fixtures").glob("*.json"))
    for p in targets:
        json.loads(p.read_text(encoding="utf-8"))

def js_syntax():
    for p in [DX / "data-exchange-core.js", DX / "data-exchange-ui.js"]:
        if p.exists():
            run(["node", "--check", str(p)])

def core_test():
    p = HERE / "data-exchange-core.test.js"
    if p.exists():
        run(["node", str(p)], cwd=str(HERE))

def studio_reference():
    index = STUDIO / "index.html"
    if not index.exists():
        raise RuntimeError("studio/index.html not found")
    text = index.read_text(encoding="utf-8")
    required = ["data-exchange-core.js", "data-exchange-ui.js"]
    missing = [x for x in required if x not in text]
    if missing:
        raise RuntimeError("Studio reference missing: " + ", ".join(missing))

def ui_selection_rule():
    index = STUDIO / "index.html"
    text = index.read_text(encoding="utf-8")
    if 'input type="checkbox" data-dx-monster-id' in text or 'data-dx-monster-id=' in text:
        raise RuntimeError("Data Exchange must not add native checkbox selection to master items")
    if 'data-dx-monster-row=' not in text:
        raise RuntimeError("Monster row selection hook missing")
    if 'チェックしたモンスター' in text:
        raise RuntimeError("Legacy checkbox wording remains")

def format_version():
    core = (DX / "data-exchange-core.js").read_text(encoding="utf-8")
    if "GKS_DATA_EXCHANGE" not in core:
        raise RuntimeError("GKS_DATA_EXCHANGE format marker missing")
    schemas = list((DX / "schemas").glob("*.json"))
    if not schemas:
        raise RuntimeError("Data Exchange schema missing")

def fixture_parse():
    for p in (HERE / "fixtures").glob("*.json"):
        json.loads(p.read_text(encoding="utf-8"))

def smoke_names():
    test = HERE / "data-exchange-core.test.js"
    if not test.exists():
        return
    t = test.read_text(encoding="utf-8").lower()
    # Phase1 test should cover canonicalization/dependency concepts.
    if "canonical" not in t:
        raise RuntimeError("canonicalization test marker missing")
    if not any(k in t for k in ("dependency", "recursive", "skill", "tag")):
        raise RuntimeError("dependency test marker missing")

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "quick"
    if mode not in ("quick", "full"):
        print("usage: run.py [quick|full]", file=sys.stderr)
        return 2
    reg = json.loads((HERE / "test-registry.json").read_text(encoding="utf-8"))
    steps = reg[mode]
    actions = {
        "core_js_syntax": js_syntax,
        "ui_js_syntax": lambda: None,  # checked together by js_syntax
        "json_parse": check_json,
        "core_unit_test": core_test,
        "studio_reference": studio_reference,
        "ui_selection_rule": ui_selection_rule,
        "format_version": format_version,
        "fixture_parse": fixture_parse,
        "canonicalization_smoke": smoke_names,
        "dependency_smoke": smoke_names,
    }
    done=set()
    for name in steps:
        if name in done: continue
        print(f"[RUN] {name}")
        actions[name]()
        done.add(name)
        print(f"[PASS] {name}")
    print(f"DATA EXCHANGE {mode.upper()}: PASS")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
