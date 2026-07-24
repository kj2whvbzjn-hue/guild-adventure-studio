# DEC-0019 Runtimeエラー記録方式 適用記録

## 採用方針
- 公開レスポンスと管理者診断を分離する。
- 公開側へ内部例外メッセージ・context・絶対パスを出さない。
- `incident_id`で公開エラーと管理者ログを関連付ける。
- 管理者ログは1行1JSONのJSONL形式とする。
- token、secret、password等と絶対directory/rootをマスクする。
- ログ書込み失敗は元のエラー処理を妨げない。

## 実装
- `php-runtime/src/RuntimeErrorReporter.php`
- `php-runtime/examples/game-bootstrap.php`
- `php-runtime/bin/validate-export.php`
- `php-runtime/tests/run.php`

## 計画反映
A-3を完了へ移し、A-4「異常系テスト拡充」を次の個別精査とする。
