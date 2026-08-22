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
- Development Project JSONは「何を、どの順序・依存関係・承認状態で作業するか」の正本である。Project本文の永続正本はGit canonical path `development-project-data/<workspace.id>.json` の1系統だけとし、Registry / Session / localStorage / cacheを本文の復元元にしない。
- Development Projectは`authority.version` / `authority.instance_id` / `authority.revision` / `authority.canonical_path`を必須とする。`workspace.id`だけで旧世代と再作成後を同一案件とみなしてはならない。
- `authority`欠落、instance不一致、stale/unknown revision、複数canonical候補は自動migration・自動勝敗判定・別Snapshot復元をせずFail Closedする。
- Source / Game実ファイルは「現在どう実装されているか」の正本である。
- AIはDevelopment Projectに存在しないTaskを推測で作成・実行せず、既存Taskの順序や依存関係を独自判断で変更しない。

### 12.2 対象Development Projectの決定

1. ユーザーがProject IDまたはDevelopment Project JSONを明示した場合はそれを使用する。
2. 完全Source内のDevelopment Projectを候補にする場合も`authority`を検証し、ユーザーが別途提示した同一`workspace.id` Projectとinstance/revisionが一致しない場合は勝手に選ばずFail Closedする。
3. 複数案件・複数instance・複数revisionがあり対象を一意に決定できない場合は、勝手に選ばず確認を求める。
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

Development Project schema 2.0では、正本authorityを必須とし、Task実行メタデータとして`execution_order` / `depends_on` / `acceptance_criteria` / `work_type` / `requires_human_approval` / `approval`を正式に保持する。旧schemaから読み込んだTaskでこれらが未設定の場合は、AIが一般則で自動実行してはならない。ユーザーがTaskを明示した場合、または案件内に人間承認済みの一意な暫定順序が明記されている場合だけ、その明示情報を使用できる。新規・更新Taskは原則として実行メタデータを設定し、暫定順序へ依存しない。

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
- `authority`を必須で含め、作業開始時に受領した正本と`version` / `instance_id` / `revision` / `canonical_path`を完全一致させる。AIは統合JSON内のrevisionを先に進めない。Studioが同一base revisionを検証して統合し、Session commit時にrevisionを1つ進める。
- `updated_at`をauthority判定に使用しない。同一`workspace.id`でもinstance不一致、revision不一致、canonical_path不一致なら統合しない。
- 既存ID付きRecordを更新する場合は、作業開始時に受領したRecordを基準として**完全なRecord**を返す。`{id,status}`等の部分Recordで既存Recordを更新しない。
- `project_context` / `current_focus` / `source_baseline` / `lifecycle` / `workflow`を更新する場合も完全Objectを返す。変更不要ならkey自体を出力しない。
- `workflow`のHuman承認は前進のみとし、AI統合JSONで`Approved`を`Pending`へ戻したり、stageを後退させてはならない。明示的に工程を戻す必要がある場合はHumanがStudioのWorkflow操作で実施する。
- Lifecycle変更は通常のAI統合JSONで行わずHumanのLifecycle操作を使用する。stale Snapshot対策の正本は個別field比較ではなく`authority.instance_id/revision`である。
- 新規Recordは必須fieldと参照整合性を満たす完全Recordとして追加する。
- `history`には今回の作業結果を1件以上追記する。
- 実施した検査は`checks`へ実際の結果とevidenceを記録する。未実施検査を`Passed`にしない。
- 既存の`Failed` Checkの原因をCorrectionで解消した場合、元の`status: Failed`は履歴として書き換えず、解消を確認した`Passed`または`Waived` Checkの`resolves_check_ids`へ対象Check IDを必ず列挙する。Studioはこの関係を機械的に解決状態へ反映し、元FailedをCurrent Gateのblocking対象から外す。
- `resolves_check_ids`で参照したCorrection Checkが`Passed`/`Waived`でなくなった場合、Studioは自動解決を解除して元Failedを再びblocking対象に戻す。人間に過去Checkの手動書換えを要求しない。
- Source / Game実装を変更した場合は`implementation_records`を追加する。変更していない場合は作成しない。
- Development JSONの生成・統合だけを理由にSource ZIPや`package_manifest.json`を生成・変更しない。
- 値を安全に確定できない場合は推測せずFail Closedで不足情報を報告する。

現在の「現在案件へJSONを統合」は、まずProject authorityの同一instance・同一base revisionを必須検証し、その後ID単位additive upsertを行う。既存IDの更新はfield patchではなくRecord全体置換として扱い、統合完了時にStudioがProject revisionを1つ進める。旧形式Project、whole-record置換、全案件ブラウザ復元、Registry self-healによるProject本文注入は正規経路ではない。

### 12.8 Autonomous Correction — 正規経路収束 / Compatibility Budget 0

E2E / Gate / TestがSource不具合を検出し、現在のTaskの`work_type`では修正できない場合でも、AIは同じ失敗を無制限に再実行して停止し続けてはならない。ただし自動Correctionは**互換層や例外処理を増やして通す仕組みではなく、Currentの唯一の正規経路へ収束させるための限定例外**として扱う。

#### 自動Correctionを生成できる条件

次をすべて満たす場合だけ、Failed Checkを`SOURCE_UPDATE` Correctionの**候補として提示**できる。解析はread-onlyであり、Humanの明示指示なしにCorrection Taskを生成してはならない。12.1の「Development Projectに存在しないTaskを推測で作成・実行しない」に自動例外は設けない。

