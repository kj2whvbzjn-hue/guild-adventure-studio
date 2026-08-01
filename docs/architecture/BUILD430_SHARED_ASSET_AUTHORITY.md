# BUILD430 Shared Asset Authority

## Purpose

ゲームとStudioが共通利用する実行資産の正式な所在を明示し、重複コピーや誤移動を防止します。

## Current authority

次のファイルは現時点ではリポジトリ直下を正式な編集元とします。

- `export-core.js`
- `jszip.min.js`
- `manifest.webmanifest`
- `sw.js`
- `icon-192.png`
- `icon-512.png`

`studio/index.html`は既存の相対URL互換を保ったまま、これらを利用します。BUILD430では実行ファイルを移動していません。

## Verification

`shared/assets/asset-manifest.json`に役割、利用者、SHA-256を記録し、`tools/integrity/check-shared-assets.py`で欠落・意図しない変更を検出します。

将来`shared/`へ物理移動する場合は、GitHub Pages上の旧URLを維持する互換層と同時に実施します。
