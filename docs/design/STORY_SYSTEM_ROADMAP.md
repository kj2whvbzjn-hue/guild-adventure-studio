# Guild Adventure 開発ロードマップ
## 現行確定仕様

---

# 0. 最終アーキテクチャ

Chapter = MAP
Section = Questの冒険内容
Quest = 進行管理
Scene = Quest内の物語
Event = 固定イベント / 固定戦闘
Box = Section内の進行スロット

Quest開始
→ 石板等の開始コスト消費
→ Adventure Simulation
→ QuestRun完全確定
→ Adventure Playback
→ 帰還時に確定済み結果を利用可能化

Playback中は再抽選・再戦闘・再判定しない。

---

# 1. 確定したデータ責務

## Chapter
MAP情報を担当。

追加:
- 使用可能Monster ID一覧
- 使用可能Random Event ID一覧

## Section
Questの実冒険内容を担当。

追加:
- boxes[]
- adventure_duration_seconds

新規Section:
- 初期5箱
- adventure_duration_seconds = 300

既存Section:
- boxes未定義なら []
- adventure_duration_seconds未定義なら300

## Quest
進行管理を担当。

- 解放条件
- 前提Quest
- 次Quest
- Chapter / Section紐付け
- Quest状態管理

Quest一括報酬は正式設計の中心から外す。

## Scene
既存Sceneを使用。
会話のみ。
選択肢なし。

## Event
既存Eventを使用。

Event.type = battle
→ 固定戦闘

EventBattle専用モデルは作らない。
親Scene概念も作らない。

---

# 2. Box仕様

Box type:

- scene
- event
- random_event
- random_battle

Box:
- id
- type
- ref_id

orderフィールドは持たない。

boxes[]の配列順が唯一の進行順。

1箱1要素。

---

# 3. 通常戦闘

random_battle箱ではEnemy Budget方式を使う。

入力:
- 石板 / Quest難易度
- Enemy Budget
- Chapterの使用可能Monster一覧

処理:
→ Budget内で敵編成生成
→ Battle Simulation
→ Battle Result確定
→ QuestRun保存

固定確率テーブルは使わない。

MonsterごとのBudget Cost等の数値はバランス調整案件。

---

# 4. 固定戦闘

Event.type = battleを使用。

Event側に固定敵編成を持つ。

敵はMonster Master参照。

最低限:
- monster_id
- count

敵ステータスをEventへ複製しない。

---

# 5. Random Event

random_event箱では、

Chapterの使用可能Random Event ID一覧
→ Quest開始時に1件決定
→ Event処理
→ 結果をQuestRunへ保存

Playbackでは再抽選しない。

---

# 6. Quest開始処理

Quest開始時に結果を完全確定する。

順序:

1. Quest / Section取得
2. 石板等の開始コスト消費
3. Party Snapshot
4. adventure_duration_seconds Snapshot
5. Seed生成
6. boxesを順番にAdventure Simulation
7. Scene Snapshot
8. Event結果確定
9. random_event確定
10. random_battle敵編成確定
11. Battle Simulation
12. 報酬確定
13. Flag / Quest進行結果確定
14. Timeline at_seconds確定
15. 成功 / 失敗確定
16. QuestRun保存
17. Playback開始

切断しても結果は変わらない。

---

# 7. 失敗処理

Simulation中に失敗が確定した場合:

- その時点で通常boxes処理を停止
- 後続箱を処理しない
- QuestRun終了処理へ移行

QuestRunに:
- 失敗理由
- 失敗地点
- 最終状態
を保存。

将来の失敗専用Sceneは通常boxesとは別系統で追加可能な余地だけ残す。

---

# 8. Scene Snapshot

QuestRun生成時にScene会話内容をSnapshot。

保存:
- scene_id
- 会話再生に必要な最小情報

過去QuestRunは現在のSceneマスタを再参照しない。

StudioでSceneを変更しても過去Runは変わらない。

---

# 9. Battle Result

Battle Resultは以下を分離する。

- 勝敗
- Unit最終状態
- Seed
- 戦闘統計
- 現行デバッグログ
- 将来のゲーム用戦闘ログ
- Playback専用イベント列

