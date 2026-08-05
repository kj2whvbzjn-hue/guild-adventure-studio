# GA-B456 タグスキル Sprint 2

- ATTACK成功後のDOT付与
- DOTスタックの個別管理
- `DOT_INTERVAL` 後の初回発生
- `floor(DOT_DURATION / DOT_INTERVAL)` 回の発生
- 再付与は新規スタック追加、既存時間は更新しない
- DOT撃破、ログ、状態表示

毒属性の検証用 `MAX_STACK` は5です。これは動作確認値で、正式バランス値ではありません。

- Studio: GKS-B473（変更なし）
- 既存ゲーム: GA-B455（変更なし）
- タグ検証ゲーム: GA-B456
