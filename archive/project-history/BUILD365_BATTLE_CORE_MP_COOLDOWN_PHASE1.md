# Build 365 — Battle Core MP / Cooldown Phase 1

## 実装
- 現行 `formal-v03` の戦闘ユニットへMP・最大MPを追加
- 毎Tick MPを1回復
- パワーストライクを追加（MP 12 / 攻撃力1.65倍 / Cooldown 4 Tick）
- Cooldownを毎Tick減少し、0になるまで再使用不可
- MPバー、スキル消費MP、残りCooldownを戦闘詳細へ表示
- 行動ログへ使用技・消費後MP・Cooldownを表示

## 維持事項
- セーブデータ Version 1を維持
- 戦闘用MP・Cooldownは一時値であり、セーブデータへ保存しない
- Gauge、対象選択、勝敗、報酬、Studio、Export、旧版は変更しない

## 検査
- JavaScript構文検査
- ZIP直下の公開ルートに `index.html` が存在する全体更新形式
