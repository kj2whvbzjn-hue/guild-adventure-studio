# BUILD414 Tag Governance Baseline Drift

## Purpose
BUILD413で出力したタグ監査JSONを基準として読み込み、現在のタグ運用状態とのドリフトを機械判定する。

## Implementation
- `gk.tag-governance-report.v1` の基準JSON読込
- 現在状態とのタグ・カテゴリ差分比較
- 追加、削除、属性変更の検出
- 使用数・参照数・廃止数・不正参照数などの集計差分
- 受け入れ状態の PASS / BLOCKED 比較
- PASS から BLOCKED への退行検出
- `gk.tag-governance-drift.v1` JSON出力

## Comparison fields
タグについて名称、カテゴリ、親、enabled、deprecated、locked、使用数、子数、置換先、置換経路妥当性、逆置換参照数、物理削除可否を比較する。

カテゴリについて名称、enabled、locked、所属タグ数、物理削除可否を比較する。

## Safety
- 読み取り専用
- 基準JSONはメモリ上だけに保持
- プロジェクトデータ、Save、Export、Runtimeを変更しない
- 基準解除で比較状態を破棄できる

## Verification
- Studio inline JavaScript syntax: PASS
- BUILD407 acceptance gate: PASS
- BUILD408 TagIndexService: PASS
- BUILD410 lifecycle guard: PASS
- BUILD411 safe delete: PASS
- BUILD412 category lifecycle: PASS
- BUILD413 governance export: PASS
- BUILD414 governance drift: PASS
- PHP runtime tag tests: 8/8 PASS
