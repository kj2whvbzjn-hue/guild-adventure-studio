# BUILD409 タグ参照インスペクター／安全置換

## 目的
BUILD408 の TagIndexService を Studio の運用画面へ接続し、タグ受け入れ基盤における参照確認と安全な置換を人間承認付きで実行できるようにする。

## 実装
- 「データ検証」画面にタグ参照インスペクターを追加
- ID・名称・エイリアス検索
- 全件／使用中／未使用／廃止タグの表示フィルタ
- 使用数、参照元、JSONパス、子タグ、物理削除可否の表示
- `replacement_tag_id` と互換フィールド `recommended_replacement_tag_id` の読取
- 置換対象の事前プレビュー
- キャラクターと全マスターデータの `tags` 配列を対象にした一括置換
- 重複タグIDの自動除去
- 実行直前の自動バックアップ
- 置換元タグを廃止扱いにし、`replacement_tag_id` を記録
- 置換後の保存、索引再構築、データ検証、画面再描画

## 安全境界
- シナリオ、クエスト、イベント、戦闘ロジック、Runtime挙動は変更しない
- 対象は既存のタグ受け入れ先である `characters[].tags` と `masters.*[].tags` のみ
- 物理削除は行わない
- 置換は確認ダイアログによる人間承認後のみ実行

## 検証
- `studio/index.html` 内の全インラインJavaScriptを `node --check` で構文検査: PASS
- PHP Runtimeタグ試験 8件: PASS
- BUILD407検証ゲートおよびBUILD408 TagIndexService APIを維持
