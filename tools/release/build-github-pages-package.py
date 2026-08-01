#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, sys, zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / 'shared/release/github-pages-package.json'


def load_manifest() -> dict:
    data = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if data.get('schema_version') != 1:
        raise ValueError('unsupported schema_version')
    return data


def safe_rel(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    p = PurePosixPath(rel)
    if p.is_absolute() or '..' in p.parts:
        raise ValueError(f'unsafe path: {rel}')
    return rel


def collect(data: dict) -> list[tuple[str, Path]]:
    selected: dict[str, Path] = {}
    excluded = set(data.get('excluded_from_upload_candidate', []))

    for rel in data.get('required_files', []) + data.get('entrypoints', []):
        p = ROOT / rel
        if not p.is_file() or p.stat().st_size == 0:
            raise FileNotFoundError(f'missing required file: {rel}')
        selected[safe_rel(p)] = p

    for rel in data.get('required_roots', []):
        base = ROOT / rel
        if not base.is_dir():
            raise FileNotFoundError(f'missing required root: {rel}')
        for p in base.rglob('*'):
            if p.is_symlink():
                raise ValueError(f'symlink not allowed: {safe_rel(p)}')
            if p.is_file():
                item = safe_rel(p)
                if PurePosixPath(item).parts[0] in excluded:
                    raise ValueError(f'excluded path selected: {item}')
                selected[item] = p

    for rel in selected:
        if PurePosixPath(rel).parts[0] in excluded:
            raise ValueError(f'excluded path selected: {rel}')
    return sorted(selected.items())


def write_zip(items: list[tuple[str, Path]], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix(output.suffix + '.tmp')
    if tmp.exists(): tmp.unlink()
    with zipfile.ZipFile(tmp, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for rel, p in items:
            zf.write(p, rel)
    with zipfile.ZipFile(tmp, 'r') as zf:
        bad = zf.testzip()
        if bad:
            raise RuntimeError(f'generated zip corrupt at {bad}')
    tmp.replace(output)


def main() -> int:
    ap = argparse.ArgumentParser(description='Build a GitHub Pages upload package from the approved manifest.')
    ap.add_argument('--output', type=Path, help='Output ZIP path. Omit for validation only.')
    args = ap.parse_args()
    try:
        data = load_manifest()
        items = collect(data)
        if args.output:
            write_zip(items, args.output)
            print(f'GITHUB_PACKAGE_BUILT files={len(items)} output={args.output}')
        else:
            print(f'GITHUB_PACKAGE_PLAN_OK files={len(items)} build={data.get("package_build")}')
        return 0
    except Exception as exc:
        print(f'GITHUB_PACKAGE_FAIL {exc}')
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
