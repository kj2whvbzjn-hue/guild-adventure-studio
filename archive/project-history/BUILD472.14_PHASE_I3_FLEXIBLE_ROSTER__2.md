# BUILD 472.14 Phase I3 可変人数編成管理

## 実装
- battle-roster の登録一覧を戦闘検証専用欄へ追加
- 編成JSONの人数を配列と count で可変表現
- 固定の6対6制約を実装しない
- battle_limits が設定されている場合だけ上限判定
- 登録編成の戦闘入力への反映
- 編成単体JSON出力
- 参照中編成の削除防止
- inline unit と master_id 参照の両方をサポート

## 非変更
- ナビゲーション
- 戦闘数式
- runBattleSimulation
- 旧 battle_tests / battle_snapshots
