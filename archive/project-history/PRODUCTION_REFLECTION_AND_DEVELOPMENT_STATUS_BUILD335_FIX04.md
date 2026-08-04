# Build 335 Demo Foundation Fix04 — 本番反映希望／開発継続ステータス

## 1. 本番環境へ反映希望

以下は既存の安全設計を維持しながら、デモ版制作基盤の障害・データ不整合リスクを解消する変更です。人間による差分確認、正式Build情報の整合、承認済みデプロイ手順を経たうえで本番反映を希望します。

### Fix01
- `Export/` からManifest未登録のCPF開発ファイルを除外
- PHP RuntimeのManifest外ファイル拒否を正常化
- 一時ファイル `php-runtime/tests/run.php.tmp` を除外

### Fix02
- Node作成・更新・Status・Lock・UnlockとHistory保存を原子処理化
- プロジェクト単位の排他ロック追加
- History IDを最大連番基準に変更

### Fix03
- Candidate Revision作成・昇格・却下をNode／Revision／Historyの原子処理へ統合
- Revision IDを最大連番基準に変更
- 途中失敗時のRollbackを追加

### Fix04
- デモ版の最小承認経路を判定するReadiness Gateを追加
- 必須経路: `story -> plot -> chapter -> section -> event`
- APPROVED／LOCKED Nodeと承認済みNode間の依存関係を検査
- 不足項目をBlocking Issueと次アクションとして報告
- 読取り専用であり、Nodeや承認状態を自動変更しない

## 2. 本番反映前の必須条件

- 人間による差分確認と配置実行承認
- `VERSION.txt` Build 335 と `CPF_FORMAL_RELEASE_MANIFEST.json` Build 328 の不一致解消
- Remote CIでのPHP対応バージョン確認
- 実ブラウザ・実端末でのGK Studio動作確認
- GitHub Pages反映確認
- Tokenを含まない監査成果物の保存

現時点では、上記承認・外部環境確認が未完了のため、本番環境への実配置は行っていません。

## 3. 開発継続

以下はデモ版完成まで継続します。

1. Readiness GateをGK Studio UIから実行・表示できるようにする
2. 不足するPlot／Section／Eventの候補生成フローを追加する
3. 候補生成はRevisionとして保存し、人間承認後のみ正式Nodeへ昇格する
4. APPROVED経路からRuntime Exportへ変換する統合処理を構築する
5. デモ用の最小Storyデータを投入し、最初から最後までのE2Eを成立させる
6. 実ブラウザ・実GitHub環境での確認を実施する

## 4. Fix04の実行方法

```bash
php cpf/bin/cpf.php demo:readiness <CPF_PROJECT_DIR>
```

または:

```bash
php cpf/bin/cpf-demo-readiness.php <CPF_PROJECT_DIR>
```

終了コード:

- `0`: デモ基盤の最小承認経路が成立
- `2`: Blocking Issueあり

## 5. 検証結果

- PHP構文検査: PASS
- JavaScript構文検査: PASS
- Project Mutation直接テスト: PASS
- Revision Mutation直接テスト: PASS
- Demo Readiness直接テスト: PASS
- Studio Core -> Export -> PHP Runtime E2E: PASS
- ZIP CRC検査: 成果物作成時に実施
