# Decision Application — DEC-CPF-0002

## 決定

Story Preview Rebuild（既存ストーリー読込後のプレビュー式プロット再生成）を正式採用し、CPF-002の必須要件へ追加する。

## 適用内容

- 正式データを直接上書きしない。
- 再生成結果をCandidate Revisionとして保存する。
- 現行版、候補版、差分、変更理由、影響範囲を比較表示する。
- 全体・章・項目単位の再生成と部分採用を可能にする。
- LOCKED、manual_fields、必須Story Milestone、固定加入章等を保護する。
- 部分採用後に整合性・依存関係・マイルストーンを再検証する。

## 実装フェーズ

CPF-002 Plot and Chapter Generator

## 優先順位

Story Importer、Structure Analyzerの直後に実装し、Plot／Chapter生成結果を同じプレビュー機構で扱う。
