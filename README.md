# Guild Adventure Studio V4.4 Update Stable v0.7.0

## 目的

Version 4.3系から完全に識別子を切り替え、GitHub PagesとiPhone PWAで旧キャッシュが残る問題を回避するための新規リリースです。

## 表示確認

正しく更新されると、画面上部に次が表示されます。

Version 4.4 Update Stable v0.7.0 / Build 070

## 主な変更

- アプリ版を Version 4.4 / v0.7.0 に更新
- Service Worker URLを `sw.js?v=070` に変更
- キャッシュ名を `ga-studio-v070-build070` に変更
- manifestのstart_urlへ `?appv=070` を追加
- PWA IDをVersion 4.4用に変更
- インストール時に即時skipWaiting
- activate時に旧キャッシュを全削除
- HTML・Service Worker・manifestはNetwork First
- 更新時は`?appv=070`付きURLへ再読み込み
- 既存の複数プロジェクト管理、GitHub Sync、Story、Character、Validationを維持

## GitHubへのアップロード

ZIPを展開し、リポジトリ直下へ全ファイルを上書きアップロードしてください。

必須ファイル:
- index.html
- sw.js
- manifest.webmanifest
- icon-192.png
- icon-512.png

## 公開確認URL

通常URL:
https://kj2whvbzjn-hue.github.io/guild-adventure-studio/

強制確認URL:
https://kj2whvbzjn-hue.github.io/guild-adventure-studio/index.html?appv=070

Service Worker確認URL:
https://kj2whvbzjn-hue.github.io/guild-adventure-studio/sw.js?v=070

## iPhoneでの初回移行

旧ホーム画面アイコンは削除し、Safariで強制確認URLを開いてVersion 4.4表示を確認後、ホーム画面へ再追加してください。
