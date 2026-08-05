# 安全整理 第1段階 実施記録

## 対象

現在提供されたソースコードZIPの複製。
元のZIPは変更していない。

## 除去したもの

```text
archive/
BUILD_472.40_GITHUB_DELETE_SUPPORT.md
BUILD_472.41_SCOPED_DELETE_SUPPORT.md
BUILD_472.42_EXACT_DELETE_RULES.md
BUILD_472.43_DELETE_MANIFEST_SUPPORT.md
README_GA-B469.md
README_GA-B470.md
```

`archive/` 内は旧ソース・退役画面のみで、現行ランタイムからの参照がないことを確認してから除去した。

## 同時に行った整合調整

- AI向け資料から、削除済み `archive/` への参照だけを除去
- `studio-update.json` から archive保管を前提とする注記だけを除去
- `root-surface-manifest.json` の「過去資料を必ず保持する」方針を解除
- `package_manifest.json` のファイル一覧・サイズ・SHA-256を現物から再生成

## 今回触れていないもの

- `docs/`
- `project/`
- 現行仕様書
- テスト、fixture、schema、Export
- ゲーム／Studio／CPF／PHPランタイム
- 過去番号を含む検査スクリプト名
- `package_manifest.json` の旧メタデータ項目

## 検査上の注意

提供時点から `VERSION.txt` と一部 `apps/` エントリが欠けており、複数の既存検査は整理前から実行不能だった。
今回の削除によって新しく発生したランタイム境界違反はない。
