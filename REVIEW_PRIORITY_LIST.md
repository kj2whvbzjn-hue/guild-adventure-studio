# 精査優先度リスト（適用版）

## 完了
- 項目1 Export Fixture
- 項目2 バージョン表示・generated_by
- 項目3 自動E2E
- 項目4 22基本Schema
- 項目5 ID参照整合性 → DEC-0011で実装
- 項目12 公式22パス固定 → DEC-0011で実装
- 項目13 重複ID → DEC-0011で実装
- 項目15 異常系テスト拡充 → DEC-0020で実装
- 項目19 Repository接続 → DEC-0021で実装
- 項目8 シンボリックリンク対策 → DEC-0022で実装

## A判定：完了
- Runtime Reliability A-1〜A-5 完了

## 次に個別精査
完了: 項目22 ロールバック

## B判定：公開前
- 項目11 manifest未登録ファイル検出
- 項目16 PHP 8.1〜8.4 CI
- 項目20 キャッシュ
- 項目21 原子的更新
- 項目22 ロールバック

## C・条件付き
- 項目7 日時形式厳密化
- 項目10 JSON深度
- 項目17 OS差異
- 項目18 iPhone Safari手動試験（通常完了条件外）

## Runtime Reliability progress

- A-1 Export metadata consistency: completed (DEC-0017)
- A-2 File size limits: completed (DEC-0018)
- A-3 Error reporting: completed (DEC-0019)
- A-4 Negative test expansion: completed (DEC-0020)
- A-5 Repository integration: completed (DEC-0021)

- Production Readiness B-1 シンボリックリンク対策: completed (DEC-0022)


## Production Readiness B
- [x] DEC-0023 manifest未登録・欠落ファイル検出
- [x] DEC-0024 PHP 8.1〜8.4 CI
- [x] DEC-0025 Atomic Update
- [x] DEC-0026 Rollback

Production Readiness B: completed

## Game Validation Framework
- [x] GVF-001 データ参照整合性検査
- [ ] GVF-002 ゲームバランス検査
- [ ] GVF-003 シナリオ整合性検査
- [ ] GVF-004 AIシミュレーション検査
- [ ] GVF-005 リリース品質レポート

## Build 329 履歴保存緊急修正版 — 精査反映（2026-07-24）

### 実施済み検査
- [x] 配布ZIPを実際に展開し、全293ファイルを棚卸し
- [x] ZIP CRC検査
- [x] PHP全ファイル構文検査
- [x] CPF全試験
- [x] 履歴保存専用回帰試験
- [x] 10章Controlled Import試験
- [x] Project Audit
- [x] PHP Runtime／GVF試験
- [x] Studio Core → Export → PHP Runtime 自動E2E
- [x] SSF-001〜SSF-005
- [x] Build 329 Export Gate
- [x] JSON構文・再読込検査
- [x] SHA-256一覧照合
- [x] シンボリックリンク不在確認

### 履歴保存修正の確認
- [x] Node更新履歴へ `change_reason` を保存
- [x] Candidate Revision作成時に `CREATE_REVISION` を保存
- [x] Candidate Revision昇格時に `revision_id`、変更理由、`approved_by` を保存
- [x] Candidate Revision却下時に `REJECT_REVISION`、却下理由、`revision_id` を保存
- [x] 承認・却下のStatus履歴へ理由を保存
- [x] 既存History項目を削除・改名せず後方互換を維持

### 残存懸念 — 優先度A（正式Build昇格前に要対応）
- [ ] HIST-RISK-001: Node／Revision本体の保存後にHistory保存だけが失敗した場合、変更は反映されても監査証跡が欠落し得る
- [ ] HIST-RISK-002: Node／Revision／Historyを単一TransactionまたはRollback対象として扱う
- [ ] HIST-RISK-003: History追記処理へProject Lockまたは同等の排他制御を適用する
- [ ] HIST-RISK-004: 履歴IDの「現在件数＋1」採番を、同時実行で競合しない方式へ変更する
- [ ] REV-RISK-001: Candidate Revision IDの「現在件数＋1」採番を、同時作成で競合しない方式へ変更する
- [ ] TEST-RISK-001: History書込み失敗を注入し、本体更新のRollbackまたは整合性維持を検証する
- [ ] TEST-RISK-002: 同時History追加試験を実施し、重複ID・上書き・履歴消失がないことを検証する
- [ ] TEST-RISK-003: 同時Candidate Revision作成試験を実施し、Revision ID競合がないことを検証する

### 配布物衛生 — 優先度B
- [ ] PKG-RISK-001: 0バイト一時ファイル `php-runtime/tests/run.php.tmp` を正式配布物から除外する
- [ ] PKG-RISK-002: 一時ファイル除外後にSHA-256一覧を再生成し、クリーン再展開で完全性を再確認する

### 未確認・外部確認事項
- [ ] Remote PHP 8.1〜8.4 CIの実実行結果確認
- [ ] iPhone Safari物理端末確認（通常完了条件外。ただし正式公開前確認候補）
- [ ] 正式Build昇格承認
- [ ] 正式Manifest、VERSION、PWAキャッシュ、更新メタデータの昇格時同期

### 現時点判定
- 緊急修正対象 `HIST-EMG-001〜004` は回帰試験を含めて修正確認済み。
- 通常単一操作での履歴保存はPASS。
- 障害時原子性と同時実行安全性は未保証のため、正式Build昇格判定は「条件付き合格」とする。
- 本精査リストの未完了項目を削除せず、対応時はDecision、実装、試験、監査証跡を追加して完了化する。


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
