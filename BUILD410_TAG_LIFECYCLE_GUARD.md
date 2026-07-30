# BUILD410 タグライフサイクル保護ゲート

## 目的
BUILD409 の参照インスペクター／一括置換に、置換経路の整合性検査と循環防止を追加し、廃止タグ運用で参照鎖が破損しないようにする。

## 実装
- `TagIndexService.getReplacement()` を追加
- `resolveReplacementChain()` による置換経路・終端・循環の解析
- `canReplace()` による置換可否判定
- 無効タグ、廃止タグ、自己置換、循環を生成する置換の拒否
- タグ参照インスペクターに「現在の置換経路」を表示
- 「置換経路を確認」ボタンを追加
- データ検証に以下を追加
  - 廃止タグの置換先未設定警告
  - 存在しない置換先
  - 自己参照
  - 置換経路の循環

## 安全境界
- ゲームロジック、PHP Runtime、Save形式、Export形式は変更しない
- 物理削除は行わない
- 実データの置換対象は BUILD409 と同じ `characters[].tags` と `masters.*[].tags` のみ
- 置換は従来どおり人間承認と直前バックアップを必須とする

## 検証
- Studio内JavaScript構文検査: PASS
- BUILD407受け入れ検証ゲート: PASS
- BUILD408 TagIndexService試験: PASS
- BUILD410 TagLifecycleGuard試験: PASS
- PHP Runtimeタグ試験 8件: PASS
