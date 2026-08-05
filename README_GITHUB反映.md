# GA-B459 GitHub反映

このZIPをリポジトリ直下へ展開して上書きしてください。

## ビルド
- Studio: GKS-B473（変更なし）
- 既存ゲーム /game/: GA-B455（変更なし）
- タグ検証ゲーム /game-tag-test/: GA-B459

## 実機確認
1. `/game-tag-test/?v=459` を開く
2. 開発者モードを有効化
3. 戦闘画面の「時間差3スタック検証」を押す
4. 自動出力JSONを確認

## 期待値
- test.id: TAG-DOT-STAGGERED-TIMER-001
- end_tick: 1600
- execution_count: 3
- DOT付与Tick: 0, 250, 600
- DOT終了Tick: 1000, 1250, 1600
- DOT Hit: 30
- DOT合計: 600
- 通常AI行動: 0
- passed: true
