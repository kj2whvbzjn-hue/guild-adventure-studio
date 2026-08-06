# 検査体制

検査は目的別に3段階へ分ける。

## quick

通常の編集後に実行する。必須入口、JSON、リンク、主要メタデータ、重要ランタイム、削除マニフェスト、パッケージマニフェスト、JavaScript・PHP・Python構文を確認する。

```bash
python3 tools/inspection/run.py quick
```

## full

GitHubへ配置する前に実行する。quickに加え、構成、共有資産、依存関係、実行境界、配置定義、ルート保護、現行テスト8件、GitHub Pages候補を確認する。

```bash
python3 tools/inspection/run.py full --report reports/inspection-full.json
```

## release

公開パッケージを作る直前に実行する。fullに加え、GitHub Pages ZIPを生成してZIP整合性を検査する。

```bash
python3 tools/inspection/run.py release --report reports/inspection-release.json
```

## 判定規則

- 必須検査が1件でも失敗した場合は終了コード1とする。
- Node.jsまたはPHPが導入されていない環境では、その言語の構文検査だけ警告とする。導入済み環境で構文エラーがあれば失敗する。
- 現行のリリース判定テストは`shared/tests/test-registry.json`の`release_gate`だけを実行する。
- レポートは明示的に`--report`を指定した場合だけ生成し、通常検査で作業ツリーを変更しない。
- 削除可否は検査とは分離し、`DELETE_MANIFEST.txt`の完全一致パスだけを許可する。

既存の`tools/integrity/check-project.sh`と`tools/release/run-approved-flow.sh`は互換入口として残し、この統一ランナーを呼び出す。

## 削除の既定動作

通常更新では削除を行わない。`DELETE_MANIFEST.txt`はコメントのみとし、削除件数0を正常状態とする。

削除が1件でもある場合は、今回分だけを記載した`DELETE_MANIFEST.txt`と、完全一致する人間承認`DELETE_APPROVAL.json`が必要になる。保護領域、20件超、一般指示による承認、削除制御変更との同時実行は不合格になる。

詳細:

- `docs/operations/DELETION_POLICY.md`
- `docs/operations/DELETE_WORKFLOW.md`
- `AI_WORK_RULES.md`
