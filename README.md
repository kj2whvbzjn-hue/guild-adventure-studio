# Guild Adventure Studio V4.3 Multi Project v0.6.0

## 今回の正式追加

- 複数プロジェクト管理
- 新規プロジェクト作成
- プロジェクト切替
- 現在プロジェクトの複製
- プロジェクト削除
- プロジェクトごとの端末保存
- プロジェクトごとの30世代バックアップ
- 全プロジェクト一括JSON出力
- 旧単一プロジェクトデータの自動移行
- GitHub同期時の更新競合警告
- Version 4.2までのPWA、Story、Character、Validation、GitHub Syncを継続

## GitHub Pages更新

1. ZIPを展開
2. GitHubの `guild-adventure-studio` リポジトリを開く
3. Add file → Upload files
4. 展開した全ファイルをアップロード
5. Commit changes
6. 1～2分待つ
7. GitHub Pagesを再読み込み

## データ移行

同じGitHub Pages URLで開けば、旧Version 4.2の端末保存データを最初のプロジェクトとして自動移行します。

念のため、更新前に旧画面からJSON出力してください。

## 推奨運用

- 作品ごとにProjectを分ける
- 大きな変更前に手動バックアップ
- 重要な作業後に現在のJSONを出力
- 定期的に全プロジェクト一括出力
- PCとiPhoneの切替時はGitHubから読込
- 作業終了時はGitHubへ保存

## 制限

複数端末で同時に編集しないでください。
GitHub側に新しい更新がある場合は警告しますが、自動マージはまだ行いません。
