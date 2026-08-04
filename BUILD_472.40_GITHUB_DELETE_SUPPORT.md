# Build 472.40 GitHub DELETE Support

- 公開ZIPでのみDELETE差分を許可
- 初期状態は削除無効
- 明示チェック時だけ `GitHub - ZIP` をDELETE候補化
- 保護ファイル・危険パス・配置先外は削除対象外
- DELETEはGit tree entry `sha: null`で単一Commitへ含める
- 削除時は二段階確認
- Dry RunでDELETE件数を確認可能
- ロールバック履歴へDELETEも記録