現行logs[]はデバッグ用途。

Battle詳細画面は文字ログ解析ではなく、
Playback専用イベント列を使う。

---

# 10. QuestRun

QuestRunは1回の冒険の完全な確定記録。

最低限保持:

- quest_run_id
- chapter_id
- section_id / quest_id
- party_snapshot
- seed
- playback_started_at
- adventure_duration_seconds
- timeline_result[]
- battle_results[]
- event_results[]
- scene_snapshots[]
- reward_results
- flag/progress_results
- final_result

---

# 11. Timeline

Adventure Simulation時に発生時刻まで確定する。

QuestRun:
- adventure_duration_seconds
- timeline_result[].at_seconds

Playback開始時に再配置しない。

過去Runの時刻は将来アルゴリズムが変わっても維持。

---

# 12. Playback時間管理

開始時刻基準。

elapsed =
現在時刻 - playback_started_at

setInterval積み上げ値を正としない。

Scene詳細・Battle詳細を見ている間も進行。

戻った時:
→ 現在時刻までCatch-up表示。

---

# 13. Adventure Playback

PlaybackはQuestRunだけを読む。

禁止:
- Battle再計算
- Event再抽選
- random_event再抽選
- random_battle再生成
- Scene条件再判定
- 報酬再計算
- Flag再判定

---

# 14. Scene詳細

冒険ログ:

「ストーリーイベントが発生した [見る]」

ログでは内容を伏せる。

別画面:
→ 保存済みScene Snapshotの会話を再生

仕様:
- 会話のみ
- 選択肢なし
- 視聴任意
- Quest進行を止めない
- 専用回想画面なし
- 冒険ログから再閲覧

---

# 15. Battle詳細

冒険ログ:
→ 結果要約
→ [結果を見る]

別画面:
→ 保存済みBattle Result / Playback Eventsを再生

再戦闘しない。

詳細画面中もQuestは進行。

---

# 16. 報酬・結果の扱い

報酬はQuest一括報酬ではなく、

- Battle結果
- Event結果
- 固有イベント結果

として発生。

結果自体はQuest開始時に確定・保存する。

ただしPlayback中は未来の報酬を利用可能にしない。

帰還時:
→ 確定済み結果をプレイヤーへ公開 / 利用可能化

帰還時に結果を再計算しない。

---

# 17. Studio実装

## Chapter Editor
追加:
- 使用可能Monster一覧
- 使用可能Random Event一覧

## Section Editor
追加:
- adventure_duration_seconds
- Box Editor

Box Editor:
- 初期5箱（新規Section）
- 箱追加
- 箱削除
- 並び替え
- type選択
- Scene選択
- Event選択

## Event Editor
Event.type = battle時:
- Monster Master参照固定編成
- monster_id
- count

## Monster Master
Enemy Budget Costを持てる構造を追加。

数値はバランス調整。

---

# 18. Export実装

Chapter Export:
- 使用可能Monster ID一覧
- 使用可能Random Event ID一覧

Section Export:
- adventure_duration_seconds
- boxes[]

Event Export:
- battle Event固定編成

Monster Export:
- Enemy Budget Cost

Scene / Event / Monster本体をBoxへコピーしない。

---

# 19. Game Runtime実装順

## Phase A: データ基盤
- Section.boxes
- adventure_duration_seconds
- Chapter encounter候補
- Event battle formation
- Monster budget cost
- normalizeData
- Save / Load

## Phase B: Studio UI
- Chapter候補編集
- Section Box Editor
- 冒険時間編集
- battle Event編成編集

## Phase C: Export
- Chapter / Section / Event / Monsterの新規項目出力
- 参照Validation

## Phase D: Battle Core分離
現行:
selectedQuest().enemies
依存を除去。

変更後:
Party Snapshot + Enemy Formation
→ Battle Core
→ Battle Result

## Phase E: Battle Result拡張
- Resultデータ
- Playback Events
- デバッグログ分離

## Phase F: QuestRun
- Snapshot
- Timeline
- Results
- Playback開始時刻

