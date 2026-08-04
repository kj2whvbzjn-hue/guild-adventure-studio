# GitHub差分配置 運用手順

## A. 初回のみ人間が行う作業

1. 公開Repositoryを確定する。
   - Owner: `kj2whvbzjn-hue`
   - Repository: `guild-adventure-studio`
   - Branch: `main`
   - 配置先: root
2. GitHub Pagesの公開元を設定する。
3. Fine-grained Personal Access Tokenを作成する。
   - Repository access: 対象Repositoryのみ
   - Contents: Read and write
   - Metadata: Read
4. 現在の正式Studio一式を初回基準として登録する。
5. Project DataはPrivate Repositoryへ分離する。

## B. 通常更新

1. 正式な更新ZIPをStudioの「スタジオ更新配置」へ投入する。
2. ZIP検査結果を確認する。
3. `ADD`、`MODIFY`、`UNCHANGED`、`PROTECTED`、`REJECTED`を確認する。
4. 重要ファイル変更を確認する。
5. Tokenを入力する。
6. 接続テストを行う。
7. Commit messageを入力する。
8. 承認チェックを入れる。
9. 「承認して配置」を実行する。
10. Commit SHAを記録する。
11. GitHub Pages確認結果を確認する。
12. 配置ログZIPを保存する。

## C. 禁止事項

- TokenをZIP、JSON、ログ、スクリーンショットへ保存しない。
- 公開Repositoryへproject-data.jsonを配置しない。
- `.github/workflows/`をStudioから変更しない。
- 差分未確認で配置しない。
- 競合警告を無視して上書きしない。
- 初期実装で削除を有効化しない。

## D. 失敗時

### 差分作成前
修正したZIPを再投入する。Repositoryへの変更はない。

### Commit作成前
処理を中止し、再接続・再差分を行う。Repositoryへのref更新はない。

### Ref更新競合
最新Treeを取得し直し、差分を再確認する。強制更新は禁止。

### Commit済み・Pages未反映
Commit成功と公開未確認を分離して記録する。旧Commitへ戻さず、Pages設定とActions結果を確認する。

### 誤配置
監査ログに保存された直前Commit SHAを使用し、GitHub上でRevertまたは旧Treeを新Commitとして戻す。
