# Build 335 デモ版基盤整備 作業報告

## 目的
GK StudioからExportを生成し、PHP Runtimeで検証・読込できるデモ版基盤の最短経路を正常化する。

## 実施内容
1. `Export/cpf/` を削除した。
   - `Export/` はManifestに登録された正式ゲームデータ22ファイルだけを格納する境界である。
   - CPFのソースは既にリポジトリ直下の `cpf/` に存在し、`Export/cpf/` は重複した開発ファイルだった。
   - Runtimeの「Manifest未登録ファイルを拒否する」安全設計は変更していない。
2. `php-runtime/tests/run.php.tmp` を削除した。
   - 既存の精査資料に記載された配布物衛生課題 `PKG-RISK-001` に対応した。

## 検証結果
- Studio Core → Export → PHP Runtime 自動E2E: PASS
- PHP Runtime / GVF全テスト: PASS
- JavaScript構文検査 (`export-core.js`): PASS
- PHP構文検査 (`php-runtime/`, `cpf/`): PASS
- ZIP CRC検査: PASS

## Project Audit
`tools/audit_project.py` は次の既存不一致によりFAILした。

- `FORMAL_MANIFEST_BUILD_MISMATCH`
- 現行: `VERSION.txt` = Formal Build 335
- `CPF_FORMAL_RELEASE_MANIFEST.json` = Build 328

このファイルは正式リリース記録であり、今回の境界修正だけを根拠にBuild番号を変更すると監査履歴の意味が変わるため、未変更とした。正式昇格時にDecisionと承認を伴って同期する必要がある。

## 変更ファイル
削除:
- `Export/cpf/` 以下一式
- `php-runtime/tests/run.php.tmp`

追加:
- `WORK_REPORT_BUILD335_DEMO_FOUNDATION_FIX.md`

## 結果
GK Studioの正式ExportとCPF開発ソースの境界が回復し、ローカル環境でStudio CoreからPHP Runtimeまでの自動E2Eが完走する状態になった。
