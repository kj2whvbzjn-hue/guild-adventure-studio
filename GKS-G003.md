# GKS-G003 タグ駆動戦闘効果拡張

## 目的
GKS-G001のStudio定義とGKS-G002の最小戦闘ランタイムを拡張し、タグ・スタック条件からHP条件、ダメージ、回復、HPコストを実行できるようにする。

## 追加した条件
- `hp_ratio_at_most`: 対象HP比率が指定値以下
- `hp_ratio_at_least`: 対象HP比率が指定値以上

`ratio` は0〜1で指定する。

## 追加したコスト
- `spend_hp`: actorまたはtargetのHPを消費する

HPがコスト以下の場合は実行を拒否し、全変更をロールバックする。

## 追加した効果
- `deal_damage`: HPダメージ
- `heal`: HP回復

計算指定:
- `scale: actor_attack`: 使用者攻撃力 × multiplier + power
- `scale: target_max_hp`: 対象最大HP × multiplier + power
- `scale: fixed`: 固定値

## 安全性
- 実行前にHP、alive、タグ、スタックをスナップショット
- コストまたは効果の途中失敗時は全状態を復元
- 条件不成立時は状態を変更しない
- 既存のGKS-G001/G002定義は互換維持
- 保存形式の既存フィールドを利用し、別系統のタグ辞書は追加しない

## 変更箇所
- `studio/index.html`
- `game/index.html`
- `schemas/skill.schema.json`
- `tools/test_gks_g003_tag_driven_combat_runtime.js`
- `tools/test_gks_g003_studio_definition.js`

## 検証
- Studio inline JavaScript syntax: PASS
- Game inline JavaScript syntax: PASS
- GKS-G003 runtime test: PASS
- GKS-G003 Studio/schema test: PASS
- GKS-G002 regression: PASS
- GKS-G001 regression: PASS
- PHP tag runtime: 8/8 PASS
- PHP Runtime comprehensive suite: PASS
