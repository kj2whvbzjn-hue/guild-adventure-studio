# Content Production Framework 基本仕様書

文書ID: CPF-SPEC-001  
状態: APPROVED  
対象製品: GK Studio  
対象ゲーム: ギルド冒険物語

## 1. 基本原則

### 段階生成
上位工程が承認されるまで下位工程を正式生成しない。

### 人間承認
重要設定は自動確定せず、候補生成後に承認する。

### 非破壊更新
再生成結果は候補版として保存し、現行版を即時上書きしない。

### 部分再生成
プロジェクト全体だけでなく、章、マップ、キャラクター、節、イベント単位で再生成できる。

### 設定駆動
章数、節数、イベント数、配置数、必須マイルストーン等を設定ファイルで管理する。

## 2. ステータス

| 状態 | 意味 |
|---|---|
| DRAFT | 生成または編集中 |
| REVIEW | レビュー待ち |
| APPROVED | 内容承認済み |
| LOCKED | 変更禁止 |
| REJECTED | 却下 |
| SUPERSEDED | 新版に置換 |
| ARCHIVED | 保存のみ |

## 3. 承認ゲート

| 生成対象 | 必要な上位承認 |
|---|---|
| 簡易プロット | 物語概要 |
| 章構成 | 簡易プロット |
| マップ | 章構成 |
| ボス | 章構成・主要マップ |
| 章ストーリー | 章構成・マップ・ボス |
| キャラクター | 章構成または章ストーリー |
| 節 | 章ストーリー |
| イベント | 節 |
| Export | 必須ノード承認・GVF合格 |

## 4. 再生成保護

- LOCKEDデータ
- 手動固定項目
- 固定ID
- 承認済み人物設定
- 承認済み章テーマ
- 重要マイルストーン
- 固定加入章
- 固定ボス
- 世界設定

## 5. 依存関係

```text
Story
 └─ Plot
     └─ Chapter
         ├─ Map
         ├─ Boss
         ├─ Character
         └─ Section
             └─ Event
```

## 6. 影響レベル

| レベル | 定義 |
|---|---|
| LOW | 表示・説明のみ |
| MEDIUM | 複数イベントへ影響 |
| HIGH | 章構成や進行条件へ影響 |
| CRITICAL | 進行不能または重大矛盾の可能性 |

## 7. ID規則

| データ | 形式 |
|---|---|
| Story | STORY001 |
| Plot | PLOT001 |
| Chapter | CH001 |
| Map | MAP_CH001_001 |
| Boss | BOSS_CH001_001 |
| Character | CHAR0001 |
| Section | CH001_SEC001 |
| Event | EV_CH001_SEC001_001 |
| Flag | FLAG_CH001_001 |
| Generation | GEN000001 |
| Revision | REV000001 |

既存IDは原則維持し、削除済みIDは再利用しない。

## 8. 生成記録

各生成処理で以下を保存する。

- generator_id
- generator_version
- input_version
- rule_version
- seed
- generated_at
- source_node_ids
- target_node_ids
- change_reason

## 9. GVF連携

| CPF成果 | 検査 |
|---|---|
| Plot・Chapter | GVF-003 |
| Map・Boss | GVF-001、GVF-003 |
| Character | GVF-001、GVF-003 |
| Section | GVF-001、GVF-003 |
| Event | GVF-001、GVF-002、GVF-003 |
| Encounter | GVF-002、GVF-004 |
| Export | GVF-001〜005 |

## 10. Export条件

- 必須ノードがAPPROVEDまたはLOCKED
- 参照切れなし
- Criticalエラーなし
- 必須マイルストーン欠落なし
- 進行不能なし
- Schema適合
- Manifest生成成功
- GVF-005 Release Gate通過

## 11. Story Preview Rebuild

既存ストーリー読込後の再生成は、現行Nodeを直接更新せず候補Revisionとして作成する。現行版と候補版の差分、変更理由、影響範囲、保護項目、警告をプレビューし、全体または部分単位で承認された変更だけを正式版へ昇格する。

部分採用時は依存関係、必須Story Milestone、章数・章順、固定加入章等を再検証する。詳細は `CPF_STORY_PREVIEW_REBUILD_SPECIFICATION.md` を正本とする。
