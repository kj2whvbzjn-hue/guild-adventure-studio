# Build 335 Demo Foundation Fix05 作業報告

## 実施内容
デモ版の最小経路で不足する Plot / Section / Event を、人間承認前提の Candidate Revision として生成する機能を追加した。

## 安全要件
- 自動承認・自動昇格を行わない。
- 上位Nodeが APPROVED または LOCKED の場合だけ候補生成する。
- 未処理Candidate Revisionが存在する場合は重複生成しない。
- 依存関係は提案として返し、自動登録しない。
- manual_fields保護、Revision原子処理、履歴保存は既存Fix02/03を利用する。

## 追加コマンド
```bash
php cpf/bin/cpf.php demo:generate-candidates <CPF_PROJECT_DIR>
```

## 本番環境へ反映希望
以下は本番反映候補を維持する。
- Fix01 Export/Manifest境界修正
- Fix02 Node/History原子処理・排他制御
- Fix03 Revision/Node/History原子処理
- Fix04 Demo Readiness Gate

## 開発継続
Fix05のCandidate生成機能は、CLIと直接テスト段階では合格しているが、GK Studio UI未統合のため開発継続扱いとする。
次工程:
1. Candidate一覧・差分・承認操作をGK Studio画面へ追加
2. 承認後の依存関係登録を人間操作で実行
3. 承認済み最小経路をRuntime Exportへ変換
4. デモ用実データでブラウザE2Eを実行

## テスト結果
`BUILD335_DEMO_FOUNDATION_FIX05_TEST_RESULTS.txt`を参照。PHP/JavaScript構文、CPF直接テスト、Studio Core→Export→PHP Runtime E2Eは合格。

## 既存保留
VERSION.txt Build 335 と CPF_FORMAL_RELEASE_MANIFEST.json Build 328 の不一致は、人間承認が必要な正式リリース情報のため未変更。
