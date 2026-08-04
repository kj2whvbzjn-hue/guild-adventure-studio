# GKS-G002 タグ駆動スキル実行ランタイム接続

## 概要
GKS-G001でStudioに追加した `execution` 定義を、最小プレイ版の戦闘ランタイムへ接続した。

## 実装内容
- キャラクター／モンスター戦闘ユニットに `tags` と `stacks` を保持
- `has_tag` / `tag_exists` / `tag_missing` / `not_has_tag` / `stack_at_least` を評価
- `add_tag` / `remove_tag` / `add_stack` / `remove_stack` / `consume_stack` を実行
- `conditionMode: all / any` に対応
- 条件不成立時は通常攻撃へフォールバック
- コスト・効果の途中失敗時はタグ／スタックを原子的に復元
- 味方行動時、条件を満たすタグ駆動スキルを優先実行
- 戦闘ユニット欄へ現在のタグ／スタックを表示
- 旧プロジェクトや `execution` 未定義スキルは従来動作を維持

## 変更範囲
- `game/index.html`
- `tools/test_gks_g002_tag_driven_runtime.js`

## 非変更範囲
- Studio保存形式
- Exportスキーマ
- PHP Runtimeスキーマ
- 既存タグ辞書

## 検証
- game inline JavaScript syntax: PASS
- GKS-G002 runtime test: PASS
- GKS-G001 definition test: PASS
- GKS-B002 tag management test: PASS
- PHP tag runtime tests: 8/8 PASS
