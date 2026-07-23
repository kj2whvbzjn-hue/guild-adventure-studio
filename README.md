# Guild Adventure Studio V4.2 GitHub Sync v0.5.0

## 追加機能

- GitHub Sync試験版
- PCとiPhone間でプロジェクトJSONを共有
- GitHubへ保存
- GitHubから読込
- 読込前自動バックアップ
- 接続テスト
- 認証トークンを永続保存しない設計
- Version 4.1のPWA、Story、Chapter、Section、Character機能を継続

## 重要な安全事項

GitHub Pages用リポジトリは公開リポジトリです。
同じリポジトリへ `project-data.json` を保存すると、ゲーム設定やシナリオも公開されます。

非公開にしたいデータは、別途「Private」のデータ保存専用リポジトリを作成し、GitHub SyncのRepository欄に指定してください。

Personal Access Tokenは、StudioのソースコードやJSONへ記録されません。
現在開いているブラウザタブ内だけで使用されます。ページを閉じると再入力が必要です。

## GitHub更新手順

1. ZIPを展開
2. GitHubの `guild-adventure-studio` リポジトリを開く
3. Add file → Upload files
4. 展開した全ファイルをアップロード
5. Commit changes
6. 1～2分待つ
7. GitHub Pagesを再読み込み

## Fine-grained token推奨設定

- Resource owner: 自分
- Repository access: データ保存先だけ
- Repository permissions:
  - Contents: Read and write
  - Metadata: Read-only（通常は自動付与）

有効期限を設定し、不要になったトークンはGitHub側で削除してください。

## 推奨運用

作業開始:
GitHubから読込

編集中:
端末へ自動保存

作業終了:
GitHubへ保存

同時に複数端末で編集しないでください。本版には自動マージ機能はありません。
