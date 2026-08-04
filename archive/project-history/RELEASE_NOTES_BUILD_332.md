# Release Notes — Formal Build 332

## GitHub Pages確認・配置監査証跡

- Commit完了後のGitHub Pages自動ポーリング確認を追加。
- 公開HTML内の更新パッケージ識別子を照合。
- Commit成功とPages未確認を分離表示・分離記録。
- 配置監査ZIP出力を追加。
- 監査ZIPへ旧／新Commit SHA、変更ファイルSHA-256、実行ログ、Token非保存条件を収録。
- 人間による最終配置承認、削除禁止、force禁止、`.github`保護を維持。

## 未実施

- 実Tokenを使用した本番Repository書込み試験。
- 実GitHub Pages環境での反映完了試験。
- iPhone Safari物理端末試験。