## Phase G: Adventure Simulation
- Box iterator
- Scene
- Event
- Random Event
- Random Battle
- Battle
- Failure terminate
- Result確定
- Timeline時刻確定

## Phase H: Adventure Playback
- 開始時刻基準
- ログ公開
- Catch-up
- 可変冒険時間

## Phase I: 詳細Viewer
- Scene Viewer
- Battle Result Playback

## Phase J: 帰還・結果公開
- 確定済み報酬利用可能化
- Flag / Progress公開
- Quest完了

---


1. QuestとSectionの責務を正式分離
2. Quest一括報酬中心を廃止
3. Box typeが2種類から4種類へ確定
4. random_battleがEnemy Budget方式へ確定
5. ChapterがMonster / Random Event候補を持つ
6. Event.type=battleの固定編成方式を確定
7. Quest開始時に全結果を確定・保存
8. 切断で石板消費を回避できない構造へ変更
9. 失敗時は後続boxesを打ち切る
10. Scene SnapshotをQuestRunへ保存
11. Battle Playback専用イベント列を追加
12. Timeline時刻をSimulation時に確定
13. Playbackは開始時刻基準
14. 冒険時間はQuestごとに可変、default 300秒
15. 帰還時は結果計算ではなく結果公開


---


# 1. Box / Section

- Box typeは `scene / event / random_event / random_battle`。
- 1 Box = 1要素。
- Boxは安定した `id` を持つ。
- `order` フィールドは持たず、`boxes[]` の配列順を唯一の進行順とする。
- 新規Sectionは初期5 Box。
- 既存Sectionでboxes未定義の場合は `[]`。既存Sectionへ5 Boxを自動生成しない。
- Sectionは `adventure_duration_seconds` を持つ。
- defaultは300秒。
- QuestRun開始時にdurationをSnapshotし、以後Studio側変更の影響を受けない。

---

# 2. Timeline / Playback時間

- `timeline_result[].at_seconds` はAdventure Simulation中に確定してQuestRunへ保存する。
- Playback時に時刻を再計算しない。
- Boxの時間配分は等間隔方式。
- 実際に処理されたBox列に対して、QuestRunの冒険時間を等間隔に配分する。
- Quest失敗で後続Boxが打ち切られた場合、未処理BoxはTimelineへ入れない。
- Playbackの進行時間は `現在時刻 - playback_started_at` を正とする。
- Scene/Battle詳細画面を開いている間もQuestは進行する。
- 戻った際は現在時刻までCatch-upする。
- pause機能は現仕様に含めない。

---

# 3. Random Event

- Chapter/MAPが使用可能Random Event候補を持つ。
- 各候補はWeightを調整可能。
- 初期/default Weightは均等割。
- Adventure Simulation時、まず既存Event条件を満たさない候補を除外する。
- Simulation内部の途中Flag状態もEvent条件判定に使用する。
- 条件を満たす候補からWeight付きランダムで1件選択する。
- 抽選はQuest開始時のSimulationで一度だけ行い、結果をQuestRunへ保存する。
- Playbackで再抽選しない。

---

# 4. Random Battle / Enemy Budget

- `random_battle` はEnemy Budget方式。
- Chapter/MAPは「使用可能Monster一覧」を持つ。
- Monster候補には出現Weightを持たせない。
- Monster MasterはEnemy Budget Costを持つ。
- Random Battle編成生成は以下。
  1. 残Budget以下のCostを持つ使用可能Monsterを候補化。
  2. 候補から1体ランダム選択。
  3. 選択Monster Costを残Budgetから減算。
  4. 追加可能Monsterがなくなるまで繰り返す。
- 固定偏差・固定出現確率テーブルは使用しない。
- 最大出現数等の安全上限が必要になった場合はバランス調整項目として扱う。
- Enemy Budget値、Monster Cost値、石板によるBudget増加量など具体数値はバランス調整案件。

---

# 5. Fixed Battle

