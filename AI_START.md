# AI START — AI作業憲章

このプロジェクトで作業するAIは、**他のファイルを調査・編集する前に、この起動シーケンスと作業憲章を完了すること。**

## 1. AIの役割と判断優先順位

判断が競合する場合は、次の順序を優先する。

1. データ保全
2. 現行動作の維持
3. 現行仕様の維持
4. ユーザーの明示指示
5. 新機能・改善

安全に判断できない場合は推測で進めず、削除・仕様変更・範囲外変更を行わず確認を求める。

## 2. 必須読込順

1. `AI_PROJECT_INDEX.json`
2. `AI_PROJECT_STATUS.json`
3. `AI_WORK_RULES.md`
4. `docs/operations/ARTIFACT_SUBMISSION_POLICY.md`
5. `docs/operations/DELETION_POLICY.md`
6. `package-build.json`
7. `package_manifest.json`
8. 必要な実装ファイルだけを読む

## 3. 開始前チェック（Pre-flight）

作業開始前に次を確認する。

- 最新GitHubソース、またはユーザーが明示した基準ソースである
- `package-build.json`を確認した
- `package_manifest.json`の存在と整合状態を確認した
- `AI_PROJECT_STATUS.json`を確認した
- 直近の検査状態を確認した。確認できない場合は必要な検査を実行する
- 今回の作業種別を `SOURCE_UPDATE` / `GAME_DATA_UPDATE` / `HYBRID` のいずれかに確定した
- Gameデータを扱う場合は、現在のStudio Project JSONと対象Data Versionを確認した
- 今回の目的と変更範囲を確定した
- 削除の有無を確定した
- 提出する成果物と配置経路を確定した
- 完了条件を確定した

## 4. 作業宣言

編集前に、少なくとも次を明確にする。内部作業の場合も省略しない。

- 今回の目的
- 作業種別: `SOURCE_UPDATE` / `GAME_DATA_UPDATE` / `HYBRID`
- 基準ソース
- Gameデータを扱う場合の基準Studio Project JSONとData Version
- 変更を許可する範囲
- 変更しない範囲
- 削除の有無
- 提出する成果物
- 配置経路
- 完了と判断する条件

宣言した範囲外の変更が必要になった場合は、理由を示して範囲を再設定する。便乗修正を行わない。

## 5. 正本と作業種別

### `SOURCE_UPDATE`

Game / Studioのプログラム本体、運用文書、検査基盤などのソース変更を行う。

- 現在の実装判断は最新GitHubソースを正本とする。
- Studio更新は`studio-update.json`を含む**直接のStudio更新ZIP**として提出する。
- Studio更新ZIPへ`Export/`を含めない。`Export/`はStudio更新で配置・削除しない。

### `GAME_DATA_UPDATE`

Monster / Map / Quest / Event / Reward Table / Skillなど、Studioが管理しGameへ正式Exportするデータを変更する。

- Studioで編集するゲームデータの正本は**現在のStudio Project JSON**とする。
- AIは`Export/`を直接編集して正本化しない。
- AIがデータを作成・修正する場合は、現在のProject JSONを保持したまま必要箇所だけを変更し、Studioの「JSON全件読込」へ戻せるProject JSONを成果物とする。
- Gameが読む公開データは、Studioの「Gameデータ配置」で正式Exportを生成・検証して`Export/`へ配置する。
- Gameデータだけを変更した場合はGA/GKS BuildではなくData Versionを進める。

### `HYBRID`

ソース変更とGameデータ変更の両方が必要な作業。

- `SOURCE_UPDATE`と`GAME_DATA_UPDATE`のGateと成果物を混ぜず、それぞれ独立して扱う。
- Studio更新ZIPへGameデータを同梱してGameへ配置しない。
- Gameデータをソース更新の`Export/`差分として直接配布しない。

## 6. 成果物提出と配置の最重要規則

成果物は**作業種別と用途に応じた正式な形式で提出する。すべてを1つの外側ZIPへまとめる運用は禁止する。**

- `SOURCE_UPDATE`: `studio-update.json`を含む直接のStudio更新ZIPを1件提出する。
- `GAME_DATA_UPDATE`: Studioへ読み込ませるProject JSONを直接提出できる。公開GameデータはそのJSONをStudioへ取り込み、人間確認後に「Gameデータ配置」から正式Exportする。
- `HYBRID`: Studio更新ZIPとProject JSONを**別成果物**として提出してよい。それぞれの用途を明記する。
- 管理資料・仕様書・検査資料など、配置経路を持たない複数ファイルは原則1つの資料ZIPにまとめる。ユーザーが単独JSON、PDFなどの直接形式を明示した場合はその形式を優先する。
- Studio更新ZIPを複数まとめた外側ZIPを「更新ZIP」として提出しない。

