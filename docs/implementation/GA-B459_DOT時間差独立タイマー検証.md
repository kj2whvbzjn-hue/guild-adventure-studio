# GA-B459 DOT時間差独立タイマー検証

## 目的
DOT再付与時に既存スタックの残り時間を更新せず、各スタックが付与時刻を基準に独立して発生・終了することを確認する。

## 検証シナリオ
- Tick 0: 毒斬りを実行しDOT-1を付与
- Tick 250: 再実行しDOT-2を付与
- Tick 600: 再実行しDOT-3を付与
- Tick 1600まで隔離進行
- 通常AIと行動ゲージ処理は停止

## 期待結果
- DOT付与Tick: 0, 250, 600
- DOT終了Tick: 1000, 1250, 1600
- 各スタック10回、合計30回のDOTダメージ
- DOT合計600ダメージ
- ATTACK 3回
- 最終アクティブスタック0
- 通常AI行動0
- JSON summary.passed=true

## 変更対象
- game-tag-test/index.html
- game-tag-test/manifest.webmanifest
- game-tag-test/sw.js
- tests/test_tag_skill_ga_b457.js
- tests/test_tag_skill_ga_b458.js
- tests/test_tag_skill_ga_b459.js

Studioは変更していないため、StudioビルドはGKS-B473のまま。
