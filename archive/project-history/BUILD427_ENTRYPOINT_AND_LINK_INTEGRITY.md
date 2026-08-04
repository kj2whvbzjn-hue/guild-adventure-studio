# BUILD427 — Entrypoint boundary and HTML link integrity

## 変更

- `apps/index.html` を追加し、ゲームとStudioの分類入口を明示。
- `tools/integrity/check-html-links.py` を追加。
- 一括検査からローカルHTML参照の欠落を確認できるようにした。
- `docs/architecture/PUBLIC_ENTRYPOINTS.md` を追加。

## 非変更

- `/index.html` のゲーム本体は移動していない。
- `/studio/` のStudio本体は移動していない。
- localStorage、ゲームデータ形式、GitHub Pagesの既存URLは変更していない。
