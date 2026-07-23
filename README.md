# Guild Adventure Studio V4 Browser Standalone v0.3.0

## 概要

PHPを使用せず、HTML・CSS・JavaScriptだけで動作するVersion 4の開発基盤です。

## Windowsでの起動

1. ZIPを「すべて展開」する
2. `index.html` をダブルクリックする
3. ChromeまたはEdgeで開く

追加インストールは不要です。

## iPhoneでの利用

UIはiPhone向けレスポンシブ表示に対応しています。

ただし、iPhoneの「ファイル」アプリからローカルHTMLを直接開く方法は、iOSやアプリの状態によって動作が不安定です。
安定運用する場合は、`index.html` を静的Webサーバーへ配置してSafariで開いてください。

候補:
- GitHub Pages
- Cloudflare Pages
- Netlify
- 自宅PCのローカルWebサーバー

Safariで開いた後、「共有」→「ホーム画面に追加」でアプリ風に起動できます。

## 保存方式

- 通常保存: ブラウザのLocalStorage
- 正本の持ち出し: JSON出力
- 他端末への移動: JSON読込
- バックアップ: ブラウザ内30世代

重要な作業後は必ずJSON出力してください。
ブラウザ履歴やサイトデータを削除するとLocalStorageが消える場合があります。

## 実装済み

- プロジェクト管理
- JSON正本
- DecisionLog
- ID自動採番
- ID重複防止
- Validation
- 最大30世代バックアップ
- JSON Import / Export
- PC / iPhone向けレスポンシブUI
- Explorer / Editor / Inspector

## 次工程

Phase 2 Validation Engineの拡張:
- 参照整合性
- 孤立データ
- 章・節・シーン階層
- Character Relation
- Quest前提条件
- Export可否判定
