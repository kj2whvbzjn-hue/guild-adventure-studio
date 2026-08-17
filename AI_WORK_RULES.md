# AI作業ルール

> **必須起動:** AIは最初に`AI_START.md`を読み、そこに定めた順序を完了する。起動シーケンス未完了のまま調査・編集・成果物生成を開始しない。

> **最重要提出規則:** 成果物は作業種別と用途で分離する。Studio更新ZIPとGameデータを1つの外側ZIPへまとめず、それぞれ正式な経路で提出・配置する。

## 正本

- 現在の実装判断は最新GitHubソースと検査結果を優先する。
- ゲームとStudioは別系列で管理する。
- Studioで編集するGameデータは現在のStudio Project JSONを基準にする。
- Gameが読む`Export/`はStudio正式Exportの生成物であり、AIが直接編集して正本化しない。
- 過去資料のBuild表記を現行値として推測しない。

## 作業種別

編集前に必ず次のいずれかを宣言する。

- `SOURCE_UPDATE`: Game / Studio本体、文書、検査基盤などのソース変更
- `GAME_DATA_UPDATE`: Monster / Map / Quest / Event / Reward Table / Skill等のStudio管理データ変更
- `HYBRID`: 両方を変更する。成果物とGateは分離する

## 削除

- 削除は禁止が原則である。
- 「整理」「簡素化」「古そう」「重複に見える」だけで削除しない。
- 「進めて」などの一般指示を削除承認として扱わない。
- 削除前に、非削除の代替案、必要理由、影響、復旧方法を提示する。
- 削除には完全一致パスごとの人間承認が必要である。
- `DELETE_MANIFEST.txt`は今回分だけにする。
- 削除機構の変更と実削除を同じ更新に含めない。
- 詳細は`docs/operations/DELETION_POLICY.md`と`docs/operations/DELETE_WORKFLOW.md`を参照する。

## 検査

- 通常ソース編集後は`quick`を実行する。
- GitHub配置前は`full --context update`を実行し、`--baseline-source`または`--baseline-zip`で正確な基準完全ソースを必ず指定する。
- `SOURCE_UPDATE`は更新ZIP単体の整合性だけで合格扱いにせず、基準ソースへoverlayした適用後完成ツリーのSource Gateまで合格させる。
- 公開前は`release`を実行する。
- GameデータはStudioの全件読込Pre-flightとGameデータ配置の正式Export / 参照 / 差分Gateを使用する。
- 必須検査の失敗を無視して配置しない。

## 成果物提出

- `SOURCE_UPDATE`は`studio-update.json`を含む直接のStudio更新ZIPとして提出する。
- Studio更新ZIPへ`Export/`を含めない。GameデータをStudio更新ZIPで配置しない。
- `GAME_DATA_UPDATE`でAIがStudioデータを編集した場合は、現在のProject JSONを保持した**全件読込用Project JSON**を直接提出できる。
- 公開`Export/`はAIの直接提出物をGitHubへ置くのではなく、StudioへProject JSONを取り込んだ後、「Gameデータ配置」から生成・差分確認・配置する。
- `HYBRID`はStudio更新ZIPとProject JSONを別成果物として提出してよい。外側ZIPへまとめない。
- 管理資料等の複数ファイルは原則資料ZIPへまとめる。ユーザーが対象成果物についてJSON / PDF等の直接形式を明示した場合はその形式を許可する。
- AIは成果物を作成する前に、この規則と`docs/operations/ARTIFACT_SUBMISSION_POLICY.md`を読み、AI引き継ぎデータにも含める。
- AI向けコンテキストに提出規則が含まれていない場合、成果物生成を開始せず、設定不備として報告する。

## Gameデータ運用

- 現在のStudio Project JSONを取得してから変更する。
- 既存ID・参照・未変更データを保持し、必要箇所だけを変更する。
- 全件読込Pre-flightのERRORを無視しない。
- 内容を変更して配置する場合はData Versionを進める。
- Gameデータ配置で追加 / 差し替え / 除外を人間確認する。
- 意図しない差し替え・除外があれば配置しない。
- GitHubファイル削除0件を通常条件とする。
- 配置後はGameで「Storyデータを再読込」し、新規QuestRunで確認する。
- QuestRun開始時に確定したRandom Event / Monster / Rewardを再表示時に再抽選しない。

## Studioキャッシュ安全（必須）

- Studioの同一オリジンGETはオンライン時にnetwork-firstで取得し、キャッシュは通信失敗時のfallbackとしてだけ使う。
- `?v=` 等の手動クエリ値を最新版保証の正本として扱わない。個別ファイル変更時の手動cache-bust更新へ依存しない。
- Service WorkerのprecacheはHTTPキャッシュを再利用せずfresh取得する。
- `studio_cache_policy` GateをQuick / Fullで必須とし、同一オリジンをcache-firstへ戻す変更、`no-store`を外す変更、Studio BuildとService Worker登録/namespaceの不整合はFAILとする。

## 文字化け防止（iPhone運用・必須）

- テキストはUTF-8、CSVはUTF-8 BOM付きとする。
- ZIP内ファイル名はNFC正規化し、非ASCII名にはUTF-8フラグを付ける。
- `#Uxxxx`形式へ日本語を置換した新規ファイル名を生成しない。
- ZIP成果物は提出前に文字コード検査へ合格させる。
- 詳細は `docs/operations/ENCODING_POLICY.md` を読むこと。

## 作業ライフサイクル

- `AI_START.md`の役割優先順位、Pre-flight、作業宣言、作業種別、変更範囲、完了条件、完了報告形式を必須とする。
- 作業宣言の範囲外を便乗修正しない。
- 安全に判断できない場合は、削除・仕様変更・範囲外変更を保留して確認する。
- 完了報告には追加・変更・削除・Gameデータ除外・検査・未解決事項・成果物と用途を含める。

## システムファイル分類

`docs/operations/SYSTEM_FILE_POLICY.md`と機械ポリシーに従い、更新専用制御と成果物をGitHubへ配置しない。`Export/`は`game_data`分類としてStudio更新配置から除外する。

## 原因調査と検査証跡

原因未確定の不具合へ推測変換や自動修復を加えない。`docs/operations/FORENSIC_INSPECTION.md`に従い、対象ZIPと検査結果を証跡で結び付ける。

## Full検査の集約

Fullの分割結果は、入力ZIP SHA-256・ツリーSHA-256・contextが一致し、全固定シャードが揃った場合だけ`FULL_PASS`とする。
