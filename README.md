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
- `game-tag-test/index.html` — タグ検証
- `docs/index.html` — 現行資料案内

## 主な構成

- `studio/` — 編集・検証・GitHub差分配置
- `game/` — ゲーム画面
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

## GitHub差分配置

Studioの更新画面では、更新ZIPをGitHub上の現在ファイルと比較し、ADD、MODIFY、DELETE、UNCHANGEDへ分類します。

- 削除は`DELETE_MANIFEST.txt`に完全一致で記載されたパスだけを対象とする。
- 削除許可は人間が明示的に有効化する。
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
