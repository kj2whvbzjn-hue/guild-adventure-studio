# CPF Node統一モデル仕様

## 対象Node Type

- story
- plot
- chapter
- map
- boss
- character
- section
- event
- milestone

## 必須共通項目

node_id, node_type, status, version, locked, payload, created_at, updated_at。

## 生成管理項目

generator_id, generator_version, rule_version, seed, source_node_ids。

## 人手保護項目

manual_fields, approved_by, approved_at, lock_reason。

## 依存関係

Node本体とDependency Edgeを分離して保存する。
