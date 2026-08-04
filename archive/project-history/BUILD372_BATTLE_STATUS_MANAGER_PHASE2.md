# Build 372 — Battle Status Manager Phase 2

## 実装
- 戦闘画面報告を確認し、戦闘開始・自動進行・勝敗・報酬反映・拠点復帰が動作していることを確認。
- BattleStatusManagerへ Action Gauge加算・消費、行動記録、ダメージ適用APIを追加。
- Tick更新、行動開始、HP減少、戦闘不能判定を共通管理層経由へ統一。
- 実HPを超える攻撃では、与ダメージ集計を実際に減少したHP量へ制限。
- 既存の戦闘数値、ターゲット選択、BUFF、MP、Cooldown、報酬値は変更なし。

## 非変更
- Save Data Version 1
- Export形式
- Studio
- 正式横型UI
- 開発用縦型UI
- 旧版
