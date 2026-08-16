# システムファイル分類ポリシー

正本は `shared/integrity/system-file-policy.json` です。Studio、検査、package manifest生成、release package生成は同じ分類を使用します。

- `persistent`: GitHubへ永続保存し、package manifestへ登録
- `update_only`: 更新ZIPだけで使用し、GitHubへ配置しない
- `game_data`: 正式Gameデータ。`Export/`を分類し、Studio更新では配置せずGameデータ配置だけが更新する
- `artifact`: 提出ZIP・検査出力。GitHubへ配置しない
- `temporary`: キャッシュ・一時ファイル。更新ZIPとGitHubソースの両方で禁止

Studioは`studio-update.json`がないZIPを拒否します。複数の更新ZIPをまとめた外側の提出ZIPを誤って選択しても配置されません。

導入前に混入した制御ファイルと成果物は、この機構の反映後に独立した削除更新で除去します。
