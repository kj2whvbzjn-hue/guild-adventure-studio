# GK計画 開発スタジオ

現在のバージョン: v1.23.0-dev / Formal Build 328 / Build 329 Integration Gate

章・節・シーン管理に加え、キャラクター、組織、用語、人間関係、時系列を管理できます。

# Guild Adventure Studio V4.7 Studio Auto Deploy v1.0.0

## 最優先機能

Studio本体の更新ファイルをGitHub Pages用リポジトリへ一括配置します。

### 利用手順

1. GitHub SyncでOwner、Repository、Branch、Tokenを入力
2. Studio Update Deployを開く
3. 新しいStudio更新ZIPを選択
4. パッケージ確認
5. 「更新をGitHubへ配置」
6. 公開ページを確認

### 自動化される作業

- ZIP展開
- 共通ルートフォルダ除去
- 配置対象一覧作成
- 既存ファイルSHA確認
- 新規作成・上書き判定
- Base64変換
- GitHub APIへの順次アップロード
- GitHub Pages確認URL生成

### 安全対策

- project-data.jsonを既定で保護
- .git、.github、隠しファイルを除外
- index.htmlがないパッケージは拒否
- 100ファイル上限
- テスト実行
- 逐次更新による競合低減


## v1.4.0 追加機能
クエストの前提・後続・失敗条件、イベント連携、フラグ専用データベース、循環参照検査を追加しました。


## v1.6.0 追加機能

- ゲーム仕様マスターデータ管理画面
- 能力値、職業、スキル、装備、MOD、モンスター、状態異常、石板、AI条件・対象・行動の分類管理
- JSON形式の数値・条件・効果パラメータ
- ID自動採番、重複検査、検索、編集、削除
- UTF-8 BOM付きCSV出力（分類別・全分類）
- ブラウザタイトルの旧バージョン表記を修正


## v1.7.0 追加機能
- スキルとMP消費
- 行動後の自然MP回復
- 回復スキルと疲弊補正
- 毒・火傷・再生・スタン
- DOTの固定間隔処理
- 条件・対象・行動による簡易AI
- v1.6.0のPWAキャッシュ番号と更新情報表記を修正


## v1.9.0
戦闘テストで装備・MODマスターを参照し、ステータス補正を適用できます。


## v1.9.1 修正内容
- READMEの現行バージョン表記を更新
- PWA起動URLとキャッシュ識別子をBuild 191へ統一
- 更新メタデータと画面表示をv1.9.1へ統一


## v1.11.0 修正内容
- 内部APP_VERSIONをv1.11.0へ統一
- CSV・戦闘結果JSONの出力バージョンを現行版へ修正
- Service Worker内のmanifest・アイコンキャッシュ指定をBuild 210へ統一
- PWA起動URL、キャッシュ名、更新メタデータをBuild 210へ更新

## v1.11.0 追加機能
- 開発フェーズを「フェーズ6：戦闘プロトタイプ統合・検証」へ更新
- ダッシュボードに実装状況の自動集計を追加
- 完了済み実装、進行中項目、次の実装候補、データ件数をテキスト出力可能


## v1.13.0 追加・修正内容
- フェーズ8「複数シード安定性・勝率検証」へ移行
- 2〜100回の複数シード一括戦闘テストを追加
- 勝率、平均Tick、標準偏差、平均与ダメージ、平均回復量、平均生存数を集計
- 最良・最悪シードを表示
- 一括テスト結果CSV出力を追加
- manifestの存在しないicon-200.png参照をicon-192.pngへ修正
- studio-update.jsonのBuild値を220へ統一
- PWAキャッシュと起動URLをBuild 230へ統一


## フェーズ9.4 Decision Tracker（正式採用）
- 仕様検討を1件ずつ精査し、判断と根拠を履歴保存します。
- DEC-0001「Studio完成条件と実ゲーム完成条件の分離」は採用済みです。
- DEC-0002「PHP受渡し用データスキーマ」は採用済みです。

## DEC-0002 PHP受渡し正式方針
- Studioは `Export/` を生成します。
- PHP実ゲームは `Export/` 配下のみを読み込みます。
- Studio内部データ、セーブデータ、プレイヤーログをゲームマスターから分離します。
- app_version、schema_version、data_version、save_versionを別管理します。
- `Export/manifest.json` とSHA-256で受渡しファイルを検証します。

詳細: `PHP_EXPORT_SCHEMA_POLICY.md`、`DECISION_LOG.md`


## v1.14.0 追加機能
- DEC-0002準拠のPHP受渡しExport ZIP生成
- 22個の共通形式JSONをStudio正本から生成
- SHA-256付きmanifest.jsonを自動生成
- Studio検証エラーとExport内ID重複を生成前に検査
- シナリオ階層をchapters / sections / scenesへ分離出力

## 自動E2E試験
Studioの共通Export生成コードから最小実データExportを生成し、PHP Runtime検証と値一致確認まで自動実行します。

```bash
./tests/e2e/run.sh
```

手動ブラウザ試験は本計画の通常完了条件には含めません。端末固有問題が発生した場合のみ別途実施します。


## v1.22.1 Content Production Framework計画正式採用

- 大まかなストーリーからイベント生成までの段階生成計画を正式採用
- CPF-001〜007を開発ロードマップへ追加
- 承認、ロック、履歴、差分、部分再生成、依存関係、影響分析を基本要件化
- 次期実装はCPF-001 Story Pipeline Core
- 詳細は `CPF_APPROVAL_RECORD.md`、`CPF_EXECUTION_PLAN.md`、`CPF_BASIC_SPECIFICATION.md` を参照


## CPF v1.0仕様凍結
Node統一モデル、Generator Registry、Rule Version、Manual Override、Workflow Graph、Story Milestone、GUI/API準備仕様を正式採用。

## v1.23.0-dev CPF-002 Story Preview / Scenario Support正式採用

- 既存ストーリー読込後の非破壊プレビュー・候補Revision管理を正式採用
- 現行版と候補版の比較プレビュー、変更理由、影響範囲、警告を表示
- LOCKED、manual_fields、必須マイルストーンを保護
- 候補全文の比較、明示承認、却下、Export準備連携を提供
- 詳細は `CPF_STORY_PREVIEW_REBUILD_SPECIFICATION.md` を参照

## v1.23.0-dev CPF-002A Import Safety Hardening 正式採用

- シナリオ取込前にImport安全化工程を必須追加
- 再取込時の残存Node、途中失敗による部分更新、Milestone二重管理を解消
- Project Lock、Transaction/Rollback、Snapshot世代管理、内部ID分離を実装対象化
- 詳細は `CPF_IMPORT_SAFETY_HARDENING_EXECUTION_PLAN.md` を参照


## 提出物配布ルール（追加）

- すべての提出物（監査報告、検査結果、修正計画、成果物、ログ、チェックリストを含む）は、必ずZIP形式にまとめて配布すること。
- ZIPには提出物本体に加え、必要な付属資料（ログ、ハッシュ一覧、マニフェスト等）を含めること。
- 単体ファイルのみでの提出は行わず、正式成果物はZIPを唯一の配布形式とする。


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
