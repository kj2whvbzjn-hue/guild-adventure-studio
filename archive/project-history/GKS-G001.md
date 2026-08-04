# GKS-G001 タグ駆動スキル定義接続

## 目的
GKS-B002 の共通タグ辞書を、Studio のスキルマスターにおける条件・コスト・効果定義の正本として接続する。

## 実装
- マスターデータの「スキル」選択時に専用パネルを表示
- `params.execution` に次の構造を保存
  - `conditionMode`: `all` / `any`
  - `conditions[]`
  - `costs[]`
  - `effects[]`
- 対応条件: `has_tag`, `tag_exists`（保存時に `has_tag` へ正規化）, `tag_missing`, `stack_at_least`
- 対応コスト: `remove_tag`, `consume_stack`
- 対応効果: `add_tag`, `remove_tag`, `add_stack`, `remove_stack`
- タグ操作に使う `tagId` を `data.tags` と照合し、未知IDを保存拒否
- `subject` は `actor` / `target` のみ許可
- スタック操作は `stackId` と1以上の `amount` を必須化
- 例データ挿入、タグ辞書参照、保存前検証、編集時再読込を追加

## 互換性
- 既存スキルの `params` は維持
- execution が空なら `params.execution` は保存しない
- Save/Export/PHP Runtime の外部スキーマは変更しない
- ゲーム側実行器が既に扱う execution モデルと同じ構造を採用

## 検証
- Inline JavaScript 構文確認
- GKS-G001 静的受入試験
- BUILD408/410/411/414/415/GKS-B001/GKS-B002 回帰試験
