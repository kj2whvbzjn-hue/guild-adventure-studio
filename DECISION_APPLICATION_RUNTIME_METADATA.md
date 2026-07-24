# Runtime Reliability A-1 — Exportメタデータ一致検証

- 状態: 採用・実装済
- 適用日: 2026-07-23
- 対象: PHP Runtime / 自動E2E / 異常系試験

## 決定

manifest.json と各Export JSONの次のメタデータを完全一致させる。

- schema_version
- data_version
- generated_at
- generated_by

SHA-256を再計算した改変データであっても、世代・生成元がmanifestと一致しない場合は起動を停止する。

## エラーコード

- SCHEMA_VERSION_MISMATCH
- DATA_VERSION_MISMATCH
- GENERATED_AT_MISMATCH
- GENERATED_BY_MISMATCH

## バージョン方針

JSON構造は変更しないため schema_version は 1.0.0 を維持する。