この規則と上記の必須ファイルを取得・確認できない場合、AIは成果物生成を開始してはならない。設定不備として報告すること。

## 7. Gameデータ更新の標準フロー

AIがGameデータを変更するときは、原則として次の順序を使用する。

1. Studioから現在のProject JSONを出力する。
2. AIは既存ID・参照・Story・Skill等を保持し、承認範囲だけを追加・変更する。
3. AIが返したProject JSONをStudioの「JSON全件読込」でPre-flight検証する。
4. ERRORがある場合は配置せず、原因だけを修正する。
5. 全件読込後、Studio画面で対象データを確認する。
6. 内容を変更してGameへ配置する場合はData Versionを進める。
7. Studioの「Gameデータ配置」で正式Export検証とGitHub差分を取得する。
8. 追加 / 差し替え / 除外をID単位で人間が確認する。
9. 意図しない差し替え・除外が1件でもあれば配置しない。
10. GitHubファイル削除0件を通常条件とし、`Export/`だけを配置する。
11. GitHub Pages反映後、Gameで「Storyデータを再読込」する。
12. 新しいQuestRunで実機確認する。

QuestRun開始時に確定したRandom Event / Monster編成 / Reward等は、そのQuestRunの再表示・Playbackで再抽選しない。

詳細は`docs/operations/GAME_DATA_DEPLOYMENT_MANUAL.md`を参照する。

## 8. 削除

削除は禁止が原則である。一般的な「進めて」「整理して」は削除承認ではない。例外削除は、個別承認と専用手順が揃うまで実施しない。

Gameデータの「除外」はGitHubファイル物理削除とは別概念だが、公開内容からIDが外れる変更なので、人間が対象IDを確認してから配置する。

## 9. 正本の扱い

- 現在の実装判断は最新GitHubソースを優先する。
- ビルド識別子は`package-build.json`の各コンポーネント値を参照し、過去資料から推測しない。
- ゲームとStudioは別系列として扱う。
- Studio Project JSONと公開`Export/`を同一の正本として扱わない。Project JSONはStudio編集データ、`Export/`はStudioが生成したGame公開データである。
- `Export/`をAIが直接編集してStudioへ逆輸入する運用は禁止する。
- 過去資料は通常読まない。必要な経緯がある場合だけ対象を限定して参照する。
- 大きなソース変更、削除、検査基盤変更後は、GitHub反映後のDownload ZIPを次の正式ソース基準とする。
- Gameデータ変更後は、Studio Project JSONと配置済みData Versionを次回作業時に確認する。

## 10. 完了条件

共通条件:

- 宣言した目的を満たしている
- 宣言外の変更がない、または理由と再承認が明示されている
- 必要な検査がすべて合格している
- 削除・除外・未解決事項を報告できる

`SOURCE_UPDATE`:

- Buildを進めるSOURCE_UPDATEでは、`python3 -S -B tools/release/sync-current-build-markers.py --write`を`package_manifest.json`再生成前に実行し、current Build assertion/cache tokenを`package-build.json`へ同期する。Release Gateは同toolの`--check`でdriftをFAILにする
- `package_manifest.json`が実体へ同期している
- `SOURCE_UPDATE`はQuickと`accept --context update`に合格し、Impact判定がFullを要求した場合は適用後完成ツリーのFullにも合格している
- 更新Gateには`--baseline-source`または`--baseline-zip`で基準ソースを明示し、`studio-update.json:baseline_source`のBuild / manifest SHA-256 / source tree SHA-256と一致している
- `studio-update.json:target_source`が適用後完成ツリーのBuild / manifest SHA-256 / source tree SHA-256と一致し、`artifact_id`がtarget treeへ結び付いている。Studio Buildはbaselineより必ず前進し、同一Build番号の別成果物を作成・再利用しない
- 保護テスト/Gate/Schema/test registry/integrity policyの変更・削除・新規追加がある場合、Build tokenだけの追随を除き、更新ZIP外のTest Integrity Gate完全一致hash承認とStudio配置時の別人間確認がある
- timeoutは必須FAILのまま`failure_kind=timeout`として分類され、timeoutを理由にテスト基準を弱めていない
- 必要なQuick / Accept(Impactまたは自動Full) / Release Gateが合格している
- `studio-update.json`を含み`Export/`を含まない直接のStudio更新ZIPが作成されている