- 固定戦闘は既存 `Event.type = battle` を使用する。
- EventBattle専用モデルは作らない。
- 固定編成はMonster Master参照。
- 基本は `monster_id` と `count`。
- EnemyFormation専用Masterは現時点では作らない。
- SceneとBattleの関係はBox順で表現し、親Scene概念は作らない。

---

# 6. Adventure Simulation / Quest Failure

Quest開始時の処理原則:

1. 石板等の開始コストを消費。
2. Party Snapshot取得。
3. 冒険時間Snapshot。
4. 全Boxを順にSimulation。
5. Battle/Event/Random結果、Scene Snapshot、Reward、Flag、Timeline、最終成否を確定。
6. QuestRunを保存。
7. Playback開始。

- 切断・再起動後も同じQuestRunへ復帰する。
- 再抽選・再戦闘・石板消費回避はできない。
- Simulation中にQuest失敗が確定した時点で通常Box処理を停止する。
- 後続Scene/Event/Battleは処理しない。
- QuestRunには失敗理由、失敗地点、最終状態を保持できる構造とする。

---

# 7. Flag確定・帰還反映

- Flag変化はQuest開始時のSimulationで確定する。
- Simulation内部ではworking/intermediate Flag状態を持ち、前のBoxで変更されたFlagを後続Boxの条件判定に使用できる。
- Playback中は正式SaveへFlagを公開・反映しない。
- QuestRunには今回のQuestで変更されたFlag差分のみ保存する。
- Flag全体Snapshotを正式Saveへ上書きしない。
- EventごとのFlag変更履歴を帰還時に再生し直さない。
- 帰還時はQuestRunの確定済みFlag差分だけを正式Saveへ一括反映する。
- 二重反映防止用にQuestRun側で結果反映済み状態を管理できるようにする。

---

# 8. Reward確定・帰還反映

- 報酬の発生源はBattle Result / Event Result / 固有イベント結果。
- 旧Quest一括報酬を正式報酬設計の中心にはしない。
- Simulation中に各Battle/Event報酬を集計し、QuestRunの最終確定済み `reward_result` として保存する。
- Playback中は報酬を通常のプレイヤー資産として利用可能にしない。
- Quest成功時、帰還処理は保存済み `reward_result` を再計算せず正式Saveへ反映する。
- Quest失敗時は、途中で得たBattle/Event報酬を含めて全報酬を失う。
- 失敗Runの正式反映対象 `reward_result` は空または無効状態とする。
- QuestRun履歴には「途中で一時的に得ていたもの」を履歴用途で記録してもよいが、正式資産にはならない。
- 二重反映防止用にQuestRun側で結果反映済み状態を管理できるようにする。

---

# 9. Scene Snapshot

- QuestRun生成時にSceneの会話再生に必要な最小データをSnapshotする。
- `scene_id` も保持する。
- 過去QuestRunのScene詳細は現在のScene Masterを再参照せず、保存済みSnapshotを再生する。
- Scene編集後も過去QuestRunの内容は変化しない。
- Adventure Logでは内容・タイトル・人物・結果を伏せ、汎用表示例「ストーリーイベントが発生した [見る]」とする。
- Scene詳細は別画面。
- 視聴は任意、選択肢なし。
- 専用Story Replay/Archive画面は作らない。
- QuestRun履歴が残っている間はAdventure Logから再閲覧可能。
- NEW/未読表示は作らない。

---

# 10. Battle Result / Playback Events

- 現行Battle `logs[]` はデバッグ用途として扱う。
- 将来の本番ゲーム用戦闘ログは別途拡張する。
- Battle詳細画面は文字列ログを解析して再現しない。
- Battle Resultへ構造化されたPlayback専用イベント列を保存する。
- Battle詳細画面は保存済みBattle Result / Playback Eventsのみを使用し、Battleを再実行しない。
- Battle詳細画面中もQuest Playbackは進行する。

現段階で固定するPlayback Event種別:

- `battle_start`
- `action_start`
- `skill_cast`
- `hit`
- `damage`
- `heal`
- `status_apply`
- `status_remove`
- `ko`
- `battle_end`

- 各Eventの詳細payload SchemaはBattle詳細画面実装時に演出要件から逆算して確定する。
- 現段階ではpayloadを過剰に固定しない。

