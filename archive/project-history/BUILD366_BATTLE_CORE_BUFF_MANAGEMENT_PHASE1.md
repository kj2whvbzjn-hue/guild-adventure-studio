# Build 366 — Battle Core BUFF Management Phase 1

## 承認済み仕様
- 同一BUFFの再付与：強い効果だけを残し、持続時間を更新する。
- BUFF持続時間：戦闘全体のTick開始時に1減少する。

## 実装
- 各戦闘ユニットへBUFF配列を追加。
- BUFF付与・同一効果判定・強度比較・持続時間更新を追加。
- Tick開始時の持続時間減少と、0 Tick時の自動解除を追加。
- ブレス（与ダメージ+12%、3 Tick）を検証用に実装。
- Battle Core開発コンソールへ「先頭の味方へブレス」ボタンを追加。
- BUFF表示と付与・解除ログを追加。
- Export/skill/skills.json にブレスが存在する場合は値を読み込み、空の場合は正式スキルDB値を使用。

## 非変更
- セーブ形式 Version 1
- Studio本体
- Export形式
- formal-v03-legacy などの旧版
