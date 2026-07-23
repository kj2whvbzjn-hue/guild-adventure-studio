# Guild Adventure Studio V4.7 Studio Auto Deploy v1.0.0

## 最優先機能

Studio本体の更新ファイルをGitHub Pages用リポジトリへ一括配置します。

### 利用手順

1. GitHub SyncでOwner、Repository、Branch、Tokenを入力
2. Studio Update Deployを開く
3. 新しいStudio更新ZIPを選択
4. パッケージ確認
5. 「更新をGitHubへ配置」
6. 公開ページを確認

### 自動化される作業

- ZIP展開
- 共通ルートフォルダ除去
- 配置対象一覧作成
- 既存ファイルSHA確認
- 新規作成・上書き判定
- Base64変換
- GitHub APIへの順次アップロード
- GitHub Pages確認URL生成

### 安全対策

- project-data.jsonを既定で保護
- .git、.github、隠しファイルを除外
- index.htmlがないパッケージは拒否
- 100ファイル上限
- テスト実行
- 逐次更新による競合低減
