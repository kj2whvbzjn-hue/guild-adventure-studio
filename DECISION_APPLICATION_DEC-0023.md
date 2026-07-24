# DEC-0023 — manifest未登録・欠落ファイル検出

## 状態
- 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23

## 実装方針
1. manifest検証後、Exportディレクトリを再帰走査する。
2. manifestに存在しない実ファイルは `MANIFEST_UNKNOWN_FILE` で起動停止する。
3. manifestに存在するが実体がないファイルは `MANIFEST_MISSING_FILE` で起動停止する。
4. manifest.json自身は管理ファイルとして比較対象から除外する。
5. 走査中にシンボリックリンクを検出した場合はDEC-0022に従い拒否する。

## 検証
- 未登録JSON追加テスト: PASS
- manifest掲載ファイル削除テスト: PASS
- 既存ハッシュ・スキーマ・メタデータ・シンボリックリンク試験: PASS
- 既存Repository統合試験は同梱Exportが空データのため1件FAIL（DEC-0023とは無関係の既知fixture不整合）。
