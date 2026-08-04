# Build 337 Hotfix 2 — Auto Gauge Rendering

## 修正

- `setInterval` による一括Tick進行を廃止。
- `requestAnimationFrame` と経過時間ベースのTick蓄積へ変更。
- オート増加量を時間内に分散し、画面更新ごとにGaugeを描画。
- 一時停止時に予約済み処理が後から走らないよう実行トークンを追加。
- 手動 `+1/+10/+100 Tick` の計算式は維持。

## 正式計算

各Tickで `Gauge += AGI`。100以上で行動し、行動後に100を減算する。
