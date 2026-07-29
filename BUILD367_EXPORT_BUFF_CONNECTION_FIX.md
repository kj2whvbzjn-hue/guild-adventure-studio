# Build 367 — Export BUFF Connection Fix

## 修正目的
Build 366で追加した `Export/skill/skills.json` 読込関数が初期化処理から呼び出されておらず、Exportにブレスを登録しても正式データが戦闘へ反映されない問題を修正する。

## 実装
- 起動時に `loadExportBuffSkills()` を実行。
- Export読込完了後にBattle Coreを初期化。
- Exportが空・取得不能・形式不正の場合は、Build 366の正式フォールバック値を維持。
- 画面表示、セーブデータ内のゲームBuild表記を367へ更新。

## 承認済みBUFF仕様（変更なし）
- 同一BUFF再付与時は、強い効果だけを残し、持続時間を更新する。
- BUFF持続時間は、戦闘全体のTick開始時に1減少する。

## 非変更
- Save Data Version 1
- Studio本体
- Export形式およびJSONキー
- Battle Coreのダメージ式・MP・Cooldown
- formal-v03-legacyなどの旧版
