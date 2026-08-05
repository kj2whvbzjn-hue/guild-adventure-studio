# GA-B460 GitHub反映手順

この差分はタグ検証ゲーム `/game-tag-test/` のみを GA-B460 に更新します。
Studio GKS-B473 と既存ゲーム `/game/` GA-B455 は変更しません。

## 反映

1. ZIPを展開する。
2. リポジトリ直下へ内容を上書きする。
3. GitHubへコミット・プッシュする。
4. `/game-tag-test/?v=460` を開く。
5. 開発者モードで「DOT撃破検証」を実行する。
6. 自動出力されたJSONを確認する。

## DOT撃破検証の期待値

- test.id: `TAG-DOT-DEFEAT-001`
- Tick進行: 0 → 1000
- 初期HP: 100
- ATTACK: 1回
- DOT: Tick 100、200、300の3回
- DOT合計: 52（20 + 20 + 12）
- DOT撃破: Tick 300で1回
- DOT通常終了: 0回
- 撃破後DOT: 0回
- 最終HP: 0
- target_alive: false
- active_dot_stacks: 0
- normal_ai_actions: 0
- passed: true
