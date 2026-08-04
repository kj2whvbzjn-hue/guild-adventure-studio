# BUILD425 Internal Structure Organization

## 目的
ゲームとStudioを内部で分類しながら、スマホ運用、ZIP一個での受け渡し、GitHub Pagesの既存URLを維持する。

## 実施
- `apps/game/` と `apps/studio/` に明確な入口を追加。
- `shared/` を共通処理の移行先として定義。
- `data/` に正式データ元の方針を明記。
- `docs/architecture/PROJECT_STRUCTURE.md` に構造と移行規則を記録。
- 既存の `/index.html` と `/studio/` は変更せず、後方互換を維持。

## 非実施
- 実装本体の大規模移動。
- localStorageキーの変更。
- データ形式の変更。
- 過去の監査・リリース文書の移動。

これらは一度に行うと参照切れやGitHub Pages上の不具合を招くため、後続BUILDで段階的に実施する。
