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
