#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path

FILES = [
    'assets/shared/config/runtime-config.js',
    'game/index.html', 'game/sw.js', 'studio/index.html', 'studio/sw.js',
    'studio/development-git-store/development-git-store.js',
]
TEST_GLOBS = ['tests/*.js']

GAME_BUILD_RE = re.compile(r'GA-B\d+\.\d+')
STUDIO_BUILD_RE = re.compile(r'GKS-B\d+')
COMBO_QUERY_RE = re.compile(r'([?&]v=)(\d+b\d+)')
COMBO_APPV_RE = re.compile(r'(appv=)(\d+b\d+)')
GAME_HARNESS_QUERY_RE = re.compile(r'(device-game-test-harness\.js\?v=)(\d+)')
GAME_SW_BUILD_TOKEN_RESOURCES = (
    './manifest.webmanifest',
    './icon-192.png',
    './icon-512.png',
    '../assets/shared/config/skill-registry.json',
)
GAME_SW_BUILD_TOKEN_RE = re.compile(
    r'(' + '|'.join(re.escape(resource) for resource in GAME_SW_BUILD_TOKEN_RESOURCES) + r')(\?v=)(\d+)'
)
GAME_CACHE_RE = re.compile(r'ga-game-b\d+-b\d+')
STUDIO_CACHE_RE = re.compile(r'gks-studio-b\d+')
STUDIO_APPV_QUERY_RE = re.compile(r'(appv=)(\d+)(?=["\'&])')
STUDIO_SCRIPT_QUERY_RE = re.compile(r'((?:sw|layer-controller)\.js\?v=)(\d+)')
STUDIO_SEARCH_PARAM_RE = re.compile(r"(searchParams\.set\(['\"]appv['\"],['\"])(\d+)(['\"]\))")
GAME_ASSERT_RE = re.compile(r"(assert\.strictEqual\(build\.game_build,\s*['\"])(GA-B\d+\.\d+)(['\"]\))")
STUDIO_ASSERT_RE = re.compile(r"(assert\.strictEqual\(build\.studio_build,\s*['\"])(GKS-B\d+)(['\"]\))")


def build_values(root: Path) -> dict:
    build = json.loads((root / 'package-build.json').read_text(encoding='utf-8'))
    game = str(build['game_build'])
    studio = str(build['studio_build'])
    gm = re.fullmatch(r'GA-B(\d+)\.(\d+)', game)
    sm = re.fullmatch(r'GKS-B(\d+)', studio)
    if not gm or not sm:
        raise SystemExit('BUILD_FORMAT_INVALID')
    game_token = f'{gm.group(1)}{gm.group(2)}'
    studio_number = sm.group(1)
    combo = f'{game_token}b{studio_number}'
    return {
        'game': game,
        'studio': studio,
        'game_token': game_token,
        'studio_number': studio_number,
        'combo': combo,
        'game_cache': f'ga-game-b{game_token}-b{studio_number}',
        'studio_cache': f'gks-studio-b{studio_number}',
    }


def replace_markers(rel: str, source: str, values: dict) -> str:
    game = values['game']
    studio = values['studio']
    combo = values['combo']
    studio_number = values['studio_number']

    if rel.startswith('tests/'):
        source = GAME_ASSERT_RE.sub(lambda m: m.group(1) + game + m.group(3), source)
        source = STUDIO_ASSERT_RE.sub(lambda m: m.group(1) + studio + m.group(3), source)
        return source

    source = GAME_BUILD_RE.sub(game, source)
    source = STUDIO_BUILD_RE.sub(studio, source)

    if rel.startswith('game/') or rel == 'assets/shared/config/runtime-config.js':
        source = COMBO_QUERY_RE.sub(lambda m: m.group(1) + combo, source)
        source = COMBO_APPV_RE.sub(lambda m: m.group(1) + combo, source)
        source = GAME_HARNESS_QUERY_RE.sub(lambda m: m.group(1) + values['game_token'], source)
        if rel == 'game/sw.js':
            source = GAME_SW_BUILD_TOKEN_RE.sub(
                lambda m: m.group(1) + m.group(2) + values['game_token'], source
            )
        source = GAME_CACHE_RE.sub(values['game_cache'], source)

    if rel.startswith('studio/'):
        source = STUDIO_CACHE_RE.sub(values['studio_cache'], source)
        source = STUDIO_APPV_QUERY_RE.sub(lambda m: m.group(1) + studio_number, source)
        source = STUDIO_SCRIPT_QUERY_RE.sub(lambda m: m.group(1) + studio_number, source)
        source = STUDIO_SEARCH_PARAM_RE.sub(lambda m: m.group(1) + studio_number + m.group(3), source)

    return source


