# BUILD413 Tag Governance Export

## Purpose
タグ運用状態を人間・AI・監査工程で再利用できる機械可読成果物として出力する。

## Implementation
- データ検証画面に「タグ監査JSON出力」を追加
- データ検証画面に「置換計画CSV出力」を追加
- タグ数、参照数、未登録参照、無効参照、廃止参照、置換循環を集計
- 各タグの使用数、子タグ数、置換経路、逆参照、物理削除可否を記録
- 廃止済みかつ使用中のタグを移行候補として抽出
- 受け入れ判定と阻害理由をJSONに含める

## Safety
読み取り専用の出力機能であり、プロジェクトデータ、Save、Export、Runtimeを変更しない。

## Output schemas
- `gk.tag-governance-report.v1` JSON
- UTF-8 BOM付き migration plan CSV
