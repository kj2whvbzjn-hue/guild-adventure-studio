# Guild Adventure Studio V4.3.1 Cache Update v0.6.1

## この版の目的

Version 4.3の機能は維持したまま、GitHub Pages更新後も古い画面が残る問題を改善した修正版です。

## 修正内容

- Service WorkerをNetwork First方式へ変更
- `index.html`、`sw.js`、`manifest.webmanifest`は常にネットワーク優先
- Service Worker更新時のキャッシュ利用を抑制
- 古いキャッシュの自動削除
- 新しいService Worker検出時に更新通知を表示
- 「今すぐ更新」で新しい版へ切替
- 起動時に最新版を確認
- 起動中は15分ごとに更新確認
- PC・iPhone両対応
- Version 4.3の複数プロジェクト、GitHub Sync、Story、Character、Validationを継続

## GitHub Pages更新手順

1. ZIPを展開
2. GitHubの `guild-adventure-studio` リポジトリを開く
3. Add file → Upload files
4. 展開した全ファイルをアップロード
5. Commit changes
6. GitHub Pagesのデプロイ完了を待つ
7. ページを一度再読み込み

## 初回だけ古い画面が残る場合

旧Service Worker自体が古い更新方式で動いているため、Version 4.3.1へ移る最初の一度だけ、旧ブラウザでは次のいずれかが必要になる場合があります。

- 別ブラウザで開く
- サイトデータを削除
- Service WorkerをUnregister
- iPhoneのホーム画面アイコンを削除して再追加

Version 4.3.1が一度読み込まれた後は、以後の更新を検出しやすくなります。

## データについて

同じGitHub Pages URLで開く限り、端末内のLocalStorageデータは原則として維持されます。
念のため、更新前に重要なプロジェクトをJSON出力してください。
