# Build 351 — iPhone Safari Canvas Centering

## 対象
- `formal-v03/index.html` の固定キャンバス配置

## 変更
- 固定キャンバスを CSS Grid 中央揃えから絶対座標中央揃えへ変更
- `left: 50% / top: 50% / translate(-50%, -50%)` を採用
- iPhone Safari の `visualViewport` を使用して表示領域を計測
- アドレスバーの開閉、画面回転、復帰時に再計算
- Studio入口のルート `index.html` は変更なし

## 配置保証
- GitHub Pages → GK Studio の導線を保持
- ゲーム更新対象は `formal-v03/index.html` のみ