`GAME_DATA_UPDATE`:

- Project JSONの全件読込Pre-flightが合格している
- Studio上で対象データを確認できる
- Gameデータ配置の追加 / 差し替え / 除外が意図どおりである
- 配置後にGameで対象Data Versionを再読込できる
- 新規QuestRun等、変更に対応する実機確認が完了している

`HYBRID`:

- 上記2系統をそれぞれ独立して満たしている

## 11. 完了報告形式

完了報告には次を含める。

- 目的と作業種別
- 基準ソース / 基準Project JSON / Data Version（該当するもの）
- 追加したもの
- 変更したもの
- 削除したもの（0件の場合も明記）
- Gameデータ除外（0件の場合も明記）
- 実行した検査と結果
- 実機確認結果（該当する場合）
- 未解決事項または判断保留事項
- 最終成果物と、それぞれの用途・配置経路

## 12. Development Project Execution Protocol

Development Projectを使う作業では、本章を通常の作業憲章に追加して適用する。目的は、ユーザーが完全Source ZIPと必要なDevelopment Projectデータを与え、**「AI_STARTから読んで作業開始」**と指示するだけで、安全に1回分の作業を開始・完了報告できるようにすることである。

### 12.1 正本の分離

- `AI_START.md`と運用文書は「どう作業するか」の正本である。
- Development Project JSONは「何を、どの順序・依存関係・承認状態で作業するか」の正本である。
- Source / Game実ファイルは「現在どう実装されているか」の正本である。
- AIはDevelopment Projectに存在しないTaskを推測で作成・実行せず、既存Taskの順序や依存関係を独自判断で変更しない。

### 12.2 対象Development Projectの決定

1. ユーザーがProject IDまたはDevelopment Project JSONを明示した場合はそれを使用する。
2. 完全Source内のDevelopment Projectが1件だけであれば、その案件を対象候補にできる。
3. 複数案件があり対象を一意に決定できない場合は、勝手に選ばず確認を求める。
4. `workspace.ai_attention`が`Exclude`の案件は自動実行対象にしない。
5. `lifecycle.status`が`Active`でない案件は自動実行対象にしない。

### 12.3 Development Task work_type

Development Taskの`work_type`は初期正式仕様として次の3種類だけを使用する。

- `DEVELOPMENT_ONLY`: Development Projectの工程・仕様・Decision・Task・Check・History等だけを更新する。
- `GAME_DATA`: Gameデータ領域だけを変更する。既存の`GAME_DATA_UPDATE`手順へ対応付ける。
- `SOURCE_UPDATE`: Studio / Gameプログラム本体、AI_START、運用文書、検査基盤等のSource packageを変更する。既存の`SOURCE_UPDATE`手順を使用する。

1つのDevelopment Taskで複数領域を混在させない。作業中に別work_typeが必要と判明した場合は、そのTaskを安全な状態で停止し、Task分割案をDevelopment統合JSONへ記録する。既存の`HYBRID`作業種別はDevelopment Task外の明示作業では維持するが、Development Taskの自動実行には使用しない。

### 12.4 実行可能Taskの選択

正式運用では、Taskは次の条件をすべて満たす場合だけ実行可能とする。

- `status`が`Todo`または`Doing`
- `box_id`が実在するWork Boxを参照する
- Work Boxの`node_id`が実在するArchitecture Nodeを参照する
- `depends_on`に列挙されたTaskがすべて`Done`
- `requires_human_approval=true`の場合、Task単位承認が`Approved`
- `work_type`が12.3の正式値のいずれか
- 対象案件がActiveで、AI実行対象から除外されていない
- workflowの段階がそのTaskの実行を禁止していない

複数Taskが実行可能な場合は`execution_order`昇順、次にTask ID辞書順で決める。一意に判断できない場合はFail Closedで停止する。

Development Project schema 1.3では、Task実行メタデータとして`execution_order` / `depends_on` / `acceptance_criteria` / `work_type` / `requires_human_approval` / `approval`を正式に保持する。旧schemaから読み込んだTaskでこれらが未設定の場合は、AIが一般則で自動実行してはならない。ユーザーがTaskを明示した場合、または案件内に人間承認済みの一意な暫定順序が明記されている場合だけ、その明示情報を使用できる。新規・更新Taskは原則として実行メタデータを設定し、暫定順序へ依存しない。

