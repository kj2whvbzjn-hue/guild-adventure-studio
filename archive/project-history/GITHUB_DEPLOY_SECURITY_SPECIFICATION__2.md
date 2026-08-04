# GitHub差分配置 セキュリティ仕様

## Token
- Fine-grained tokenを使用する。
- 対象Repositoryを限定する。
- Contents Read/Write以外の権限を原則付与しない。
- localStorage、IndexedDB、Project JSON、バックアップ、ログへ保存しない。
- DOMへ平文再表示しない。
- エラーへToken断片を含めない。

## ZIP
- パス正規化後にroot外参照を拒否する。
- 絶対パス、drive letter、UNC、`..`、NUL、制御文字を拒否する。
- 正規化後の重複を拒否する。
- シンボリックリンクを拒否する。
- ZIP bomb対策として件数・圧縮率・展開容量を制限する。

## 配置対象
- 拒否: `.git/`, `.github/`, `.env`, token, secret, credential, private key類
- 保護: `project-data.json`, backup, local state
- 重要警告: `index.html`, `sw.js`, `manifest.webmanifest`, `VERSION.txt`, `studio-update.json`

## GitHub更新
- Force pushを使用しない。
- 現在Branch先端を再確認してからref更新する。
- 期待した親Commitと異なる場合は停止する。
- 最終方式は1 Commitとし、逐次Contents API更新を正式運用にしない。

## ログ
- 実行ID、日時、Repository、Branch、旧/新Commit SHA、対象ファイル、SHA-256、結果、エラーコードを保存する。
- Token、Authorization header、ファイル内秘密情報は保存しない。
