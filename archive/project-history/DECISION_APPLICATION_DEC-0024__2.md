# DEC-0024 — PHP 8.1〜8.4 CI

- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: GitHub ActionsでPHP 8.1、8.2、8.3、8.4のマトリクス試験を実行する。
- 対象: PHP構文検査、Runtime全自動試験、同梱Exportの検証。
- fail-fast: 無効。特定バージョンが失敗しても全バージョンの結果を取得する。
- 権限: contents: read の最小権限。
- fixture修正: Repository試験は空の正式Exportに依存せず、試験内で一時fixtureを生成する。
