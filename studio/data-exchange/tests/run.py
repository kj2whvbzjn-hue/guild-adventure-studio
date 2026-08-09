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
    for p in [DX / "data-exchange-integrity-validator.js", DX / "data-exchange-core.js", DX / "data-exchange-ui.js"]:
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
    ui = (DX / "data-exchange-ui.js").read_text(encoding="utf-8")
    if 'type="checkbox"' in ui.lower() or "type='checkbox'" in ui.lower():
        raise RuntimeError("Data Exchange dedicated picker must not use native checkbox selection")
    if 'data-dx-monster-row=' in text or 'dx-selectable' in text:
        raise RuntimeError("Normal master rows must not contain Data Exchange selection hooks")
    required = ['id="masterExchangeToolbar"', 'id="dataExchangePicker"', '表示中を全選択', '分類全件を選択']
    missing = [x for x in required if x not in text]
    if missing:
        raise RuntimeError("Dedicated Data Exchange selection surface missing: " + ", ".join(missing))
    if 'openPicker' not in ui or 'selectAllDataset' not in ui:
        raise RuntimeError("Dedicated picker selection functions missing")
    if '.dx-picker{position:fixed;inset:0;z-index:10050;' not in text:
        raise RuntimeError("Data Exchange picker must stay above the global project navigation")
    if "make('最新版ゲーム'" in text or "最新版のゲームページを開く" in text:
        raise RuntimeError("Obsolete floating latest-game launcher must not overlap Data Exchange UI")

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

def import_dry_run():
    core = (DX / "data-exchange-core.js").read_text(encoding="utf-8")
    ui = (DX / "data-exchange-ui.js").read_text(encoding="utf-8")
    index = (STUDIO / "index.html").read_text(encoding="utf-8")
    required_core = ["dryRunImport", "readonly_modified", "broken_reference", "stale_source", "verifyPackageHash"]
    missing = [x for x in required_core if x not in core]
    if missing:
        raise RuntimeError("DE-8 core markers missing: " + ", ".join(missing))
    if "Dry Runを実行" not in index or "renderDryRun" not in ui:
        raise RuntimeError("DE-8 Dry Run UI missing")
    if "dryRunImport" not in core:
        raise RuntimeError("DE-8 Dry Run core missing")

def integrity_validator():
    validator = DX / "data-exchange-integrity-validator.js"
    if not validator.exists():
        raise RuntimeError("DataExchangeIntegrityValidator missing")
    text = validator.read_text(encoding="utf-8")
    required = ["unknown_dataset", "readonly_modified", "broken_reference", "unsupported_delete", "schema_version", "record_count"]
    missing = [x for x in required if x not in text]
    if missing:
        raise RuntimeError("DE-9 validator markers missing: " + ", ".join(missing))
    index = (STUDIO / "index.html").read_text(encoding="utf-8")
    if "data-exchange-integrity-validator.js" not in index:
        raise RuntimeError("DE-9 validator Studio reference missing")

def safe_merge_apply():
    core = (DX / "data-exchange-core.js").read_text(encoding="utf-8")
    ui = (DX / "data-exchange-ui.js").read_text(encoding="utf-8")
    index = (STUDIO / "index.html").read_text(encoding="utf-8")
    required_core = ["createApplyPlan", "applySafeMerge", "applyBlockReasons", "setDatasetRecords"]
    missing = [x for x in required_core if x not in core]
    if missing:
        raise RuntimeError("DE-10 core markers missing: " + ", ".join(missing))
    required_ui = ["showApplyPlan", "applySafeMerge", "before-data-exchange-safe-apply", "createBackup"]
    missing_ui = [x for x in required_ui if x not in ui]
    if missing_ui:
        raise RuntimeError("DE-10 Safe Apply UI markers missing: " + ", ".join(missing_ui))
    if 'id="dxApplyPanel"' not in index or "Data Exchange Import / Safe Merge" not in index:
        raise RuntimeError("DE-10 Apply panel missing")
    if "既存IDは上書きしません" not in ui:
        raise RuntimeError("DE-10 must preserve add-only safe merge rule")

def stale_source_detection():
    core = (DX / "data-exchange-core.js").read_text(encoding="utf-8")
    required = ["recordHash", "record_hashes", "base_project_revision", "base_hash", "stale_source", "source_revision"]
    missing = [x for x in required if x not in core]
    if missing:
        raise RuntimeError("DE-11 stale-source markers missing: " + ", ".join(missing))
    test = (HERE / "data-exchange-core.test.js").read_text(encoding="utf-8")
    required_tests = ["normal GPT edit must not be stale", "legacy base_hash fallback", "source_revision.changed"]
    missing_tests = [x for x in required_tests if x not in test]
    if missing_tests:
        raise RuntimeError("DE-11 stale-source regression tests missing: " + ", ".join(missing_tests))

def impact_preview():
    core = (DX / "data-exchange-core.js").read_text(encoding="utf-8")
    ui = (DX / "data-exchange-ui.js").read_text(encoding="utf-8")
    index = (STUDIO / "index.html").read_text(encoding="utf-8")
    required_core = ["buildImpactPreview", "recordFieldDiff", "reference_additions", "existing_references", "reference_differences"]
    missing = [x for x in required_core if x not in core]
    if missing:
        raise RuntimeError("DE-13 core markers missing: " + ", ".join(missing))
    required_ui = ["renderImpactPreview", "直接変更", "参照追加", "既存参照", "影響なし"]
    missing_ui = [x for x in required_ui if x not in ui]
    if missing_ui:
        raise RuntimeError("DE-13 UI markers missing: " + ", ".join(missing_ui))
    if 'id="dxImpactPreview"' not in index or "影響範囲Preview" not in index:
        raise RuntimeError("DE-13 Preview panel missing")

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
        "import_dry_run": import_dry_run,
        "integrity_validator": integrity_validator,
        "safe_merge_apply": safe_merge_apply,
        "stale_source_detection": stale_source_detection,
        "impact_preview": impact_preview,
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
