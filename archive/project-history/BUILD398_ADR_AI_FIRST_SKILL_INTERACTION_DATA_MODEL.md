# Build398 ADR: AIファースト・スキル相互作用データモデル

## 決定
スキル相互作用は、コード固有分岐ではなく、機械可読な次の区分で保持する。

- `execution.conditionMode`
- `execution.conditions`
- `execution.costs`
- `execution.effects`

条件、消費、効果は配列で保持し、各要素は`subject`と`type`を持つ。

## 理由
- AIによる生成、比較、監査、差分検証を容易にする。
- スキルごとの分岐増加を抑える。
- JSONファイルへの外部化に移行可能にする。
- 失敗時の復元範囲を機械的に特定可能にする。

## 制限
- Build398では正式スキルDBへ移行しない。
- 開発用データのみを使用する。
- Save／Exportへ混入させない。
