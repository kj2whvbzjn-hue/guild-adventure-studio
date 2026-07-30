# BUILD411 タグ安全物理削除ゲート

## 目的
BUILD410までに整備したタグ参照索引・置換経路保護を利用し、不要タグを安全に物理削除できる操作を追加する。

## 実装
- `TagIndexService` に置換先から置換元を逆引きする索引を追加
- `getReplacementSources()` を追加
- `canDelete()` の削除禁止条件を拡張
  - 使用中
  - 子タグあり
  - ロック済み
  - 他タグの置換先として参照中
- タグ参照インスペクターに置換元件数と一覧を表示
- 削除可能時のみ「安全に物理削除」ボタンを有効化
- 物理削除前にタグIDの再入力を必須化
- 実行直前バックアップを必須化
- 削除後に保存、索引再構築、再検証、画面再描画を実施

## 安全境界
- ゲームロジック、PHP Runtime、Save形式、Export形式は変更しない
- 削除対象は `data.tags` の該当定義1件のみ
- 参照中、子タグあり、ロック済み、置換先参照中のタグは削除しない
- 自動置換や連鎖削除は行わない

## 検証
- Studio内JavaScript構文検査: PASS
- BUILD407受け入れ検証ゲート: PASS
- BUILD408 TagIndexService試験: PASS
- BUILD410 TagLifecycleGuard試験: PASS
- BUILD411 TagSafeDelete試験: PASS
- PHP Runtimeタグ試験 8件: PASS
