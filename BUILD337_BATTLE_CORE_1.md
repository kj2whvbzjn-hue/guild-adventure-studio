# Build 337 — V9 Battle Core 1

## 実装範囲

- Phase Aのキャラクター・職業・成長・転職・Save Data Version 1を維持
- Tickカウンター
- Action Gauge
- 正本式 `AG += AGI`
- 行動条件 `AG >= 100`
- 行動後の100減算と余剰Gauge保持
- AGIに基づく行動頻度
- 手動Tick、オート進行、一時停止、リセット
- 行動ログ

## 今回は未実装

ダメージ、HP、MP、Cooldown、疲弊、AI、BUFF、DEBUFF、状態異常、DOT、スタック、耐性。

## 暫定事項

同一Tickで複数ユニットが行動可能になった場合は、余剰Gauge、AGI、登録順で処理する。V9正式追補で同時行動規則が確定した場合は置換する。
