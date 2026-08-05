# Phase 5 データ・共通資産整理

## ビルド

- Game: GA-B473
- Studio: GKS-B476

## 正式データ

- スキルデータの正式配置：`/Export/skill/skills.json`
- 読込URLの定義：`/assets/shared/config/runtime-config.js`
- production／validationの名称も同設定へ固定

## 共通資産

ゲームとタグ検証で完全一致していた5つのインラインスクリプトを、
`/assets/shared/js/game-shell-common.js`へ移しました。

対象は画面起動・モバイル補助・共通ナビゲーション処理です。
タグコンパイラ、戦闘処理、検証ロジックは変更していません。

## Studio表記

Studioヘッダーへ配布ビルド`GKS-B476`を正式表示し、
既存の`v1.32.0-dev / Development Build 472.43 / Formal Build 462`は
Legacy Engine情報として残しています。

新しくStudioから生成するExportの`generated_by`は
`GK Studio GKS-B476`になります。

## 未変更

- 既存のExportデータ内容
- GA-B469由来の既存`generated_by`
- 旧ページ配置
- ファイル削除
