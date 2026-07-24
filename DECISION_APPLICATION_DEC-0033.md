# DEC-0033 適用記録 — ローカル事前検査自動化

- 状態: 決定済・実装済
- 判断: 採用
- Build: 335
- 決定日: 2026-07-24

## 決定
外部GitHub認証を必要としない範囲で、正式ZIP作成前の配布物衛生とBuildメタデータ同期を自動検査する。

## 実装
- `__pycache__`、`.pyc`、`.tmp`、`.DS_Store` の混入をProject Auditで拒否。
- READMEのFormal Build表記と `studio-update.json` のBuild一致を検査。
- Build334に混入していたPython bytecodeを正式配布対象から除外。
- 監査、試験、SHA-256、manifest、ZIP CRC、再展開検査をBuild335で再実施。

## 継続事項
- 実Repository書込みとPages反映の受入試験。
- 100件超・1,000件規模の実Repository性能測定。
- 書込み失敗時の状態判定と安全な再開手順。
