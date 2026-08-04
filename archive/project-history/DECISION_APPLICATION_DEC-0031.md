# DEC-0031 — GitHub連携画面 最優先課題完了判定

- 状態: 決定済・実装済
- 判断: 採用
- 決定日: 2026-07-24
- Build: 333

## 決定
Studio側のGitHub連携画面追加を最優先課題として継続し、Owner、Repository、Branch、PAT、接続テスト、ZIP差分解析、最終人間承認、Git Data API単一Commit、Pages確認、Token非収録監査ZIPを一画面へ統合した状態を実装完了とする。

## 人間操作境界
GitHubへの書込みは「配置実行（人間承認）」押下後だけ許可する。Tokenは永続保存しない。

## 未完了の受入試験
実Repositoryへの書込みと実GitHub Pages反映は、利用者のPATおよび公開環境で実施する。未実施を実装未完了とは混同しない。
