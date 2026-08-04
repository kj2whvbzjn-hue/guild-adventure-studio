# DECISION APPLICATION — GVF-004

## Decision
固定乱数seedによる決定論的なAGIアクティブターン戦闘シミュレーターを採用する。

## Applied scope
- 1TickごとのAG加算、AG>=100で行動
- 最大1000Tick、未決着は引き分け
- 通常攻撃／確率選択スキル
- 勝率、平均Tick、行動回数、スキル使用回数の集計
- 引き分け率、勝率偏重、行動・スキル偏重の検出
- 1000戦・10000戦を同一CLIで実行可能
- 閾値は `schemas/battle-simulation-rules.json` で設定
