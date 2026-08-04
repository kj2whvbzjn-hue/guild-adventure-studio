# Content Production Framework 実行計画

文書ID: CPF-EXEC-001  
状態: APPROVED  
基準バージョン: GK Studio v1.22.1

## 1. 目的

大まかなストーリーから、簡易プロット、章、マップ、ボス、章ストーリー、キャラクター、節、イベントを段階的に生成し、GVF検査を経てExportへ安全に反映する。

## 2. 全体工程

```text
大まかなストーリー
  ↓
簡易プロット
  ↓
章分類
  ↓
マップ決定
  ↓
ボス配置
  ↓
章ストーリー生成
  ↓
キャラクター生成
  ↓
節生成
  ↓
イベント生成
  ↓
GVF-001〜005
  ↓
Export候補
  ↓
Atomic Update
```

## 3. フェーズ

| ID | 名称 | 成果 |
|---|---|---|
| CPF-001 | Story Pipeline Core | 承認、ロック、履歴、差分、依存関係 |
| CPF-002 | Plot and Chapter Generator | 概要、簡易プロット、章構成 |
| CPF-003 | World and Map Planner | 地域、マップ、接続、ボス |
| CPF-004 | Character Generator | 仲間、敵、協力者、NPC |
| CPF-005 | Section Generator | 章から最大20節への分解 |
| CPF-006 | Event Generator | 会話、戦闘、探索、フラグ、分岐 |
| CPF-007 | Production Orchestrator | 全工程、GVF、Export統合 |

## 4. 実装順序

```text
CPF-001
  ↓
CPF-002
  ↓
CPF-005
  ↓
CPF-006
  ↓
CPF-003
  ↓
CPF-004
  ↓
CPF-007
```

制作データの生成順序とプログラム実装順序は分離する。章・節・イベントの管理構造を先に確立し、既存シナリオを早期に取り込めるようにする。

## 5. フェーズ移行条件

各フェーズは以下を満たした場合に完了とする。

- Decision文書作成
- 設定スキーマ作成
- 実装完了
- CLIまたは同等の実行手段を提供
- 正常系・異常系テスト追加
- PHP 8.1〜8.4互換性確認
- Verification文書作成
- Release Notes更新
- 全既存回帰試験合格

## 6. CPF-002 ブラッシュアップ工程

```text
既存Story取込
  ↓
Structure Analyzer
  ↓
Plot / Chapter候補生成
  ↓
Preview Rebuild
  ↓
差分・変更理由・影響範囲確認
  ↓
全体／部分採用
  ↓
正式Revision昇格
```

Story Preview RebuildはCPF-002の任意拡張ではなく、正式完了条件に含める。

## 7. CPF-002A Import Safety Hardening（必須割込み工程）

```text
Story Importer / Analyzer 基本実装
  ↓
JSON Schema・事前全件検証
  ↓
Project Import Lock
  ↓
Stage → Validate → Atomic Commit / Rollback
  ↓
子Node同期・ARCHIVED化・Dependency再構築
  ↓
Milestone正本統一・Snapshot世代管理
  ↓
異常系／並行／冪等性試験
  ↓
Plot Generator着手許可
```

### 移行禁止条件

以下のいずれかが未完了の場合、Plot Generatorへ進まない。

- 途中失敗で部分更新が発生する
- 再取込で消えた子Nodeが残存する
- Milestone詳細が二重管理される
- 承認済み・LOCKED Nodeが自動変更される
- 同時Importを排他できない
- 同一入力で重複データが増える
