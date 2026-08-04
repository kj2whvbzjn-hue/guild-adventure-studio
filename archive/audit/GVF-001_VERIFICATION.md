# GVF-001 検証書

## 検査対象
- 重複ID
- グループ重複ID
- ID参照切れ
- 孤立データ警告
- 厳格モード拒否
- 既存Runtime回帰

## 実行方法
```bash
php php-runtime/tests/run.php Export
php php-runtime/bin/gvf-validate.php Export
php php-runtime/bin/gvf-validate.php Export --strict-orphans
```
