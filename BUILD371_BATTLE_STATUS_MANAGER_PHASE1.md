# Build 371 — Battle Status Manager Phase 1

## 実装
- BattleStatusManagerを追加し、HP/MP/Action Gauge/Cooldown/BUFF/戦闘不能の更新窓口を統合。
- Tick開始処理を `updateAtTickStart()` に一本化。
- スキル使用時のMP消費とCooldown設定を共通API経由へ変更。
- 戦闘不能処理を `setDefeated()` へ統合。
- 既存のBUFF正式ルール（強い効果優先、持続時間更新、全体Tickごとに減少）は維持。

## 非変更
- 戦闘数値、ターゲットAI、セーブ形式、Export形式、Studio、旧版、正式横型UI。
