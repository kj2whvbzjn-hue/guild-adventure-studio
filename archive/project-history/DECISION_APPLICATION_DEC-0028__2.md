# DEC-0028 — 配置実行の人間承認を必須とするGit Data API方式

- Status: APPROVED / IMPLEMENTED
- Date: 2026-07-24
- Build: 330

## 決定

GitHubへの書込みを伴う最後の「配置実行」だけは、人間がボタンを押して明示承認する。ZIP検査、GitHub Tree取得、SHA比較、ADD/MODIFY/UNCHANGED分類は自動化する。

## 実装境界

1. ZIP選択後、ローカル安全検査とGitHub差分解析を自動実行する。
2. 差分解析中および解析完了時点ではGitHubへ書き込まない。
3. 「配置実行（人間承認）」押下後、確認ダイアログで対象Repository、Branch、件数、Commit messageを表示する。
4. 承認後のみBlob、Tree、Commitを作成し、Branch refを最後に1回更新する。
5. 差分解析後にBranch HEADが変化した場合は停止し、再解析を要求する。
6. force更新、削除、`.github`更新、Token永続保存を禁止する。
7. Contents APIによる1ファイル1Commit方式と100ファイル制限を廃止する。

## 人間操作

初期設定を除く通常運用で必須となる公開操作は「配置実行（人間承認）」の1回のみとする。
