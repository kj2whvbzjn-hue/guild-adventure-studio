# 緊急監査報告 — 仕様変更履歴保存

監査日: 2026-07-24  
対象: GK Studio v1.23.0-dev / Formal Build 328 / Build 329 Integration Gate  
判定: 不具合確認・緊急修正済み・正式Build昇格なし

## 1. 発端

作業後のファイル返却が行われなかったため、運用違反として緊急調査を実施した。併せて、仕様変更時の履歴保存が監査証跡として機能しているかを、規約、実装、試験の三方向から確認した。

## 2. 規約確認

- `DECISION_TRACKER_POLICY.md` は、後日変更時に旧決定を削除せず改定履歴を追加することを要求している。
- `CPF_TEST_PLAN.md` は、CPF-001の必須試験として履歴保存を要求している。
- `CPF_STORY_PREVIEW_REBUILD_SPECIFICATION.md` は、差分、変更理由、影響範囲の確認を要求している。
- `CPF_DATA_SPECIFICATION.md` は、Nodeに `change_reason`、Historyに変更操作と変更項目を定義している。

## 3. 発見した不具合

### HIST-EMG-001: Node更新履歴に変更理由が保存されない

`CpfNodeManager::update()` はNode本体へ `change_reason` を保存していたが、`history/history.json` の履歴レコードには理由を渡していなかった。このため、後続更新でNode本体の理由が上書きされると、過去変更の理由を履歴だけから復元できなかった。

### HIST-EMG-002: Candidate Revision昇格履歴にRevision識別情報と理由がない

`PROMOTE_REVISION` は履歴化されていたが、対象 `revision_id` とCandidateの `change_reason` が履歴レコードに保存されていなかった。

### HIST-EMG-003: Candidate Revision作成・却下が共通Historyに記録されない

Revision JSON自体は保存されるが、共通の `history/history.json` には作成・却下イベントが残らなかった。監査時にNode履歴とRevision履歴を横断しなければならず、共通監査証跡として不完全だった。

### HIST-EMG-004: 履歴保存の専用回帰試験が不足

既存試験はNodeやRevisionの結果状態を検証していたが、`change_reason`、`revision_id`、却下イベントが履歴ファイルへ保存されることを直接検証していなかった。

## 4. 修正内容

- `CpfHistoryRepository::add()` に後方互換の任意引数として `change_reason` と `metadata` を追加。
- CREATE、UPDATE、STATUS、LOCK、UNLOCKの各履歴へ理由を保存。
- Candidate Revision作成時に `CREATE_REVISION` を記録。
- Candidate Revision昇格時に理由、`revision_id`、`approved_by` を記録。
- Candidate Revision却下時に `REJECT_REVISION`、却下理由、`revision_id` を記録。
- 承認・却下のStatus履歴へ理由を保存。
- 履歴理由、Revision昇格、Revision却下を直接検査する回帰試験を追加。

## 5. 互換性

既存History項目は削除・改名していない。追加項目は以下のみ。

- `change_reason`: string
- `metadata`: object

既存呼出しは任意引数の既定値により継続動作する。Formal Build 328の番号、PWA番号、更新メタデータ、正式Manifestは変更していない。本修正はBuild 329 Integration Gate上の緊急修正版であり、正式Build昇格ではない。

## 6. 検証結果

- ZIP CRC: PASS
- PHP構文検査: PASS
- CPF全試験: PASS
- 追加履歴回帰試験: PASS
- Project Audit: PASS
- SHA-256一覧再生成: PASS

## 7. 残存事項

- Decision Trackerの「仕様決定」履歴は静的文書・JSON・CSVで管理され、CPF Node Historyとは別系統である。将来、Studio UI上の仕様決定変更を自動でDecision Trackerへ追記する場合は、新規Decisionと設計承認が必要。
- 本緊急修正の正式Build採用には、通常の承認、CI、端末確認、正式Manifest更新が必要。
- 作業後成果物の返却は、今後の各作業完了条件として必須扱いとする。


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
