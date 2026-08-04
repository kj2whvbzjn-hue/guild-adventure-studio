# Atomic Update 検証結果 — DEC-0025

検証日: 2026-07-23
対象: GK Studio v1.16.0 / PHP Export Runtime

## 実装確認

- `AtomicExportUpdater`を追加
- 候補Exportの事前検証を実施
- 対象と同じ親ディレクトリへstaging複製
- stagingを再検証後に`rename()`で切替
- 更新単位の排他ロックを追加
- CLI `php-runtime/bin/update-export.php`を追加
- 一時stagingと切替前ディレクトリを正常終了時に削除

## 自動試験

- 正常な候補だけが現行Exportへ反映される: PASS
- 更新後のExportを22ファイルとして再読込できる: PASS
- 不正候補は`HASH_MISMATCH`で拒否される: PASS
- 不正候補拒否後も現行manifestが不変: PASS
- 不正候補拒否後も現行Exportを正常読込できる: PASS
- 一時更新ディレクトリが残らない: PASS

## 全体回帰試験

PHP 8.4.16でRuntime全54判定が合格。PHP全ファイル構文検査および同梱Export検証も合格。
PHP 8.1〜8.4はGitHub Actionsマトリクスで継続検証する。
