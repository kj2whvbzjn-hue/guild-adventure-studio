# Guild Adventure Story System Roadmap
## 現行正式仕様 — 2026-08-16

この文書は現行の正式Story / Questモデルを定義する。旧Section Runtime、旧Story Link、旧Event固定編成モデルは正式仕様ではない。

---

# 0. 最終アーキテクチャ

- **Chapter / Section / Scene / Dialogue**: 物語構造を保持する。
- **Quest**: 冒険の実行単位。時間、難易度、Context、開始条件、進行、Quest Box、関連キャラクターを所有する。
- **Quest Box**: Quest内の進行順とScene参照、Fixed / Random Event Placementを所有する。
- **Event**: 独立再利用データ。用途・種別・Reward・Flag等を持ち、Story上の配置場所は所有しない。
- **Story Battle Override**: 固定Battle Eventを配置したQuest Box側で、Resolver / required_monsters / fixed_formationを指定する。
- **QuestRun**: Quest開始時に確定した冒険結果のSnapshot。PlaybackはQuestRunだけを読む。

Quest開始
→ 開始コスト消費
→ Quest Box順にAdventure Simulation
→ QuestRun完全確定
→ Adventure Playback
→ 帰還時に確定済み結果を利用可能化

Playback中は再抽選・再戦闘・再判定しない。

---

# 1. 正式データ責務

## Chapter

物語の章を表す。Sectionを束ねる。

Adventure Runtime用のMonster候補やRandom Event候補はChapterに持たせない。Monster選定はResolver、Random Event候補はQuest Box Placementのfilterで決定する。

## Section

物語構造としてSceneを束ねる。

Adventure Runtimeの時間、Enemy Budget、Boxは所有しない。これらはQuest側の責務である。

## Scene / Dialogue

Sceneは物語表示用データ。Dialogueを保持する。Quest BoxはScene IDを参照し、QuestRun生成時に必要な表示情報をSnapshotする。

## Quest

正式な冒険実行単位。

主な正式フィールド:
- `adventure_duration_seconds`
- `base_enemy_budget` / `enemy_budget`
- `context`
- `start_cost`
- `prerequisite_ids`
- `next_quest_ids`
- `required_flags`
- `set_flags`
- `character_ids`
- `boxes[]`

`character_ids`はQuest直下が唯一の正式な関連キャラクター参照である。

## Event

Questから独立した再利用可能Event。

主な正式フィールド:
- `usage`: `story` / `random` / `common`
- `type`: `battle` / `exploration` / `choice` / `special`
- `group`
- `tags`
- `conditions`
- `intensity`
- `generation_profile_ref`
- `random_base_weight`
- `reward_table_id` / `reward_table_ids`
- `required_flags` / `set_flags`
- `enabled`

EventはChapter / Section / Scene / Questへの配置リンクを所有しない。Story上の位置はQuest BoxのEvent Placementが決める。

---

# 2. Quest Box仕様

Questは`boxes[]`を持つ。各Boxには安定した`box_id`と`order`を持たせる。

各Boxの進行順は次の7段階で固定する。

1. `event_zone_before_pre`
2. `pre_scene_id`
3. `event_zone_pre_to_mid`
4. `mid_scene_id`
5. `event_zone_mid_to_post`
6. `post_scene_id`
7. `event_zone_after_post`

4つのEvent Zoneは複数Placementを保持できる。

Placement:
- `fixed_event`: `event_id`でEventを参照する。
- `random_event`: `filter`で候補を絞り、開始時に確定する。
- `failure_policy`: Event失敗時のQuest挙動を定める。

Random Event filterはEventの`usage/type/group/tags`等を用いる。Chapter側に候補一覧を持たない。

---

# 3. Battle / Exploration Resolver

Battle / ExplorationはQuest Context、Quest難易度、Map、Monster / Exploration Master、Adventure Settingsを入力としてResolverで確定する。

Enemy BudgetはQuestが所有する。石板等による補正はQuest開始時にSnapshotする。

固定Battle Eventで編成を指定したい場合はEvent本体ではなく、Quest BoxのFixed Event PlacementにあるStory Battle Overrideを使用する。

Override mode:
- `resolver`
- `required_monsters`
- `fixed_formation`

Monster MasterのステータスをEventやQuestへ複製しない。

---

# 4. Quest開始処理

Quest開始時に結果を完全確定する。

1. Quest取得
2. 開始条件 / Flag確認
3. 石板等の開始コスト消費
4. Party / Difficulty / Settings Snapshot
5. Seed生成
6. Quest Boxを`order`順に処理
7. Fixed / Random Event決定
8. Scene Snapshot
9. Battle / Exploration Resolver実行
10. Reward確定
11. Flag / Quest進行結果確定
12. `at_seconds`確定
13. 成功 / 失敗確定
14. QuestRun保存
15. Playback開始

