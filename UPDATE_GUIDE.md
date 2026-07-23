# Version 4.3.1 更新手順

## 1. 念のためJSON出力

現在のStudioで重要なプロジェクトをJSON出力してください。

## 2. ZIPを展開

ZIPそのものではなく、展開したファイルを使用します。

## 3. GitHubへアップロード

リポジトリ直下へ以下をアップロードします。

- index.html
- manifest.webmanifest
- sw.js
- icon-192.png
- icon-512.png
- README.md
- UPDATE_GUIDE.md
- GITHUB_SYNC_SETUP.md

## 4. Commit changes

GitHub Pagesのデプロイが緑色になるまで待ちます。

## 5. 初回確認

公開ページで次の表示を確認します。

Version 4.3.1 Cache Update v0.6.1

## 古い画面が出る場合

Version 4.3.1へ移行する最初の一度だけ、旧Service Workerを削除してください。

PC:
ブラウザのサイト設定 → サイトデータを削除 → 再読込

iPhone:
SafariのWebサイトデータ削除、またはホーム画面アイコンを削除してSafariから再追加

移行後は、更新通知とNetwork First方式が有効になります。
