# BUILD426 — Integrity gate and component map

## 目的

BUILD425の分類方針を維持したまま、次回以降の整理でファイル欠落や構文破損を早期検出できるようにする。

## 変更

- `tools/integrity/check-project.sh` を追加。
- `docs/architecture/COMPONENT_MAP.md` を追加。
- 実装ファイルの物理移動は行っていない。
- 公開URL、localStorage、データ形式は変更していない。

## 互換性

- `/index.html` 維持。
- `/studio/` 維持。
- GitHub Pagesへのアップロード手順は変更なし。
