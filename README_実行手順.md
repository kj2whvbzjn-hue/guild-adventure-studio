# Phase 38 実行手順

この提出ZIPには、順番にStudioへ投入する2つの更新ZIPが入っています。

## 1回目
`01_Phase38A_CONTROL_LIFECYCLE_FIX.zip`

- 削除制御ファイルをGitHubへ残さない処理を追加
- stale承認ファイルの後続削除を許可
- この回のDELETEは0件

配置後、Studioページを再読み込みしてください。

## 2回目
`02_Phase38B_REMOVE_STALE_DELETE_APPROVAL.zip`

- GitHub上の`DELETE_APPROVAL.json`だけを削除
- 確認画面のDELETEが1件で、対象が`DELETE_APPROVAL.json`だけであることを確認
- ZIP内の承認ファイルは検査専用で、GitHubへ配置されません

## 完了後のsource基準
GitHubのCode → Download ZIPを取得し、次を確認してください。

- `README_GITHUB反映.md`が存在
- `README_GITHUB#U53cd#U6620.md`が存在しない
- `DELETE_APPROVAL.json`が存在しない
- `DELETE_MANIFEST.txt`が存在しない
- Quick/Full source検査が合格
