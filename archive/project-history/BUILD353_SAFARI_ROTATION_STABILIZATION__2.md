# Build 353 — Safari Rotation Stabilization

## 変更範囲

- `formal-v03/index.html` のみ
- ルート `index.html` と `studio/` は変更していません。

## 実装

- iPhone Safari の画面回転後、Visual Viewport が安定するまで再計測
- `resize`、`orientationchange`、`pageshow`、`focus`、`visibilitychange` を統合
- Visual Viewport の offset をキャンバスホストへ反映
- 2フレーム待ってから縮尺・中央位置を確定
- 1600×900固定内部解像度を維持
