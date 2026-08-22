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
- GitHub配置前は`accept --context update`を実行し、`--baseline-source`または`--baseline-zip`で正確な基準完全ソースを必ず指定する。`accept`はImpact判定が不確実・安全重要・受入基準変更の場合に自動でFullへ昇格する。
- `SOURCE_UPDATE`は更新ZIP単体の整合性だけで合格扱いにせず、基準ソースへoverlayした適用後完成ツリーのSource Gateまで合格させる。
- Build更新時は`tools/release/sync-current-build-markers.py --write`をmanifest再生成前に必須実行し、`run-approved-flow.sh`の`--check`でcurrent Build token driftをRelease前に拒否する。Build tokenだけの追随はTest Integrity承認対象にしない。
- `studio-update.json`には`baseline_source`に加えて`target_source`と`artifact_id`を必須とし、targetは適用後完成ツリーと完全一致させる。Studio Buildはbaselineより必ず前進させ、同一Build番号の別成果物・再適用・逆行を禁止する。
- 公開前は`release`を実行する。
- GameデータはStudioの全件読込Pre-flightとGameデータ配置の正式Export / 参照 / 差分Gateを使用する。
- 必須検査の失敗を無視して配置しない。
- `SOURCE_UPDATE`の通常受入では、更新ZIP単体と適用後完成ツリーで同じFullを二重実行しない。機能検査は適用後完成ツリーで1回だけ行い、ZIP結合はSHA-256/パス/サイズで検証する。
- `tests/**`、Gate、Schema、test registry、integrity policy等の保護資産を変更・削除・新規追加する場合はTest Integrity Gateを先に通す。Build tokenだけの追随を除き、完全一致パス・旧新SHA-256・理由を持つ**更新ZIP外の**`TEST_CHANGE_APPROVAL.json`とStudio配置時の別人間確認が必要である。承認JSONを更新ZIPへ同梱してはならない。
- テスト失敗やtimeoutを理由にassert、期待値、skip条件、Gateを変更しない。timeoutは`failure_kind=timeout`としてFAILのまま分類し、原因テストを特定して実装またはテスト性能を直す。


## Development Project canonical authority

- Development Project本文の永続正本はGit `development-project-data/<workspace.id>.json` の1系統だけとする。Registryはmetadata、Sessionは一時作業コピー、localStorage/cacheはProject本文の復元元にしない。
- Project JSONは`authority.version` / `authority.instance_id` / `authority.canonical_path`必須。Project独自revisionは使用しない。完全削除後に同じ`workspace.id`を再作成しても、別`instance_id`は別世代として扱う。
- Git open/reload、JSON統合、Session更新、Registry同期は単一authority規則を通す。旧instance、Git SHA競合、非canonical path、同一`workspace.id`複数候補はFail Closedする。`updated_at`で自動勝敗判定しない。
- 旧形式ProjectをRuntimeで自動migrationしない。必要な移行はHumanが明示した一回限りの外部JSON置換として行い、migration adapter / dual-read / fallbackをSourceへ残さない。
- Registry mismatchを別Project本文の読込で自己修復しない。Registry修復はcanonical Projectから得たmetadataの登録だけであり、別SnapshotをSession/canonicalへ昇格させない。
- 完全削除はHuman明示操作としてGit上の同一`workspace.id`全候補を列挙して削除し、Registry / Session / obsolete browser refsも消去して残存0件を確認する。自動重複削除は行わない。
- AIが返すDevelopment統合JSONは作業開始時Projectと同じ`authority.instance_id` / `authority.canonical_path`を含める。Project独自revisionは使用しない。保存競合はGit SHAで検知する。

## 自律Correction実行規則

- 未解決blocking Failed Checkがある親Taskは、同一失敗を再実行する前に`tools/development/autonomous-correction.py analyze`をread-onlyで実行する。
- `correction_candidate`かつCurrent正規経路を一意に証明できても、Humanの明示指示なしにCorrection Task生成、親Task Blocked化、depends_on変更、Check追加・解決を行わない。候補を提示してFail Closedで停止する。
- HumanがCorrection Task生成を明示指示した場合だけ`prepare --human-authorized --human-instruction "<Humanの明示指示>"`を使用する。生成Taskは`requires_human_approval=true`のまま別Human承認を待つ。
- 同一Failure SignatureのCorrection Taskが既に存在する場合は重複生成しない。
- Correction候補は`budget`でCompatibility Budget 0 / Exception Budget 0を機械検査する。
- 自己修復の検証Buildは**現在のBuildをbaseline**とし、旧Buildは既知Failureの参照だけに使う。旧Buildをbaselineへ戻してGateを通してはならない。
- 自己修復基盤を追加したBuildでは既知Failureをその場でCorrection完了させない。次BuildのCorrectionとして分離する。

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

## 自動Correctionの負債禁止

- 自動CorrectionはCurrentの正規API / Contractへ収束させるためだけに使用し、旧経路を互換層で延命しない。
- Compatibility Budget 0: `legacy` / `compat` / `fallback` / `shim` / `adapter` / `alias`、dual-read / dual-write、`try new -> catch old`、silent recoveryを新設しない。
- Exception Budget 0: エラー処理自体がAcceptance Criteriaでない限り、production codeの局所`catch`数を増やさない。
- 本当に必要なMigration/CompatibilityはHuman承認された専用Taskへ分離し、対象Versionと終了/削除条件を必須とする。
- 同一Failure Signatureの自動Correctionは最大2回。原因が一意でない、仕様/Data/Schema/Security意味が変わる、Test/Gate変更が必要な場合はFail Closedとする。

## Full検査の集約

Fullの分割結果は、入力ZIP SHA-256・ツリーSHA-256・contextが一致し、全固定シャードが揃った場合だけ`FULL_PASS`とする。
