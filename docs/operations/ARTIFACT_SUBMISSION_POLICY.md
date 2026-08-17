# 成果物提出ポリシー

## 原則

成果物は**作業種別と配置先に応じた正式形式へ分離して提出する。** 各成果物は用途と配置先に対応する正式形式で直接提出し、不要な外側ZIPで一括包装しない。

特に、Studio本体更新とGameデータ更新は別経路である。Studio更新ZIPへ`Export/`を同梱してGameデータを配布せず、Gameデータを外側ZIPへまとめてStudio更新画面へ渡さない。

## 作業種別ごとの正式成果物

### `SOURCE_UPDATE`

Game / Studio本体、運用文書、検査基盤などのソース変更。

正式成果物:

- `studio-update.json`を含む**直接のStudio更新ZIP** 1件
- `Export/`は含めない
- Studioの「更新ZIP」から検証・配置する

複数の更新ZIPをさらに外側ZIPへまとめて提出してはならない。

### `GAME_DATA_UPDATE`

Monster / Map / Quest / Event / Reward Table / Skill等、Studio管理データの変更。

AIがデータを編集する場合の正式成果物:

- 現在のStudio Project JSONを基準に、既存データを保持して必要箇所だけ変更した**全件読込用Project JSON**

公開Gameデータの正式配置:

1. Project JSONをStudioの「JSON全件読込」でPre-flight検証する。
2. Studioへ読み込み、人間が内容を確認する。
3. Data Versionを進める。
4. 「Gameデータ配置」で正式Exportを生成する。
5. GitHub版との追加 / 差し替え / 除外を人間確認する。
6. `Export/`だけをGitHubへ配置する。

AIが`Export/`を直接編集したJSON一式を公開正本として提出・配置する運用は禁止する。

### `HYBRID`

ソース変更とGameデータ変更の両方を含む。

- Studio更新ZIPとProject JSONを**別成果物**として提出してよい。
- それぞれの用途と適用順を明記する。
- 一方の成果物をもう一方へ同梱しない。
- 両方のGateを独立して満たす。

## 管理資料・仕様書・検査資料

配置経路を持たない複数の文書、検査資料、画像等をまとめて渡す場合は、原則1つの資料ZIPへまとめる。

ただし、ユーザーが対象成果物について単独JSON、PDF、画像、表計算等の直接形式を明示した場合、またはStudioの正式取込形式が直接ファイルである場合は、その形式を使用してよい。

「ZIP化すること」自体を目的にして、Studioが直接読むProject JSON等を不要な外側ZIPへ包まない。

## AIの必須動作

1. 作業開始時に`AI_START.md`を読み、定義された順序で`AI_PROJECT_INDEX.json`、`AI_PROJECT_STATUS.json`、`AI_WORK_RULES.md`、本書を読む。
2. `SOURCE_UPDATE` / `GAME_DATA_UPDATE` / `HYBRID`を作業宣言で確定する。
3. AI GatewayまたはAI引き継ぎZIPには、運用規則の実内容を含める。
4. 規則を取得できない場合は、成果物生成を停止して設定不備を報告する。
5. 成果物ごとに用途と配置経路を明記する。
6. `GAME_DATA_UPDATE`では基準Project JSONを確認せずに部分データだけで全件上書きしない。

## Studio更新ZIP

GitHubへStudio更新画面から配置する更新ZIPは次を満たす。

- `studio-update.json`を含む。
- 配置対象の承認済みソース変更を含む。
- `Export/`を含めない。
- `DELETE_MANIFEST.txt`は今回分だけを記載する。通常更新では削除0件とする。
- 削除がある場合は有効な`DELETE_APPROVAL.json`を含む。
- `package_manifest.json`を実体に同期する。
- `studio-update.json`へ`baseline_source`（基準Game/Studio Build、`package_manifest.json` SHA-256、完全ソースtree SHA-256）を記録する。
- `studio-update.json`へ`target_source`（適用後Game/Studio Build、`package_manifest.json` SHA-256、完全ソースtree SHA-256）と`artifact_id`を記録する。`artifact_id`は`<target studio build>-<target source tree SHA-256先頭12桁>`とし、適用後完成ツリーへ暗号学的に結び付ける。
- `target_source.studio_build`は`baseline_source.studio_build`より必ず前進させる。同一Studio Build番号の別成果物、同一Build再適用、Build逆行はGateで拒否する。
- `python3 tools/inspection/run.py accept --context update --baseline-source <exact-baseline-root>`、または`--baseline-zip <exact-baseline.zip>`に合格する。Impact判定が不確実・安全重要な場合は自動でFullへ昇格する。基準指定なしの`update` Gateは不合格とする。
- update GateはZIP単体の整合性に加え、基準完全ソースへStudioと同じ分類規則でoverlayした**適用後完成ツリー**へSource Gateを再実行する。ZIPにない既存persistentファイルは削除承認がない限り残るものとして検査する。
- 保護テスト/Gate/Schema/test registry/integrity policyを変更・削除・新規追加する更新は、Build tokenだけの追随を除き**更新ZIP外の**`TEST_CHANGE_APPROVAL.json`で完全一致パス・baseline/updated SHA-256・理由を明示し、Studio配置時に通常配置とは別の人間確認を行う。承認JSONを更新ZIPへ同梱した場合はFAILとする。
- 更新ZIP単体と適用後完成ツリーで同一のFull機能テストを重複実行しない。適用後完成ツリーを機能検査の正本とし、ZIP自体はbinding/hash/encoding/境界を検査する。
- StudioのGitHub差分解析でも、`baseline_source.package_manifest_sha256`と配置先HEADの`package_manifest.json` SHA-256、および基準Buildを照合する。基準が変化している場合は配置しない。
- 必要な場合はrelease Gateに合格する。
- ZIP整合性・UTF-8/NFC検査に合格する。

## Gameデータ配置

- AI成果物はStudioへ戻すProject JSONとし、公開`Export/`はStudio正式Exportから生成する。
- 追加 / 差し替え / 除外をID単位で確認する。
- 意図しない差し替え・除外が1件でもあれば配置しない。
- GitHubファイル削除0件を通常条件とする。
- 配置後はGameでData Versionを再読込し、新規QuestRun等で実機確認する。

## 完了条件

`SOURCE_UPDATE`:

- 直接のStudio更新ZIPが開ける。
- `studio-update.json`と期待する変更が存在する。
- `Export/`が含まれていない。
- 必須検査に合格している。

`GAME_DATA_UPDATE`:

- Project JSONがStudio全件読込Pre-flightに合格する。
- Gameデータ差分が意図どおりである。
- 配置後のGame再読込・実機確認が完了している。

`HYBRID`:

- 上記2系統がそれぞれ完了している。
