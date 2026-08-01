# Guild Adventure project structure — BUILD425

## 利用者から見える入口

- `/index.html` — ゲーム
- `/studio/` — Studio
- `/apps/game/` — 分類後のゲーム入口（互換転送）
- `/apps/studio/` — 分類後のStudio入口（互換転送）

## 内部分類

- `apps/` — ゲームとStudioの入口
- `shared/` — 将来の共通コード配置先
- `data/` — ゲームデータとデータ方針
- `docs/` — 現行設計資料
- `tests/`, `tools/` — 検証
- `formal-*`, `legacy-home/` — 旧版・互換版
- ルートの多数のBUILD/監査文書 — 開発履歴。安全のため今回は移動しない

## 安全方針

1. GitHub Pagesの既存URLを維持する。
2. 一度に実装ファイルを移動しない。
3. 移動する場合は旧URLに互換ファイルを残す。
4. Studioとゲームの正式データ元を複製しない。
5. 各BUILDでリンク・構文・既存テストを確認する。