def marker_errors(rel: str, source: str, values: dict) -> list[str]:
    errors = []
    game = values['game']
    studio = values['studio']
    combo = values['combo']
    studio_number = values['studio_number']

    if rel.startswith('tests/'):
        for match in GAME_ASSERT_RE.finditer(source):
            if match.group(2) != game:
                errors.append(f'GAME_BUILD_ASSERTION_MISMATCH {rel} actual={match.group(2)} expected={game}')
        for match in STUDIO_ASSERT_RE.finditer(source):
            if match.group(2) != studio:
                errors.append(f'STUDIO_BUILD_ASSERTION_MISMATCH {rel} actual={match.group(2)} expected={studio}')
        return errors

    for found in set(GAME_BUILD_RE.findall(source)):
        if found != game:
            errors.append(f'GAME_BUILD_TOKEN_MISMATCH {rel} actual={found} expected={game}')
    for found in set(STUDIO_BUILD_RE.findall(source)):
        if found != studio:
            errors.append(f'STUDIO_BUILD_TOKEN_MISMATCH {rel} actual={found} expected={studio}')

    if rel.startswith('game/') or rel == 'assets/shared/config/runtime-config.js':
        for _, found in COMBO_QUERY_RE.findall(source):
            if found != combo:
                errors.append(f'COMBINED_CACHE_TOKEN_MISMATCH {rel} actual={found} expected={combo}')
        for _, found in COMBO_APPV_RE.findall(source):
            if found != combo:
                errors.append(f'COMBINED_APPV_TOKEN_MISMATCH {rel} actual={found} expected={combo}')
        for _, found in GAME_HARNESS_QUERY_RE.findall(source):
            if found != values['game_token']:
                errors.append(f'GAME_HARNESS_CACHE_TOKEN_MISMATCH {rel} actual={found} expected={values["game_token"]}')
        if rel == 'game/sw.js':
            for resource, _, found in GAME_SW_BUILD_TOKEN_RE.findall(source):
                if found != values['game_token']:
                    errors.append(
                        f'GAME_SW_BUILD_TOKEN_MISMATCH {rel} resource={resource} '
                        f'actual={found} expected={values["game_token"]}'
                    )
        for found in set(GAME_CACHE_RE.findall(source)):
            if found != values['game_cache']:
                errors.append(f'GAME_CACHE_NAME_MISMATCH {rel} actual={found} expected={values["game_cache"]}')

    if rel.startswith('studio/'):
        for found in set(STUDIO_CACHE_RE.findall(source)):
            if found != values['studio_cache']:
                errors.append(f'STUDIO_CACHE_NAME_MISMATCH {rel} actual={found} expected={values["studio_cache"]}')
        for _, found in STUDIO_APPV_QUERY_RE.findall(source):
            if found != studio_number:
                errors.append(f'STUDIO_APPV_MISMATCH {rel} actual={found} expected={studio_number}')
        for _, found in STUDIO_SCRIPT_QUERY_RE.findall(source):
            if found != studio_number:
                errors.append(f'STUDIO_SCRIPT_TOKEN_MISMATCH {rel} actual={found} expected={studio_number}')
        for _, found, _ in STUDIO_SEARCH_PARAM_RE.findall(source):
            if found != studio_number:
                errors.append(f'STUDIO_SEARCH_PARAM_MISMATCH {rel} actual={found} expected={studio_number}')

    return errors


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    parser.add_argument('--root', default='.')
    args = parser.parse_args()

    root = Path(args.root).resolve()
    values = build_values(root)
    paths = [root / rel for rel in FILES if (root / rel).is_file()]
    paths += sorted(p for pattern in TEST_GLOBS for p in root.glob(pattern) if p.is_file())

    changed = []
    if args.write:
        for path in paths:
            rel = path.relative_to(root).as_posix()
            original = path.read_text(encoding='utf-8')
            updated = replace_markers(rel, original, values)
            if updated != original:
                path.write_text(updated, encoding='utf-8')
                changed.append(rel)

    errors = []
    for path in paths:
        rel = path.relative_to(root).as_posix()
        source = path.read_text(encoding='utf-8')
        errors.extend(marker_errors(rel, source, values))

    if errors:
        print('\n'.join(errors))
        raise SystemExit(1)

    if args.write:
        print(
            'BUILD_MARKERS_SYNCED '
            f'game={values["game"]} studio={values["studio"]} '
            f'combo={values["combo"]} files={len(changed)}'
        )
    else:
        print(
            'BUILD_MARKERS_OK '
            f'game={values["game"]} studio={values["studio"]} '
            f'combo={values["combo"]} files={len(paths)}'
        )


if __name__ == '__main__':
    main()