- Failure Signature（対象Test/Case、error type/message、主原因Source path）が再現可能である
- 原因がCurrent Sourceの決定的な実装欠陥へ一意に追跡できる
- Currentの既存正式API / Contract / Owner境界へ戻すだけで修正できる
- ゲーム仕様、Balance、Game Data意味、Schema意味、Security境界を変更しない
- Test / Gate / acceptance criteriaを変更・弱体化しない
- ファイル削除を必要としない
- 同じFailure Signatureの自動Correction試行が2回未満である

条件を1つでも満たさない場合はCorrection候補化せずFail Closedとする。条件を満たしてもHuman明示指示まではTask生成・親Task変更を行わない。

#### Compatibility Budget 0

通常の自動Correctionで新しい互換性を追加してはならない。特に以下を禁止する。

- 旧APIを残して新APIへfallbackする
- `legacy` / `compat` / `fallback` / `shim` / `adapter` / `alias`として旧経路を延命する
- 新旧Schemaや新旧Runtime形式の暗黙dual-read / dual-writeを追加する
- `try new -> catch old`型の互換分岐を追加する
- 未定義・不正値を空値/初期値へ置換して継続するsilent recoveryを追加する
- Testだけを通す特別分岐を追加する
- 廃止APIのwrapperを新設する

Correctionは**旧呼出しをCurrent正規APIへ置換し、旧経路を残さない**ことを原則とする。

既存Save Migrationのようにユーザーデータ保全上本当に互換性が必要な場合は、自動Correctionの例外にしない。Human承認された専用Migration/Compatibility Taskとして分離し、対象Version、正規Current形式、変換入口、終了条件/削除条件を明記する。

#### Exception Budget 0

エラー処理そのものがTaskのAcceptance Criteriaでない限り、自動Correctionはproduction codeの局所`try/catch`を増加させてはならない。

- 既存Owner境界でエラーを伝播/処理する
- 例外を握り潰す空`catch`やlog-only継続を新設しない
- 修正対象production fileについて、Correction前後の`catch`数を確認し、増加した場合はFail Closedとする
- 互換語/分岐についてもCorrection前後を確認し、新設があればFail Closedとする

既存の例外処理を今回のCorrectionと無関係に整理する便乗変更は行わない。

#### 機械判定ツール

未解決Failed Checkを自動Correction候補へ昇格する前に、次を必須実行する。

```sh
python3 -S -B tools/development/autonomous-correction.py analyze --project <Development Project JSON> --check-id <Failed Check ID>
```

`correction_candidate`の場合でもAI自身がCurrent Sourceを調査して正規経路を一意に証明する。ここでは候補内容をHumanへ提示して停止する。HumanがCorrection Task生成を明示指示した場合だけ、指示文を記録して次を使用する。

```sh
python3 -S -B tools/development/autonomous-correction.py prepare --project <Development Project JSON> --check-id <Failed Check ID> --output-project <working Development Project JSON> --human-authorized --human-instruction "<Humanの明示指示>"
```

生成されたCorrection Taskは`requires_human_approval=true` / `approval=Pending`とし、Task実行にも別途Human承認を要求する。

Correction候補のSource差分には次を実行し、Compatibility Budget 0 / Exception Budget 0がPASSしなければ破棄する。

```sh
python3 -S -B tools/development/autonomous-correction.py budget --baseline-source <Correction baseline> --target-source <Correction target>
```

#### Correction preflightの優先順位

通常Task選択の前に、実行対象Taskへ紐づく未解決blocking Failed Checkが存在する場合は同じTaskを再実行する前にAutonomous Correction analyzeを行う。候補条件を満たす場合もTask生成・親TaskのBlocked化・depends_on変更は行わず、Failure Signatureと修正候補をHumanへ提示してFail Closedで停止する。Humanが明示的に生成を指示した次回作業だけ`prepare`を実行できる。同一Failure SignatureのCorrection Taskが既に存在する場合は重複生成せずFail Closedとする。

#### Correction実行順

1. Failed CheckからFailure Signatureを固定する。
2. safe-auto条件とCompatibility / Exception Budgetを判定する。
3. Humanの明示指示を記録した場合だけ、元Taskはその`work_type`のまま保持し、別`SOURCE_UPDATE` Correction Taskを生成する。生成TaskはTask単位Human承認待ちとする。
4. exact baselineから隔離targetを作り、最小差分でCurrent正規経路へ修正する。
5. bare旧API、compat/fallback追加、`catch`増加がないことを静的確認する。
6. Targeted検証 → Quick → `accept --context update` → 必要なFull / Releaseを実行する。
7. Correction Artifact生成だけでは元Failedを解決しない。Human Apply後のCurrent Sourceで元E2Eを再実行してPASSしたCorrection Checkだけが`resolves_check_ids`を持つ。
8. 同一Failure Signatureで2回失敗した場合は自動修復を停止しHumanへ原因と試行証跡を提示する。

#### 自己修復基盤の実動作検証

自己修復基盤を検証するBuildでは、Current baselineを正本にし、既知不具合の旧Buildは不具合箇所を再現する参照にのみ使用する。baselineそのものを旧Buildへ戻してはならない。

検証順は `Current baseline -> 次Buildで既知Failure fixture + 自己修復基盤 -> Failed Checkから自動Correction -> 次Buildで修正 -> 親E2E独立PASS` とする。自己修復基盤追加とCorrection完了を同一Buildで済ませてはならない。

### 12.9 Development Task完了報告

Development Taskを実行した完了報告では、通常の11章に加えて次を明示する。

- 対象Development Project ID
- 実行したTask ID / work_type
- Taskの最終status
- Acceptance Criteriaの確認結果
- Development統合JSONのファイル名とStudioでの取込経路
- 次のTaskへ自動着手していないこと

