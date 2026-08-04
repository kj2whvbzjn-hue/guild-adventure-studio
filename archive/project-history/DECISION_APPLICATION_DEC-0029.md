# DEC-0029 — Studio更新配置画面へのGitHub接続設定統合

- Status: APPROVED / IMPLEMENTED
- Date: 2026-07-24
- Build: 331
- Priority: HIGHEST

## 決定

GitHub連携画面の実装を最優先課題とし、Studio本体の更新配置画面内にOwner、Repository、Branch、Fine-grained PAT、接続テスト、差分解析、最終承認、配置実行を統合する。

## 実装要件

1. 更新配置画面のみでGitHub接続設定から配置まで完結する。
2. TokenはlocalStorage、IndexedDB、Export、ログへ保存しない。
3. 保存可能なのはOwner、Repository、Branch、プロジェクトJSON保存パスのみ。
4. 接続テストはRepositoryと指定BranchのHEAD取得まで確認する。
5. GitHub書込みは「配置実行（人間承認）」押下後だけ許可する。
6. DEC-0028の削除禁止、force禁止、`.github`保護、HEAD競合停止を維持する。
