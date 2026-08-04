# GitHub Sync 初期設定

## 1. データ保存先リポジトリ

シナリオや仕様を非公開にする場合:

1. GitHub右上の + を押す
2. New repository
3. Repository name: guild-adventure-data
4. Privateを選択
5. Create repository

## 2. Fine-grained Personal Access Token

GitHub:
Settings → Developer settings → Personal access tokens → Fine-grained tokens

設定例:

- Token name: Guild Adventure Studio Sync
- Expiration: 30日または90日
- Repository access: Only select repositories
- 選択先: guild-adventure-data
- Contents: Read and write

生成されたトークンは再表示できないため、安全な場所へ一時保存してください。

## 3. Studioで入力

GitHub Sync画面:

- Owner: GitHubユーザー名
- Repository: guild-adventure-data
- Branch: main
- 保存ファイル: project-data.json
- Token: 生成したトークン

「接続テスト」を押します。

## 4. 運用

最初の端末:
GitHubへ保存

2台目:
GitHubから読込

以後:
作業開始時に読込、終了時に保存
