# CPF計画 承認記録

文書ID: CPF-APPROVAL-001  
対象: Content Production Framework  
承認日: 2026-07-24  
状態: APPROVED / 正式採用

## 承認内容

以下の計画・実装方針・基本仕様を正式採用する。

- CPF-001 Story Pipeline Core
- CPF-002 Plot and Chapter Generator
- CPF-003 World and Map Planner
- CPF-004 Character Generator
- CPF-005 Section Generator
- CPF-006 Event Generator
- CPF-007 Production Orchestrator

## 正式方針

- 段階生成方式を採用する
- 各工程に承認ゲートを設ける
- 承認済みデータをロック可能とする
- 非破壊の候補生成と差分承認を採用する
- 部分再生成を必須機能とする
- 依存関係と変更影響分析を必須機能とする
- 生成履歴と生成条件を保存する
- 固定IDを原則維持し、削除IDを再利用しない
- GVF-001〜005と統合する
- Export反映にはAtomic UpdateとRollbackを使用する
- 最初の実装対象をCPF-001とする

## フェーズ移行

旧フェーズ:

- 安全に読み込む
- 安全に検査する

新フェーズ:

- 計画的に生成する
- 人間が承認する
- 部分的に修正する
- 自動検査する
- 安全にExportする

## Build 335 Demo Foundation 正式承認

承認日: 2026-07-26  
承認者区分: Human Authority  
対象Build: GK Studio v1.23.0-dev / Formal Build 335  
状態: APPROVED / 正式採用

### 承認対象

- Fix01 Export / Manifest境界修正
- Fix02 Node / History原子処理および排他制御
- Fix03 Revision / Node / History原子処理
- Fix04 Demo Readiness Gate
- Fix05 Candidate Revision生成

### 承認条件

- 自動承認、自動昇格、自動本番反映を禁止する。
- Repository書込みおよび正式リリース判断は人間のみが行う。
- Candidate Revisionは人間による差分確認と承認を必要とする。
- 本承認はDemo Foundation基盤に限定する。

### 承認対象外・継続課題

- GK Studio画面でのCandidate一覧、差分、承認・却下・昇格操作
- 承認済みCPFデータからRuntime Exportへの変換
- 実ゲームデモの開始から終了までのブラウザE2E
- ゲームデモ版そのもののリリース承認

本承認により、`CPF_FORMAL_RELEASE_MANIFEST.json`の正式Buildを328から335へ更新する。
Build 328は直前のCPF正式基準Buildとして保持する。
