# Cleanup Phase 2 Report

## 方針

現行ランタイム、現行タスク、テスト、スキーマ、Export、汎用構造資料は保持し、完了済み作業記録と旧Build名付き生成資料を除去した。

## 除去対象

- `project/phase3-*` から `project/phase9-*` までの完了済み作業記録
- `release-output/` の旧配布ZIP
- `docs/architecture/BUILD*` の旧監査・設計記録
- `docs/architecture/INDEX_HTML_ORGANIZATION_GA-B470.md`
- `docs/implementation/` の旧変更履歴・検証記録
- `docs/zipcore/` の旧抽出レポート

## 保持対象

- `project/p01-01-heal/`
- `project/p01-01-console-sprint4-unify/`
- `docs/architecture/COMPONENT_MAP.md`
- `docs/architecture/PROJECT_STRUCTURE.md`
- `docs/architecture/PUBLIC_ENTRYPOINTS.md`
- 実行コード、テスト、fixture、スキーマ、Export、CPF、PHPランタイム

## 再発防止

`tools/integrity/audit-organization.py` の出力をBuild番号付き資料から、`reports/organization-audit.*` へ変更した。
