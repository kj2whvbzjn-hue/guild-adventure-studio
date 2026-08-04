# BUILD415 ルール数値タグ実装

## 実装内容
- Studio に「ルールエディター」を追加。
- ルールは使用場所、発生タイミング、対象タグ、追加条件、実行アクション、実行設定を保持。
- 通常タグはルール内の配置ノードとして保存。
- 数値タグは配置時に親タグ、比較演算子、数値を指定。
- 親参照はタグマスターIDではなく、ルール内の `node_id` を使用。
- 比較演算子: なし、等しい、以上、以下、超過、未満、等しくない。
- 親タグ削除時は、その親に属する数値タグも同時削除。
- 既存プロジェクトは `rules` がない場合に空配列で自動補完。

## 保存形式
```json
{
  "id": "RUL-...",
  "name": "燃焼5スタックで爆発",
  "context": "Battle",
  "timing": "Hit",
  "nodes": [
    {"node_id":"RN-...","type":"tag","section":"condition","tag_id":"STACK"},
    {"node_id":"RN-...","type":"number","section":"condition","parent_node_id":"RN-...","operator":"gte","value":5}
  ]
}
```
