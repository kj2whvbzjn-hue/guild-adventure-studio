# BUILD407 タグ受け入れ検証ゲート 実装報告

## 目的
Studio側のタグ受け入れ基盤に、保存済みデータを非破壊で監査する共通検証ゲートを追加する。

## 実装
- `collectTagReferences()` を追加。
  - キャラクターの `tags`
  - 全マスター分類の `tags`
  - 参照元種別、ID、名称、JSONパスを収集
- `validateTagSystem()` を追加。
  - タグカテゴリID未設定・重複
  - タグカテゴリ名称未設定
  - タグID未設定・重複
  - タグ名称未設定
  - 未登録カテゴリ参照
  - 親タグ自己参照
  - 未登録親タグ参照
  - 親子循環参照
  - 重複エイリアス
  - 空タグID参照
  - 未登録タグ参照
  - 無効タグ参照
  - 廃止タグ参照
- 既存の「データ検証」へ統合。
- 既存JSON、Save、Export、ゲームロジックは変更しない。

## 判定方針
- 構造破損・不明参照・循環は `ERROR`
- 無効／廃止タグの既存参照、重複エイリアスは `WARNING`
- 自動削除・自動置換は行わない

## ベースライン確認で判明した差異
`BUILD406_TAG_INDEX_SERVICE_REPORT.md` には `TagIndexService` 実装済みと記載されているが、受領した `studio/index.html` には同名クラス／公開APIが存在しない。
本Buildでは、先に実データの安全性を担保する検証ゲートを実装した。TagIndexService本体の復元または正式再実装は次工程とする。

## 検証
- StudioインラインJavaScript: `node --check` 成功
- PHP Runtimeタグ試験: 8/8 PASS
- 変更対象: `studio/index.html` と本報告書のみ
