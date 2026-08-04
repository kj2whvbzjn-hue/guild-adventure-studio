# Build 472.25 — Battle Package Reader

## Scope
- AI作成Battle Package ZIPの読込入口
- manifest / execution_plan検証
- execution_plan参照リソースだけを遅延読込
- 初期対応job_type: battle-test
- 未使用リソースはエラーにしない
- 既存プロジェクト・検証ストアへ自動登録しない
- ジョブ数・総試行数・診断表示

## Not included
- 一括実行
- 結果ZIP
- Benchmark job
