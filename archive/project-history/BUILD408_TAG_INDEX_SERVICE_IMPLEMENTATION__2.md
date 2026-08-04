# BUILD408 Tag Index Service 正式実装報告

## 目的
BUILD406報告と実体の不一致を解消し、BUILD407のタグ受け入れ検証ゲートを支える共通インメモリ索引をStudioへ正式実装する。

## 実装
- `TagIndexService` を `studio/index.html` に追加。
- 以下の索引を再構築可能な形で保持。
  - タグID → タグ定義
  - カテゴリID → カテゴリ定義
  - タグID → 使用数
  - タグID → 参照元レコード
  - 親タグID → 子タグID一覧
  - ID／名称／エイリアス → タグID候補
- 互換公開APIを追加。
  - `getTagUsage(id)`
  - `getTagReferences(id)`
  - `getChildTags(id)`
  - `canDeleteTag(id)`
- 補助APIを追加。
  - `resolveTag(query)`
  - `rebuildTagIndex()`
- `persist()`直前と`render()`開始時に索引を再構築。
- BUILD407の参照収集を`collectTagReferencesFrom()`へ一本化。

## 削除判定
`canDeleteTag(id)` は、次を構造化して返す。
- タグの存在
- 使用数
- 子タグ一覧
- 参照元一覧
- 削除不可理由

本Buildではタグ管理画面上の物理削除操作そのものは追加しない。既存UI、Save、Export、Runtimeゲームロジックは変更しない。

## 検証
- StudioインラインJavaScript構文検査
- TagIndexService単体試験
- BUILD407タグ受け入れゲート接続試験
