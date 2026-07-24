# Decision Application CPF-001

Decision ID: DEC-CPF-0001  
Status: APPLIED  
Date: 2026-07-24

## Topic

Content Production Frameworkの正式採用と、CPF-001 Story Pipeline Coreの先行実装。

## Decision

採用。

## Reason

生成機能より先に承認、ロック、差分、履歴、依存関係を実装しなければ、再生成時に承認済み設定や手動修正を破壊する危険があるため。

## Impact

- 開発ロードマップ
- 制作データ構造
- CLI
- GVF連携
- Export更新フロー
- 将来のGUI
