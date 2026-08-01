# BUILD433 Runtime Boundary

## Purpose

ゲーム、Studio、分類入口などの現行実行領域が、保存用の旧版フォルダへ誤って依存しないことを自動検査する。

## Active runtime

- `/index.html`
- `/studio/`
- `/apps/`
- `/shared/`
- `/data/`
- `/game/`

## Archive / legacy

- `/formal-v01/`
- `/formal-v02/`
- `/formal-v03/`
- `/formal-v03-legacy/`
- `/formal-v09-phase-a/`
- `/legacy-home/`

旧版は削除しない。現行実行ファイルから旧版への `src`、`href`、`action`、`fetch`、`importScripts` 参照だけを禁止する。

## Compatibility

公開URL、localStorage、ゲームデータ形式、GitHub Pages配置方法は変更しない。
