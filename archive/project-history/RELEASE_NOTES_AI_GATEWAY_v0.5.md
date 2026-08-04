# AI Gateway v0.5

- GK Studio内にAI Gateway画面を追加
- `/ai/context`, `/ai/project`, `/ai/validation`, `/ai/handover`, `/ai/file`, `/ai/manifest` のブラウザ内ルートを追加
- AI Context JSON出力を追加
- 基本方針・許可済みソース・プロジェクト・検証結果をまとめるAI取得用ZIP出力を追加
- 人間の最終承認権限は変更しない

## 制限

この段階では外部AIサービスへの自動送信は行わない。GK Studioが取得可能な情報を標準化し、ユーザーが明示的に出力する方式とする。
