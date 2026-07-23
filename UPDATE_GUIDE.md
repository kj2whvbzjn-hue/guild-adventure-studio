# Version 4.4 アップロード手順

1. 現在のプロジェクトをJSON出力
2. ZIPを展開
3. GitHubのリポジトリ直下へ中の全ファイルをアップロード
4. Commit changes
5. ActionsまたはDeploymentsで成功を確認
6. 次のURLを開く

https://kj2whvbzjn-hue.github.io/guild-adventure-studio/index.html?appv=070

7. 画面上部が次なら成功

Version 4.4 Update Stable v0.7.0 / Build 070

8. iPhoneでは旧ホーム画面アイコンを削除
9. Safariで上記URLを開く
10. Version 4.4確認後にホーム画面へ追加

## GitHub上の確認

GitHubのindex.htmlを開き、次の文字列があることを確認してください。

Version 4.4 Update Stable v0.7.0 / Build 070

GitHubのsw.jsを開き、一行目が次であることを確認してください。

const CACHE_NAME='ga-studio-v070-build070';
