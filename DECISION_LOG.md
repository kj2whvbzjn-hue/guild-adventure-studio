# Decision Log

## DEC-0001 — Studio完成条件と実ゲーム完成条件の分離
- 状態: 決定済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: GK Studioはゲーム制作支援ツールとして完成させ、ギルド冒険物語はStudioから出力されたデータを使用する実ゲームとして分離する。
- 主な理由: 責務明確化、保守性、再利用性、実ゲーム依存の低減。

## DEC-0002 — PHP受渡し用データスキーマ
- 状態: 決定済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: StudioはExportフォルダを生成し、PHPゲームはExport配下のみを読み込む。Studio内部データは実ゲームへ渡さない。
- バージョン: app_version、schema_version、data_version、save_versionを分離する。
- 共通JSON: schema_version、data_version、generated_at、generated_by、dataを持つ。
- セーブとプレイヤーログ: PHP実ゲーム側で生成・管理し、ゲームマスターから分離する。
- 主な理由: Studioと実ゲームの独立性、PHP実装容易性、将来移植性、移行管理の明確化。

- R4採用: Audit Protocol、証拠追跡、暗黙仕様生成禁止などを追加。

## DEC-0011 — マスター参照整合性 / Data Integrity Validator
- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: 公式22パス固定、同一・横断グループの重複ID検出、確定済みID参照検証をPHP Runtime起動時に実施する。
- ルール正本: `schemas/data-integrity-rules.json`。
- 手動テスト: 原則不要。Node→Export→PHP Runtime自動E2Eと異常系試験で検証する。
- 保留: 未確定の参照項目、孤立データ警告、循環参照検出は仕様確定後にルール追加する。

## DEC-0017 — Exportメタデータ一致検証
- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: manifestと各Export JSONのschema_version、data_version、generated_at、generated_byを完全一致させ、不一致時は項目別エラーコードでPHP Runtime起動を停止する。
- 主な理由: SHA-256を正しく再計算した異なる世代・生成元のJSON混入を防止するため。
- schema_version: JSON構造変更を伴わないため1.0.0を維持する。

## DEC-0018 — Exportファイルサイズ制限
- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: manifest 1 MiB、個別JSON 16 MiB、Export総容量64 MiBを既定上限とし、読込前に超過を拒否する。

## DEC-0019 — Runtimeエラー記録方式
- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: 利用者向けには一般化した503レスポンスとerror_code・incident_idのみを返し、管理者向けには構造化JSONLログを出力する。秘密情報と絶対パスはマスクする。
- ログ障害時: ログ書込み失敗で本来の起動停止処理を妨げない。
- 手動テスト: 原則不要。PHP自動試験とE2Eで検証する。


## DEC-0020 — Runtime異常系テスト拡充
- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: manifest、JSON形式、UTF-8、Envelope、メタデータなど、実装済みRuntime検証の未網羅異常経路をPHP自動試験へ追加する。
- 完了条件: 各異常ケースが想定した固有error_codeで停止し、正常E2Eと既存異常系に回帰がないこと。
- 手動テスト: 原則不要。

## DEC-0021 PHPゲームRepository接続
- 状態: 採用・実装済
- ExportLoaderの結果をGameMasterRepositoryへ渡し、ゲーム本体からJSONパスとEnvelopeを分離。
- Runtime Reliability A-1〜A-5完了。


## DEC-0022 — Exportシンボリックリンク対策
- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: Exportディレクトリ本体、manifest、配下ディレクトリ、各JSONにシンボリックリンクを許可しない。リンク先がExport内でも拒否する。
- エラーコード: `SYMLINK_FORBIDDEN`。実体解決後にExport外となる場合は`PATH_OUTSIDE_EXPORT`。
- 主な理由: 配備環境差、リンク差替え、Export外部ファイルの読込みを防止するため。
- 手動テスト: 原則不要。PHP自動試験とE2Eで検証する。


## DEC-0023 — manifest未登録・欠落ファイル検出
- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: Export実体とmanifestを完全照合し、未登録を`MANIFEST_UNKNOWN_FILE`、欠落を`MANIFEST_MISSING_FILE`で拒否する。


## DEC-0024 — PHP 8.1〜8.4 CI
- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-23
- 方針: GitHub ActionsでPHP 8.1〜8.4の構文検査、Runtime試験、Export検証を実行する。
- fixture: Repository統合試験は試験内で一時データを生成し、空の正式Exportに依存させない。


## DEC-CPF-V1-0001 — CPF v1.0仕様凍結
- 状態: 決定済
- 判断: 採用
- 決定日: 2026-07-24
- 方針: CPF v1.0の基盤仕様を凍結し、v1.xでは互換変更のみを許可する。
- 再採番理由: Story Preview Rebuildで既に使用されていたDEC-CPF-0002との衝突を解消するため、仕様凍結専用IDへ分離した。

## DEC-CPF-0002 — Story Preview Rebuild正式採用
- 状態: 決定済
- 判断: 採用
- 決定日: 2026-07-24
- 方針: 既存ストーリー読込後、正式データを直接変更せず、改善版プロットを候補Revisionとして生成し、現行版との比較プレビュー、影響分析、固定項目保護、全体・部分採用を可能にする。
- 適用フェーズ: CPF-002 Plot and Chapter Generator
- 正本: `CPF_STORY_PREVIEW_REBUILD_SPECIFICATION.md`

## DEC-CPF-0003 — CPF-002 Import Safety Hardening正式採用
- 状態: 決定済
- 判断: 採用
- 決定日: 2026-07-24
- 方針: Plot Generator着手前に、Import Schema、Project Lock、Transaction/Rollback、子Node同期、Milestone正本統一、Snapshot世代管理、ID分離、冪等性・並行試験を完了する。
- 適用フェーズ: CPF-002A
- 正本: `CPF_IMPORT_SAFETY_HARDENING_EXECUTION_PLAN.md`、`DECISION_APPLICATION_CPF-002_IMPORT_SAFETY.md`

## DEC-SGF-0001 — 自動シナリオ生成機構の独立管理
- 状態: 決定済
- 判断: 採用
- 決定日: 2026-07-25
- 方針: CPFを制作基盤・取込・承認・統合、SGFを自動プロット・章・節生成として責務分離する。
- 移行: CPF-002Aを両フレームワークの統合ゲートとして維持する。

## DEC-SGF-0002 — Chapter/Section生成単位と候補Revision方式
- 状態: 決定済
- 判断: 採用
- 決定日: 2026-07-25
- 方針: 生成結果は候補Revisionへ保存し、章単位・節単位の再生成、比較、部分採用を可能にする。正式データを生成処理から直接更新しない。

## DEC-SGF-0003 — 自動シナリオ生成凍結と制作支援機能への全面転用

- Status: 決定済
- Decision: 全面採用・正式反映
- Build: 328
- Summary: Built-in AI/API generation is frozen. Prompt Builder, design forms, paste/import, Story Preview, consistency validation, candidate Revision, approval, and Export remain active as the Scenario Support Framework.
- Reactivation: 新規Decisionおよび再監査を必須とする。
