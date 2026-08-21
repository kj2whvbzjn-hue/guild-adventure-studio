#!/usr/bin/env python3
import argparse, json, re
from pathlib import Path

FILES = [
    'assets/shared/config/runtime-config.js',
    'game/index.html','game/sw.js','studio/index.html','studio/sw.js',
    'studio/development-git-store/development-git-store.js',
    'studio/development-source-package/development-source-package.js',
    'studio/development-source-package/source-fallback-files.json',
]
TEST_GLOBS = ['tests/*.js']

def main():
    ap=argparse.ArgumentParser()
    mode=ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write',action='store_true'); mode.add_argument('--check',action='store_true')
    ap.add_argument('--root',default='.')
    args=ap.parse_args()
    root=Path(args.root).resolve()
    build=json.loads((root/'package-build.json').read_text(encoding='utf-8'))
    game=build['game_build']; studio=build['studio_build']
    gm=re.fullmatch(r'GA-B(\d+)\.(\d+)',game); sm=re.fullmatch(r'GKS-B(\d+)',studio)
    if not gm or not sm: raise SystemExit('BUILD_FORMAT_INVALID')
    gtoken=f"{gm.group(1)}{gm.group(2)}"; snum=sm.group(1); combo=f"{gtoken}b{snum}"
    paths=[root/f for f in FILES if (root/f).is_file()]
    paths += sorted(p for pat in TEST_GLOBS for p in root.glob(pat) if p.is_file())
    changed=[]; errors=[]
    for p in paths:
        s=p.read_text(encoding='utf-8'); orig=s
        rel=p.relative_to(root).as_posix()
        # Current-build assertions/labels only. Historical build IDs in filenames/text are untouched unless they equal the immediately-current assertion form.
        if rel.startswith('tests/'):
            s=re.sub(r"assert\.strictEqual\(build\.studio_build,'GKS-B\d+'\)",f"assert.strictEqual(build.studio_build,'{studio}')",s)
            s=re.sub(r'486211b\d+',combo,s)
        else:
            s=re.sub(r'GKS-B\d+',studio,s)
            # Studio-only cache/appv tokens
            s=re.sub(r'(?<=gks-studio-b)\d+',snum,s)
            s=re.sub(r'(?<=appv=)\d+',lambda m: snum if len(m.group(0))<=3 else m.group(0),s)
            s=re.sub(r"(?<=appv',')\d+",snum,s)
            s=re.sub(r'(?<=sw\.js\?v=)\d+',snum,s)
            s=re.sub(r'(?<=layer-controller\.js\?v=)\d+',snum,s)
            # Combined game/studio cache token
            s=re.sub(r'(?<!\d)486211b\d+',combo,s)
            s=re.sub(r'(ga-game-b486211-b)\d+',lambda m:m.group(1)+snum,s)
        if args.write and s!=orig:
            p.write_text(s,encoding='utf-8'); changed.append(rel)
        if args.check:
            if rel=='assets/shared/config/runtime-config.js' and f'studioBuild: "{studio}"' not in s: errors.append(f'STUDIO_BUILD_TOKEN_MISMATCH {rel}')
            if rel.startswith('tests/') and re.search(r"assert\.strictEqual\(build\.studio_build,'GKS-B\d+'\)",s) and f"build.studio_build,'{studio}'" not in s: errors.append(f'STUDIO_BUILD_ASSERTION_MISMATCH {rel}')
    if args.write:
        print(f'BUILD_MARKERS_SYNCED studio={studio} files={len(changed)}')
    else:
        if errors:
            print('\n'.join(errors)); raise SystemExit(1)
        print(f'BUILD_MARKERS_OK studio={studio} files={len(paths)}')

if __name__=='__main__': main()