切断・再読込後も結果は変えない。

---

# 5. QuestRun / Playback

QuestRunは1回の冒険の完全な確定記録。

最低限保持する情報:
- `quest_run_id`
- `quest_id`
- Story Snapshot参照
- Party Snapshot
- Seed
- `playback_started_at`
- `adventure_duration_seconds`
- `timeline_result[]`
- `battle_results[]`
- `exploration_results[]`
- `event_results[]`
- `scene_snapshots[]`
- Reward結果
- Flag / Quest進行結果
- final result

PlaybackはQuestRunのみを読み、Battle再計算、Event再抽選、Random Event再抽選、Scene条件再判定、Reward再計算、Flag再判定を行わない。

---

# 6. Studio正式Authoring

## Story Editor

Chapter / Section / Scene / Dialogueの物語構造だけを編集する。Adventure Runtime固有の入力欄は置かない。

## Quest Editor

- Adventure Duration
- Enemy Budget
- Map / Environment Context
- Start Cost
- Quest prerequisite / next Quest / Flag
- 直下`character_ids`
- Quest Box
- Fixed / Random Event Placement
- Story Battle Override

を編集する。

## Event Editor

Eventの独立データだけを編集する。Story Link UIや自動Timeline / Character履歴同期は持たない。

---

# 7. Import / Export / Validation

正式Authoring / Entity Import / Data Exchange / Export / Validationは正式モデルだけを受け付ける。

- Chapter / SectionのAdventure RuntimeフィールドはAuthoring契約外。
- Questの関連キャラクターは直下`character_ids`を使用する。
- EventはStory配置リンクを持たない。
- Event固定編成はEvent本体に持たない。
- Game Data Reference AuditはQuest BoxのScene / Event参照、Questの直下Character参照、Quest / EventのFlag等を検査する。

Split 2時点では既存Project JSONをロードしただけで破壊的に書き換えない。正式Exportでは旧フィールドを出力せず、実Project JSONのフィールド移行はSplit 3で明示的に実施する。

---

# 8. 撤去対象となった旧モデル

以下は正式仕様ではない。

- Chapter側の旧Adventure候補フィールド / UI
- Section側の旧Adventure Duration / Enemy Budget / Box / Box Editor
- Questの旧Story Link容器
- Eventの旧Story Link容器
- Event本体の旧固定Battle編成
- 旧Story LinkからTimeline / Character履歴を自動同期する処理
- Chapter / Section LinkをRuntime readinessとして評価するLegacy assessment
- Questを旧Section IDでグループ化するValidationルール

既存Project JSONからこれらの物理データを除去する作業は、Source更新とは分離してSplit 3で行う。

---

# 9. 保護対象

撤去作業で維持するもの:
- Chapter / Section / Scene / Dialogue本文
- Quest / Quest Box / Event
- QuestRun / Playback
- Battle Core / Battle Result / Battle Playback / 戦闘ログ
- Monster / Map / Reward / Flag / Masterデータ
- AI制作・AI Runtime関連機能
- standalone Battle検証経路

---

# 10. 実装分割

## Split 1 — 完了

- standalone Battleを正式Saveから分離
- Legacy Quest / Event Runtime fallbackを切離し
- QuestRun正式経路を維持

## Split 2 — Source更新

- Studio / Schema / Export / Import / Validationを正式モデルへ統一
- 旧テストを正式回帰へ置換
- Project JSON実体のフィールド移行は行わない

Gate:
- Quick
- Full `--context update`
- Studio Quest / Event保存・再読込
- `Quest.character_ids` round trip
- Full Project JSON Pre-flight compatibility

## Split 3 — Game Data更新

現在使用中のFull Project JSONを対象に、事前差分確認後、旧フィールドを正式モデルへ移行する。Chapter / Section / Scene / Dialogue本文は保持する。

## Split 4 — 撤去後回帰

- Random Battle + Reward + 帰還
- `quest_fail`
- Stone + Exploration + reload Snapshot
- Story Battle Override + `required_monsters`
- QuestRun履歴
- standalone Battle
- Battle Result / Playback
- AI編集画面

---

# 11. 実装原則

1. Quest開始時に結果を完全確定する。
2. Playbackで再抽選しない。
3. Playbackで再戦闘しない。
4. Quest BoxがStory / Event配置の正式な実行構造である。
5. Eventは独立再利用データとして維持する。
6. Battle / Explorationの数値ロジックはResolver / Master / Settingsへ集約する。
7. Source変更とProject JSON移行を同時に行わない。
8. 物理ファイル削除は、完全一致パスの事前報告と個別承認がある場合のみ行う。
