#!/usr/bin/env python3
from __future__ import annotations
import sys
sys.dont_write_bytecode = True
import argparse
import json
import re
from pathlib import Path
from system_file_policy import classify, load_policy


def parse_studio_build(value: object) -> int | None:
    m = re.fullmatch(r"GKS-B(\d+)", str(value or ""))
    return int(m.group(1)) if m else None


def valid_sha256(value: object) -> bool:
    return bool(re.fullmatch(r"[0-9a-f]{64}", str(value or "").lower()))


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument('root', nargs='?', default=Path(__file__).resolve().parents[2])
    p.add_argument('--context', choices=('source', 'update'), required=True)
    a = p.parse_args()
    root = Path(a.root).resolve()
    errors: list[str] = []
    try:
        policy = load_policy(root)
    except Exception as e:
        print(f'INSPECTION_CONTEXT_FAIL\nSYSTEM_FILE_POLICY_INVALID {e}')
        return 1

    allowed = set(policy['rules'][f'{a.context}_allowed_classes'])
    for f in root.rglob('*'):
        if not f.is_file() or '.git' in f.parts:
            continue
        rel = f.relative_to(root).as_posix()
        c = classify(rel, policy)
        if c not in allowed:
            errors.append(f'{a.context.upper()}_FORBIDDEN_{c.upper()} {rel}')

    if a.context == 'update':
        for key in ('require_update_metadata', 'require_update_delete_manifest'):
            rel = policy['rules'][key]
            if not (root / rel).is_file():
                errors.append(f'UPDATE_MISSING_REQUIRED {rel}')

    meta_path = root / policy['rules']['require_update_metadata']
    if a.context == 'update' or meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding='utf-8'))
        except Exception as e:
            errors.append(f'STUDIO_UPDATE_INVALID {e}')
            meta = {}
        try:
            build = json.loads((root / 'package-build.json').read_text(encoding='utf-8'))
            expected_game = build.get('game_build')
            expected_studio = build.get('studio_build')
        except Exception as e:
            errors.append(f'PACKAGE_BUILD_INVALID {e}')
            expected_game = None
            expected_studio = None
        if not expected_studio:
            errors.append('STUDIO_VERSION_SOURCE_MISSING package-build.json:studio_build')
        else:
            if meta.get('version') != expected_studio:
                errors.append(f'STUDIO_VERSION_UNEXPECTED {meta.get("version")!r} expected={expected_studio!r}')
            if meta.get('studio_version') not in (None, '', expected_studio):
                errors.append(f'STUDIO_COMPONENT_VERSION_UNEXPECTED {meta.get("studio_version")!r} expected={expected_studio!r}')
        if 'formal' in json.dumps(meta, ensure_ascii=False).lower() and meta.get('formal_build') not in (None, ''):
            errors.append('FORMAL_BUILD_REINTRODUCED')

        if a.context == 'update':
            baseline = meta.get('baseline_source')
            target = meta.get('target_source')
            artifact_id = str(meta.get('artifact_id') or '')
            if not isinstance(baseline, dict):
                errors.append('BASELINE_BINDING_MISSING studio-update.json:baseline_source')
            if not isinstance(target, dict):
                errors.append('TARGET_BINDING_MISSING studio-update.json:target_source')
            if isinstance(target, dict):
                if target.get('game_build') != expected_game:
                    errors.append(f'TARGET_GAME_BUILD_MISMATCH {target.get("game_build")!r} expected={expected_game!r}')
                if target.get('studio_build') != expected_studio:
                    errors.append(f'TARGET_STUDIO_BUILD_MISMATCH {target.get("studio_build")!r} expected={expected_studio!r}')
                if not valid_sha256(target.get('package_manifest_sha256')):
                    errors.append('TARGET_PACKAGE_MANIFEST_SHA256_INVALID')
                if not valid_sha256(target.get('source_tree_sha256')):
                    errors.append('TARGET_SOURCE_TREE_SHA256_INVALID')
            if isinstance(baseline, dict) and isinstance(target, dict):
                bnum = parse_studio_build(baseline.get('studio_build'))
                tnum = parse_studio_build(target.get('studio_build'))
                if bnum is None or tnum is None:
                    errors.append(f'STUDIO_BUILD_TRANSITION_INVALID baseline={baseline.get("studio_build")!r} target={target.get("studio_build")!r}')
                elif tnum <= bnum:
                    errors.append(f'STUDIO_BUILD_TRANSITION_NOT_FORWARD baseline={baseline.get("studio_build")} target={target.get("studio_build")}')
            if not re.fullmatch(r'GKS-B\d+-[0-9a-f]{12}', artifact_id):
                errors.append(f'ARTIFACT_ID_INVALID {artifact_id!r}')
            elif isinstance(target, dict) and valid_sha256(target.get('source_tree_sha256')):
                expected_id = f"{target.get('studio_build')}-{str(target.get('source_tree_sha256'))[:12]}"
                if artifact_id != expected_id:
                    errors.append(f'ARTIFACT_ID_MISMATCH expected={expected_id} actual={artifact_id}')

    try:
        manifest = json.loads((root / 'package_manifest.json').read_text(encoding='utf-8'))
        for item in manifest.get('files', []):
            rel = item.get('path', '')
            if classify(rel, policy) != 'persistent':
                errors.append(f'NONPERSISTENT_FILE_LISTED {rel}')
    except Exception as e:
        errors.append(f'PACKAGE_MANIFEST_INVALID {e}')

    if errors:
        print('INSPECTION_CONTEXT_FAIL')
        print('\n'.join(sorted(set(errors))))
        return 1
    print(f'INSPECTION_CONTEXT_OK context={a.context}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
