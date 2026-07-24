# DEC-0022 適用記録 — Exportシンボリックリンク対策

## 適用範囲
- Exportディレクトリ本体
- manifest.json
- manifest登録パスの全中間ディレクトリ
- 各Export JSON

## 実装方針
シンボリックリンクはリンク先がExport内であっても全面禁止する。通常ファイルはrealpath解決後にExportルート配下であることも確認する。

## エラーコード
- SYMLINK_FORBIDDEN
- PATH_OUTSIDE_EXPORT

## 自動試験
- manifestリンク拒否
- JSONファイルリンク拒否
- ディレクトリリンク拒否
- 既存E2E回帰
