# AI / Human Approval UI v0.9

- AI作業タブを新設し、読み取り・解析・提案専用であることを明示
- 人間承認タブを新設し、書込み・公開配置の入口を集約
- GitHub接続、Workspace保存、更新ZIP配置を別機能として整理
- project-data.json固定運用を廃止し、名前付きWorkspace保存先を導入
- 保存先形式: studio-data/projects/{project}/workspaces/{workspace}.json
- ChangeSetの下書き、承認待ち、承認、却下のローカルキューを追加
- 更新ZIP配置は既存の単一Commit・人間承認処理を維持
