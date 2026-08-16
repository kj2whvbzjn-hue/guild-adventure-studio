# GK計画 開発スタジオ

ゲームとGK Studioを同一リポジトリで管理するブラウザ／PWA型プロジェクトです。

## 現行識別子

識別子の正本は `assets/shared/config/runtime-config.js` です。

- ゲーム：`gameBuild`
- Studio：`studioBuild`

ゲームとStudioは別系列で管理します。プロジェクト全体BuildおよびFormal Buildは使用しません。

## 公開入口

- `index.html` — プロジェクト入口
- `game/index.html` — ゲーム
- `studio/index.html` — GK Studio
- `docs/index.html` — 現行資料案内

## 主な構成

- `studio/` — 編集・検証・GitHub差分配置
- `game/` — ゲーム画面
- Legacy Tag検証機能 — Formal Game (`game/`) と正式テストへ移行完了（旧検証アプリはGA-B486.163で削除）
- `Export/` — Studioから生成されるゲーム受渡しデータ
- `schemas/` — Export、検証、品質判定の定義
- `tests/`、`tools/` — 自動検査
- `cpf/` — ストーリー生成、承認、履歴、差分、依存関係
- `php-runtime/` — Exportを検証して読み込むPHPランタイム
- `ai-gateway-server/` — 明示同期型のローカルAI読取ブリッジ

## データ運用

1. ゲームデータはStudioで編集する。
2. Studioから`Export/`を生成する。
3. ゲーム／PHPランタイムは`Export/`を読み込む。
4. `Export/manifest.json`とSHA-256で受渡し内容を検証する。
5. 過去資料の記述ではなく、現行コードと検査結果を実装判断の基準にする。

`Export/`を直接手編集せず、生成元と出力結果の差異を残さないでください。

## AI作業ルール

AIを使う作業では、最初に`AI_START.md`を読み、記載された必須読込順を完了する。特にファイル削除は原則禁止で、例外手順は`docs/operations/DELETION_POLICY.md`と`docs/operations/DELETE_WORKFLOW.md`に従う。

## GitHub差分配置

Studioの更新画面では、更新ZIPをGitHub上の現在ファイルと比較し、ADD、MODIFY、DELETE、UNCHANGEDへ分類します。

- 通常更新は削除0件を既定とする。
- 例外削除は、今回分だけの`DELETE_MANIFEST.txt`と、完全一致する人間承認`DELETE_APPROVAL.json`が必要。
- 一般的な指示を削除承認として扱わず、削除許可は人間が対象パスごとに明示する。
- PATは保存しない。
- 配置は単一Commitで行う。
- `.git`、`.github`、隠しファイル、マニフェスト外削除は対象外とする。

## 検査

代表的な検査は `tools/integrity/` にあります。

```bash
python tools/integrity/check-package-metadata.py
python tools/integrity/check-critical-runtime.py
python tools/integrity/check-html-links.py
python tools/integrity/check-runtime-boundary.py
```

PHP Export検証：

```bash
php php-runtime/bin/validate-export.php Export
php php-runtime/tests/run.php Export
```

CPFの操作方法は `cpf/README.md`、PHPランタイムの詳細は `php-runtime/README.md`、AIブリッジは `ai-gateway-server/README.md` を参照してください。

## 検査コンテキスト

GitHubから取得したソースでは `DELETE_MANIFEST.txt` は存在しません。配置ZIPでは削除許可のために存在します。

```bash
python3 tools/inspection/run.py full --context source
python3 tools/inspection/run.py full --context update
```

通常は `--context auto` が自動判定します。

## 配置メタデータ

`studio-update.json` はStudio配置時の表示・保護設定に使う可変メタデータです。
配置対象には含めますが、配置後に内容が更新される可能性があるため、`package_manifest.json` のハッシュ正本からは除外します。
ゲームとStudioの現行識別子は、それぞれの実装側定義を確認してください。プロジェクト全体BuildおよびFormal Buildは使用しません。

## 検査コンテキスト

検査は対象の種類を区別します。

- `source`: GitHubの「Code → Download ZIP」で取得したソース。`DELETE_MANIFEST.txt`を含めません。
- `update`: Studioへ投入する更新ZIP。`DELETE_MANIFEST.txt`を必須とします。

```bash
python3 tools/inspection/run.py quick --context source
python3 tools/inspection/run.py full --context update
```

`quick`はcritical-runtime JavaScriptと検査基盤Pythonを軽量検査し、critical JavaScriptがある場合はNode.jsを必須とします。`full`と`release`では全JavaScript・全PHP・全Pythonの網羅構文検査を維持します。
一時ファイル、`__pycache__`、`.pyc`、`.tmp`、バックアップファイルが混入した場合は、どのコンテキストでも不合格になります。

### 検査の停止対策

各検査工程には既定120秒のタイムアウトがあります。外部ランタイムやテストが停止しても、検査全体が無期限に待機することはありません。

```bash
python3 tools/inspection/run.py full --context source --timeout 120
python3 tools/inspection/run.py full --context update --fail-fast
```

`--timeout`は各工程の上限秒数、`--fail-fast`は最初の必須失敗で停止する指定です。タイムアウトは終了コード124としてレポートに記録されます。
## AIルールの自動引き継ぎ

AI GatewayとStudioのAIエクスポートは、`AI_START.md`、`AI_PROJECT_INDEX.json`、`AI_PROJECT_STATUS.json`、`AI_WORK_RULES.md`、成果物提出ポリシー、機械ポリシーを必須コンテキストとして実内容ごと渡す。取得できない場合はAI用成果物の生成を停止する。成果物は作業種別と配置先に応じて分離し、`SOURCE_UPDATE`は`studio-update.json`を含む直接のStudio更新ZIP、`GAME_DATA_UPDATE`はStudioへ戻すProject JSON、`HYBRID`は両者を別成果物として提出する。配置経路を持たない複数の管理資料・仕様書・検査資料は原則1つの資料ZIPへまとめる。
## AI作業憲章

AIは最初に`AI_START.md`を読み、役割優先順位、Pre-flight、作業宣言、変更範囲、完了条件、ZIP提出、完了報告の順で作業する。AI GatewayとStudioのAI用ZIPはこの憲章を必須コンテキストとして提供し、接続漏れは検査で不合格になる。

## システムファイル分類
`docs/operations/SYSTEM_FILE_POLICY.md`を参照してください。

## 証跡付き検査
検査対象のSHA-256、ZIP名情報、検査前後のツリー差分は`docs/operations/FORENSIC_INSPECTION.md`に従って記録します。

## 分割Full検査
実行時間制限がある環境では`docs/operations/SHARDED_FULL_INSPECTION.md`に従い、同一入力・同一ツリーの固定シャードを集約します。
