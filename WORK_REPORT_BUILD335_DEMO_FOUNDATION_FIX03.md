# GK Studio Build 335 Demo Foundation Fix03 作業報告

## 目的
デモ版制作基盤のCPF安全性を高めるため、Candidate Revisionの作成・昇格・却下を、Node・Revision・Historyを含むプロジェクト単位の原子処理へ統合する。

## 変更内容

### 1. Revision操作の原子化
`cpf/src/Revision/CpfRevisionRepository.php` に `CpfProjectMutation` を導入した。

対象操作:
- Candidate Revision作成
- Candidate Revision承認・Nodeへの昇格
- Candidate Revision却下

処理中に例外が発生した場合、対象となる以下のデータを変更前へ復元する。
- `nodes/`
- `revisions/<node_id>/`
- `history/`

同時に別のCPF変更処理が実行された場合は、既存のプロジェクトMutation Lockにより処理を拒否する。

### 2. Revision ID採番の安全化
採番方式を「Revision件数 + 1」から「既存Revision IDの最大連番 + 1」へ変更した。

これにより、Revision削除や欠番が存在しても過去IDを再利用しない。

### 3. 回帰テスト追加
`cpf/tests/revision-mutation-test.php` を追加した。

確認項目:
- 最大ID基準のRevision採番
- Candidate作成中にHistory処理が失敗した場合のRollback
- 昇格中にHistory処理が失敗した場合のNode・Revision同時Rollback

## テスト結果
以下は合格した。
- CPF PHP構文検査
- PHP Runtime PHP構文検査
- JavaScript構文検査
- Project Mutation直接テスト
- Revision Mutation直接テスト
- Studio Core → Export → PHP Runtime自動E2E
- Manifest・Schema・参照整合性検査
- Atomic Update・Rollback
- GVF-001〜GVF-005
- ZIP CRC検査

詳細は `BUILD335_DEMO_FOUNDATION_FIX03_TEST_RESULTS.txt` を参照。

## 既存の未解決事項
Project Auditは以下の既存不一致によりFAILとなる。

- `VERSION.txt`: Formal Build 335
- `CPF_FORMAL_RELEASE_MANIFEST.json`: Build 328
- Error: `FORMAL_MANIFEST_BUILD_MISMATCH`

正式リリース記録の更新は人間承認が必要なため、Fix03では変更していない。

## 次の推奨作業
- Revision却下処理の失敗注入テスト追加
- 実プロセスを複数起動した排他競合テスト
- CPF Story ImportとRevision昇格を横断するTransaction境界の確認
- デモ用Story → Chapter → Section → Sceneの最小データ生成・検証フロー構築
