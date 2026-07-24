# GK PHP Export Runtime v1.0.0

DEC-0002に従い、PHP実ゲームが`Export/`だけをゲームマスターとして安全に読み込むためのローダーです。PHP 8.1以上を対象にしています。

## 検証内容

- `manifest.json`を最初に読み込む
- 対応`schema_version`を判定する
- 必須ファイルの存在を検査する
- 全ファイルのSHA-256をmanifestと照合する
- UTF-8・JSON・共通Envelopeを検査する
- manifestと各ファイルの`schema_version`一致を検査する
- 重複パスとパストラバーサルを拒否する
- 異常時は`ExportLoadException`を投げ、ゲーム開始を停止する
- Studio内部データへのフォールバックは実装しない

## CLI検証

```bash
php php-runtime/bin/validate-export.php Export
```

成功時は終了コード0、検証エラー時は終了コード1です。

## ゲーム組込み

`examples/game-bootstrap.php`を参照してください。Web公開ディレクトリ外の`Export`絶対パスを渡す運用を推奨します。

## テスト

```bash
php php-runtime/tests/run.php Export
```

## 個別データSchema

- `schemas/export-schema-map.json` が22 ExportパスとSchema正本を対応付けます。
- `schemas/exports/*.schema.json` をNode E2EとPHP Runtimeで共有します。
- 初期Schemaは `additionalProperties: true` で、未確定項目を許容します。
- 配列データの各レコードは `id` 必須・空文字禁止です。
- 既知項目の型と明白な数値下限を検証します。
- ファイル間ID参照は別の整合性検証で扱います。

## Data Integrity Validator（DEC-0011）

- `schemas/export-schema-map.json` の22パスを公式パス正本として固定します。
- manifestは公式22パスを過不足なく含み、すべて`required: true`である必要があります。
- 同一ファイル内のID重複を拒否します。
- クエスト3種、MOD3種は横断グループでもID重複を拒否します。
- `schemas/data-integrity-rules.json` に登録された確定参照を検証します。
- 現在の確定参照は、章・節・シーン、イベント・フラグ、装備・MOD、クエスト・モンスター、ドロップ・装備です。
- 孤立データと循環参照は正式な参照項目が確定するまで停止条件にしません。


## File size limits (DEC-0018)

Default limits:

- `manifest.json`: 1 MiB
- each Export JSON: 16 MiB
- total Export package: 64 MiB

Override when constructing `ExportLoader`:

```php
$loader = new ExportLoader(
    ['1.0.0'],
    manifestMaxBytes: 1_048_576,
    fileMaxBytes: 16_777_216,
    exportMaxBytes: 67_108_864,
);
```


## Error reporting (DEC-0019)

- `RuntimeErrorReporter` separates public responses from administrator diagnostics.
- Public responses contain a generic message, stable `error_code`, and `incident_id`; internal exception messages and context are not exposed.
- Administrator logs are JSON Lines records with timestamp, incident ID, exception type, message, and sanitized context.
- Secret-like context keys and absolute directory/root values are redacted.
- A log write failure never replaces or hides the original Export loading failure.
- CLI diagnostics remain administrator-facing. Set `GK_EXPORT_ERROR_LOG` to persist CLI errors.

```bash
GK_EXPORT_ERROR_LOG=/var/log/gk/export-errors.jsonl \
  php php-runtime/bin/validate-export.php Export
```

## Repository access

```php
$package = (new GK\Export\ExportLoader(['1.0.0']))->load($exportDir);
$masters = new GK\Export\GameMasterRepository($package);
$monster = $masters->monsters()->require('MON001');
$optionalEquipment = $masters->equipment()->find('EQ001');
$partySize = $masters->gameSettings()['party_size'] ?? 6;
```

Game code should use the repository instead of reading Export JSON paths directly.

## DEC-0023 manifest完全照合
- Export配下の実ファイルを再帰走査し、`manifest.json`未登録ファイルを`MANIFEST_UNKNOWN_FILE`で拒否します。
- manifest掲載済みで実体が欠落しているファイルを`MANIFEST_MISSING_FILE`で拒否します。
- `manifest.json`自身は照合対象一覧から除外します。
- シンボリックリンクは走査中も`SYMLINK_FORBIDDEN`で拒否します。

## Atomic Update（DEC-0025）

更新候補を検証し、現行Exportと同じ親ディレクトリ上のstagingへ複製・再検証してから切り替えます。

```bash
php php-runtime/bin/update-export.php /path/to/candidate/Export /path/to/live/Export
```

- 候補検証に失敗した場合、現行Exportは変更されません。
- 同一対象への並行更新は`UPDATE_LOCKED`で拒否されます。
- 永続バックアップからの任意復元はDEC-0026で実装します。

## Rollback

Atomic Update前の世代は `.Export.rollback/` に保存されます。復元コマンド:

```bash
php php-runtime/bin/rollback-export.php /path/to/.Export.rollback/<generation> /path/to/live/Export
```

## GVF-002 バランス検査

```bash
php php-runtime/bin/gvf-balance.php Export
php php-runtime/bin/gvf-balance.php Export --strict
php php-runtime/bin/gvf-balance.php Export report.html --html
```

ルールは `schemas/balance-validation-rules.json` で変更できます。`--strict` はCritical検出時に終了コード1を返します。


## GVF-003 Scenario validation

```bash
php php-runtime/bin/gvf-scenario.php Export
php php-runtime/bin/gvf-scenario.php Export --strict-milestones
```

Rules are configured in `schemas/scenario-validation-rules.json`.


## GVF-005 Release Quality Report

```bash
php php-runtime/bin/gvf-release.php Export
php php-runtime/bin/gvf-release.php Export report.html battle-case.json 1000 20260723 --html --strict-release
```

通常モードではSimulation未指定をSKIPPEDとして記録します。正式リリース判定では`--strict-release`と戦闘ケースを指定してください。


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