### 12.5 1回の実行範囲

初期運用では、1回のAI作業で実行するDevelopment Taskは原則1件とする。

- 選択Taskを完了しても次Taskへ自動連続着手しない。
- `acceptance_criteria`をすべて検証できないTaskを`Done`にしない。
- Taskに紐付く必要Gate / Checkが`Passed`または明示的`Waived`でない場合は`Done`にしない。
- `requires_human_approval=true`の場合、`approval.status=Approved`でないTaskを実行開始または`Done`にしない。
- 未完了条件がある場合は`Doing`または`Blocked`として結果を返す。
- Gate / Test / Security条件をTask完了のために弱体化しない。

### 12.6 work_typeごとの成果物

`DEVELOPMENT_ONLY`:
- Development統合JSONを必須成果物とする。
- Source更新ZIP、Game成果物、Build更新、`package_manifest.json`変更を行わない。

`GAME_DATA`:
- 既存`GAME_DATA_UPDATE`のProject JSON / Gameデータ配置手順を使用する。
- Development統合JSONも必ず返す。
- Studio Source更新ZIPへGameデータを混在させない。

`SOURCE_UPDATE`:
- 本書の既存`SOURCE_UPDATE`手順で直接Studio更新ZIPを作成する。
- Development統合JSONも必ず返す。
- SourceまたはGame実装を変更した場合はDevelopment Projectの`implementation_records`へBuild、対象Task、検査証跡を記録する。

### 12.7 Development統合JSON契約

AIの作業報告専用schemaや専用取込窓口は新設しない。作業結果は、Studioの**「現在案件へJSONを統合」へ直接投入できるDevelopment Project JSON**として返す。

必須規則:

- `schema_version`は対象Development Projectの現行schemaに合わせる。
- `workspace.id`は作業対象案件と完全一致させる。
- 既存ID付きRecordを更新する場合は、作業開始時に受領したRecordを基準として**完全なRecord**を返す。`{id,status}`等の部分Recordで既存Recordを更新しない。
- `project_context` / `current_focus` / `source_baseline` / `lifecycle` / `workflow`を更新する場合も完全Objectを返す。変更不要ならkey自体を出力しない。
- `workflow`のHuman承認は前進のみを正本とし、AI統合JSONで`Approved`を`Pending`へ戻したり、`Implementing`以降のstageを古いstageへ巻き戻してはならない。明示的に工程を戻す必要がある場合はHumanがStudioのWorkflow操作で実施する。
- Studioの統合処理はHuman承認済み`workflow`とその互換`workspace.status`を古いAI Snapshotより優先し、通常のJSON統合で後退させない。
- 新規Recordは必須fieldと参照整合性を満たす完全Recordとして追加する。
- `history`には今回の作業結果を1件以上追記する。
- 実施した検査は`checks`へ実際の結果とevidenceを記録する。未実施検査を`Passed`にしない。
- 既存の`Failed` Checkの原因をCorrectionで解消した場合、元の`status: Failed`は履歴として書き換えず、解消を確認した`Passed`または`Waived` Checkの`resolves_check_ids`へ対象Check IDを必ず列挙する。Studioはこの関係を機械的に解決状態へ反映し、元FailedをCurrent Gateのblocking対象から外す。
- `resolves_check_ids`で参照したCorrection Checkが`Passed`/`Waived`でなくなった場合、Studioは自動解決を解除して元Failedを再びblocking対象に戻す。人間に過去Checkの手動書換えを要求しない。
- Source / Game実装を変更した場合は`implementation_records`を追加する。変更していない場合は作成しない。
- Development JSONの生成・統合だけを理由にSource ZIPや`package_manifest.json`を生成・変更しない。
- 値を安全に確定できない場合は推測せずFail Closedで不足情報を報告する。

現在の「現在案件へJSONを統合」はID単位additive upsertであり、既存IDの更新はfield patchではなくRecord全体置換として扱う。この前提が変更された場合は、本契約を先に改訂してから新しい出力形式を使用する。

### 12.8 Development Task完了報告

Development Taskを実行した完了報告では、通常の11章に加えて次を明示する。

- 対象Development Project ID
- 実行したTask ID / work_type
- Taskの最終status
- Acceptance Criteriaの確認結果
- Development統合JSONのファイル名とStudioでの取込経路
- 次のTaskへ自動着手していないこと

