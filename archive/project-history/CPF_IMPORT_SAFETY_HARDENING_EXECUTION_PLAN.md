# CPF-002A Import Safety Hardening 実行計画

文書ID: CPF-002A-EXEC-001  
状態: LOCALLY_IMPLEMENTED / REMOTE_CI_UNCONFIRMED  
前提: CPF-002 Implementation Increment 1 / Build 325

## 1. 目的

Story Importerを、既存ストーリーの反復取込、部分修正、Preview Rebuild、将来のスマホAPI利用に耐えられる安全な基盤へ強化する。

## 2. 実装順序

### Step A — 入力契約
- Story Import JSON Schema作成
- 必須・任意フィールド、型、最大件数、章番号1〜20を定義
- 正規化前に全入力を検証し、エラー時は書込みゼロを保証

### Step B — IDと正本整理
- `node_id` と `display_name` を分離
- 日本語文字列から内部IDを直接生成しない
- ChapterはMilestone ID参照のみ保持し、詳細正本をMilestone Nodeへ統一

### Step C — Transaction / Lock
- Project単位Import Lockを取得
- staging領域にStory、Chapter、Milestone、Dependency、Snapshotを生成
- staging全体を検証後に一括Commit
- Commit失敗時はバックアップからRollback
- stale lock検出と安全な解除を提供

### Step D — 子Node同期
- 現行子Nodeと入力子NodeをIDで差分比較
- 入力から消えた未承認NodeはARCHIVED化
- 承認済み・LOCKED Nodeは自動削除せず競合として報告
- 古いDependencyを除去し、新構成を一括登録

### Step E — Snapshot世代管理
- import_id、timestamp、source_hash、normalized_hashを付与
- `imports/<story-id>/<revision>.json` と `latest.json` を保存
- 同一hashの再取込は冪等処理とする

### Step F — 試験
- 章数・Milestone数が減る再取込
- 途中失敗Rollback
- 不正型・上限超過・日本語表示名
- 承認済み／LOCKED子Node競合
- Dependency破損・孤立除去
- 二重Import・Lock競合
- 同一入力再実行の冪等性
- PHP 8.1〜8.4 CI、Runtime/GVF/E2E回帰

## 3. 完了条件

- Import失敗時に正式Node、Dependency、Snapshotが一切部分更新されない
- 削除相当の子Nodeが黙って残存しない
- Milestone詳細の正本が一箇所に統一される
- 承認済み・LOCKEDデータが自動変更されない
- 同一入力の再実行で重複Node・Dependencyが増えない
- 全追加試験と既存回帰試験が合格する

## 4. 後続工程

CPF-002Aのローカル完了後、DEC-SGF-0003に従いSSG自動生成へは進まず、SSF-001 Design Form → Prompt Builder → Paste Intake → Preview Rebuild → Candidate Revisionへ進む。
