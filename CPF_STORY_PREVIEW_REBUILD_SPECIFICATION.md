# Story Preview Rebuild 正式仕様書

文書ID: CPF-SPEC-002-PRB  
状態: APPROVED  
適用フェーズ: CPF-002 Plot and Chapter Generator  
決定ID: DEC-CPF-0002

## 1. 目的

既存ストーリーを読み込んだ後、正式データを直接変更せず、改善版プロットを候補Revisionとして生成し、差分・変更理由・影響範囲をプレビューしてから採用できるようにする。

## 2. 基本フロー

```text
既存ストーリー読込
  ↓
構造解析・整合性診断
  ↓
再生成範囲・改善方針・固定項目を指定
  ↓
候補Revision生成
  ↓
現行版／候補版／変更理由／影響範囲を比較表示
  ↓
全体採用・部分採用・却下・条件追加再生成
  ↓
承認された内容だけ正式Nodeへ昇格
```

## 3. 再生成対象

- ストーリー全体
- 単一章または複数章
- 起承転結・章テーマ・章順序
- キャラクター加入・離脱・覚醒時期
- 伏線の配置・回収
- ボス配置・重要アイテム配置
- 章間接続・進行動機
- テンポ・重複展開・情報量
- 設定矛盾・未回収要素

## 4. プレビュー表示

| 項目 | 内容 |
|---|---|
| current | 現行正式版 |
| candidate | 再生成候補版 |
| diff | 追加・削除・変更 |
| rationale | 変更理由 |
| impact | 関連章・人物・節・伏線・フラグ |
| protected | 固定・ロック・手動保護項目 |
| warnings | 矛盾・未回収・進行不能候補 |
| evaluation | 整合性、起伏、テンポ、重複度、伏線回収度 |

## 5. 保護規則

次の情報は明示的に変更許可されない限り維持する。

- LOCKED Node
- `manual_fields`
- 固定ID
- 承認済み人物設定
- 承認済み章テーマ
- 必須Story Milestone
- 固定加入章・覚醒章・救出章
- 固定ボス・世界設定・最終到達点

## 6. 採用方式

- 候補全体を採用
- 指定章のみ採用
- 指定フィールドのみ採用
- 追加伏線など特定変更のみ採用
- 現行版と候補版を手動統合
- 候補を却下
- 条件を追加して再生成

部分採用前には再度影響分析を行い、依存関係破損または必須マイルストーン欠落がある場合は昇格を停止する。

## 7. データ要件

再生成要求は少なくとも以下を保持する。

- source_node_ids
- target_node_ids
- rebuild_scope
- improvement_goals
- protected_fields
- allowed_changes
- generator_id / generator_version
- rule_version
- seed
- candidate_revision_id
- base_revision_id
- change_reason

## 8. CPF-001利用機能

- Candidate Revision分離保存
- stale candidate競合検知
- Manual Override保護
- Lock管理
- JSON Diff
- Dependency / Impact Analysis
- Approval-to-Promote
- History / Versioning

## 9. 受入条件

1. 既存Story／Plot／Chapterを読み込める。
2. 正式Nodeを上書きせず候補Revisionを生成できる。
3. 全体・章・項目単位で再生成範囲を指定できる。
4. 固定項目が候補生成・部分採用で保護される。
5. 現行版と候補版の構造差分を表示できる。
6. 変更理由と影響範囲を確認できる。
7. 全体採用・部分採用・却下・再生成を実行できる。
8. 競合・必須マイルストーン欠落・参照破損時は昇格を停止する。
9. 単一章再生成後も10章全体の整合性検証が通る。
10. 正常系・異常系・回帰試験が合格する。
