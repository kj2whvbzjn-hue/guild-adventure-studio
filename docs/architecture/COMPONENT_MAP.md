# Component map — BUILD426

この一覧は、ファイルを物理移動する前の正式な分類表です。現在の公開URLと実装位置は変更していません。

| 分類 | 現在の正式入口・実装 | 将来の配置候補 |
|---|---|---|
| Game | `/index.html`, `/game/` | `/apps/game/` |
| Studio | `/studio/index.html` | `/apps/studio/` |
| Shared bootstrap | `/bootstrap-core.js`, `/bootstrap-ui.js`, `/bootstrap-ui.css` | `/shared/bootstrap/` |
| Export | `/export-core.js` | `/shared/export/` |
| Project data | `/project-data.json`, `/data/`, `/indexes/` | `/data/`を維持 |
| Offline/PWA | `/sw.js`, `/manifest.webmanifest`, icons | `/shared/pwa/`またはルート互換層 |
| Tests | `/tests/`, `/tools/test_*` | `/tests/` |
| Legacy/formal | `/formal-*`, `/legacy-home/` | 現状維持 |

## 移行規則

1. 正式データ元を二重化しない。
2. ファイル移動時は旧パスに互換ローダーを残す。
3. 各BUILDで `tools/integrity/check-project.sh` を実行する。
4. GitHub Pagesの `/index.html` と `/studio/` は最後まで維持する。
