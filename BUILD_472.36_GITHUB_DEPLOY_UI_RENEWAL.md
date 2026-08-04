# Build 472.36 GitHub配置UI改修

- 通常操作を「接続先」「更新ZIP」「GitHubへ配置」の3ブロックへ整理。
- Owner・Repository・Branchを端末localStorageへ自動保存。
- Tokenは保存せず、現在タブのメモリ内のみで利用。
- 差分一覧、保護設定、テスト実行、ログ、Pages確認、監査ZIP、ロールバックを「詳細・保守機能」へ移動。
- GitHub API・ZipCore Reader・Commit・履歴・ロールバック処理は変更なし。
