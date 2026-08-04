# GitHub差分配置・公開自動化 実装計画

## 1. 目的

GK Studioのファイル数増加に伴う手動アップロード負荷を解消し、更新ZIPをStudioへ投入するだけで、安全な差分検査、明示承認、単一Commit配置、GitHub Pages確認、監査証跡保存まで実施できるようにする。

## 2. 対象範囲

### 対象
- Studio更新ZIPのブラウザ内展開
- 共通ルートフォルダ除去
- パス・容量・件数・重複・必須ファイル検査
- GitHub Repositoryの現在状態取得
- SHA-256による追加・変更・同一分類
- 重要ファイル警告
- 明示承認
- 単一Commit作成
- 更新ログ・Commit SHA保存
- GitHub Pages公開確認
- 再実行と復旧

### 初期対象外
- Repository上のファイル削除
- `.github/workflows/`のStudioからの更新
- Tokenの永続保存
- 自動マージ
- 無人の自動公開
- Project JSONの公開Repository保存

## 3. アーキテクチャ

```text
更新ZIP
  ↓
安全検査・展開
  ↓
正規化ファイル一覧 + SHA-256
  ↓
GitHub Tree取得
  ↓
追加 / 変更 / 同一 / 保護 / 拒否
  ↓
人間による明示承認
  ↓
Blob作成 → Tree作成 → Commit作成 → Ref更新
  ↓
Commit SHA・監査ログ保存
  ↓
GitHub Pages公開確認
```

## 4. 実装フェーズ

### Phase 0 — 設定と運用境界
- Owner、Repository、Branch、root pathを設定項目化
- 公開Studio Repositoryと非公開Project Data Repositoryを分離
- Tokenはsession memoryのみ
- 保護パスを固定

完了条件:
- 接続テストがRead権限とWrite権限を区別して表示する
- Repository/Branch不一致を明示する

### Phase 1 — ZIP安全解析
- ZIP Slip防止
- 絶対パス、`..`、バックスラッシュ混在、制御文字を拒否
- シンボリックリンク相当属性を拒否
- 重複正規化パスを拒否
- ファイル数・単体容量・総容量上限
- 共通ルートを安全に除去
- `index.html`必須
- `.git`、`.github`、隠しファイル、秘密情報候補を除外

初期限界値:
- 最大ファイル数: 2,000
- 単体最大: 16 MiB
- 展開後合計: 128 MiB
- ZIP本体: 64 MiB

### Phase 2 — 差分計算
- GitHub Git Trees APIで再帰Treeを取得
- Repository上のBlob SHAとローカル内容を比較可能な形式へ統一
- ローカルSHA-256を監査用に保存
- 状態を `ADD` / `MODIFY` / `UNCHANGED` / `PROTECTED` / `REJECTED` に分類
- 削除候補は表示のみで実行不可

### Phase 3 — 承認UIと監査証跡
- 件数・容量・重要ファイルを要約
- `index.html`、`manifest.webmanifest`、`sw.js`、`VERSION.txt`、`studio-update.json`を重要ファイル扱い
- 50件以上、総容量10 MiB以上、重要ファイル変更時は強調確認
- 承認チェックとCommit message入力を必須化
- 配置前manifestを生成

### Phase 4 — 単一Commit配置
- Blobを作成
- 現在Treeを親に新Treeを作成
- 1つのCommitを作成
- Branch refをFast-forward更新
- Ref更新直前にBranch先端を再確認
- 競合時は停止し、再差分を要求

### Phase 5 — 公開確認と復旧
- Commit取得確認
- Pages URLへcache-busting queryを付けて確認
- `VERSION.txt`または`studio-update.json`の期待値を照合
- 公開反映待ちと配置失敗を分離表示
- 旧Commit SHAをロールバック情報として保存
- 初期版ロールバックは人間がGitHub UIで旧Commitへ戻す手順を提示

### Phase 6 — Actions自動化
- Push時に構文検査、既存試験、SHA検査、ZIP生成を実行
- Pages公開
- Studio ZIPとAudit ZIPをArtifact/Releaseへ生成
- Actions定義は人間が初回登録し、Studioからは更新禁止

## 5. エラーコード

- `DEPLOY_ZIP_INVALID`
- `DEPLOY_PATH_UNSAFE`
- `DEPLOY_DUPLICATE_PATH`
- `DEPLOY_LIMIT_EXCEEDED`
- `DEPLOY_REQUIRED_FILE_MISSING`
- `DEPLOY_PROTECTED_PATH`
- `DEPLOY_GITHUB_AUTH_FAILED`
- `DEPLOY_REPOSITORY_NOT_FOUND`
- `DEPLOY_BRANCH_NOT_FOUND`
- `DEPLOY_REMOTE_CHANGED`
- `DEPLOY_BLOB_FAILED`
- `DEPLOY_TREE_FAILED`
- `DEPLOY_COMMIT_FAILED`
- `DEPLOY_REF_UPDATE_FAILED`
- `DEPLOY_PAGES_NOT_CONFIRMED`

## 6. 試験計画

### 正常系
- 1ファイル追加
- 1ファイル更新
- 100件以上の差分
- 同一ファイル除外
- 日本語ファイル名
- 共通ルート有無

### 異常系
- `../`、絶対パス、重複パス
- index.html欠落
- 制限超過
- Token無効
- Branch不在
- Blob/Tree/Commit/Ref各段階の失敗
- Ref更新直前の競合
- Pages未反映

### 回帰
- GitHub Syncのproject-data.json保存・読込
- SSF-001〜005
- Export生成
- Project Audit
- PHP Runtime/E2E

## 7. 実装完了条件

- 単一Commitで配置される
- 部分更新が発生しない
- 削除が実行されない
- 競合時にrefを上書きしない
- Tokenが永続保存されない
- 全試験の証跡がZIPへ同梱される


## 8. DEC-0032 優先順位変更

### P0
開発側の反復作業削減を最優先とする。安全に自動化できる読取・差分・監査は自動化し、GitHubへの最終書込み承認は人間操作として残す。

### Build334工程
- GET/HEADの一時障害のみ最大3回再試行
- 429/502/503/504とネットワーク一時障害を対象
- POST/PATCHは不明状態や重複操作を避けるため再試行しない
- Request ID、Rate Limit、試行回数をエラーに記録

### 後順位
初回セットアップモード、利用者導入ウィザード、チュートリアルはP2へ移動する。