---

# 11. QuestRun

QuestRunは1回の冒険の完全な確定記録。

Skeletonとして保持する責務:

- `quest_run_id`
- `quest_id`
- `section_id`
- `chapter_id`
- `party_snapshot`
- `seed`
- `playback_started_at`
- `adventure_duration_seconds`
- `timeline_result[]`
- `battle_results[]`
- `event_results[]`
- Scene Snapshot群
- `reward_result`
- `flag_result`
- `final_result`
- 結果反映済み状態

- 正式な細部Field名・payloadは各実装Phaseで必要最小限を確定する。
- QuestRun全体Schemaを今の段階で過剰固定しない。

QuestRun履歴:

- 最新N件のみ保持。
- Nは内部設定値として持つ。
- ユーザー向け設定には出さない。
- 初期値はScene Snapshot / Battle Playback Eventsを含む実Save容量を確認して調整する。
- 上限超過時は古いQuestRunから削除する。
- Story Questも例外扱いしない。
- 削除されたQuestRunのScene/Battle詳細は再閲覧不可。

---

# 12. Legacy / Demo扱い

- 旧Questデモ資産は不要。
- 旧 `Quest.enemies` デモデータは移行しない。
- 旧Quest報酬などデモ由来の不要データも正式仕様へ引き継がない。
- Migration機能は作らない。
- Migration UI / 一時変換ツールも作らない。
- Runtimeは新正式構造へ一本化する。
- 必要なテストデータは新仕様で新規作成する。

正式Runtime:

Quest
→ Section
→ boxes[]
→ Scene / Event / random_event / random_battle
→ Battle Core等の既存Core
→ QuestRun
→ Playback
→ 帰還時Commit

---

# 13. 実装上の重要原則

- Adventure Simulationは新しいBattle/Story/Flagエンジンではなく、既存システムを順に呼び出して結果をQuestRunへまとめるOrchestratorとする。
- Battle Coreは `selectedQuest().enemies` 依存を外し、`Party Snapshot + Enemy Formation -> Battle Core -> Battle Result` に分離する。
- Random BattleとEvent固定Battleは同じBattle Coreを使う。
- `applyBattleOutcome()` のような「個別Battleから即プレイヤーSaveへ報酬反映する処理」はAdventure Simulation向けに責務分離する。
- PlaybackはQuestRunのみを読む。
- Playback中にマスタ参照による再判定・再抽選・再計算を行わない。
- 既存 `data.timeline[]` はStudio/Scenario authoring用であり、QuestRun Playback Timelineへ流用しない。

---

# 14. 現時点で残すもの

以下はコア構造の未確定事項ではなく、実装またはバランス調整時に詰める。

- Enemy Budget具体数値
- Monster Cost具体数値
- 石板ごとのBudget増加量
- Random Event Weight具体値（defaultは均等）
- Random Battle安全上限が必要か、その具体値
- QuestRun履歴上限Nの具体値
- Battle Playback Event各payload詳細
- Battle詳細画面の具体演出
- 最終UIレイアウト

これらは現在確定しているアーキテクチャを変更せず調整可能。

---

# 現在の確定状態
## 2026-08-11

基準:


## 個別精査で解消済み

- Timeline時間配分 → 等間隔
- Random Event選択 → 条件Filter後、Weight抽選。初期Weight均等
- Random Battle Monster Weight → 使用しない
- Random Battle編成 → 残Budget以下からランダム選択を繰り返す
- Flag帰還反映 → QuestRunへ変更差分保存、帰還時一括反映
- 失敗時報酬 → 全損
- 報酬帰還反映 → Simulationで集計済みreward_resultを帰還時Commit
- Battle Playback Event → 現段階ではEvent種別のみ固定
- QuestRun履歴 → 最新N件、Nは内部設定値
- 旧Quest migration → 行わない。旧デモ資産不要

## 実装前提として残る調整

- 具体的なバランス数値
- QuestRun履歴Nの具体値
- Battle Playback payload詳細
- 最終UI / 演出

上記は実装骨格を止める未確定事項ではない。
