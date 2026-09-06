# Data

ゲーム内容を表すデータの分類先です。

- Game Dataの正本はGitHub Game Data Authority Repository rootの `project-data.json` です。Source rootの `project-data.json` は移行中の非Authority残置物で、最終Cutover後に削除します。
- Studio localStorageはWorking Copy、`Export/**`はGame Runtime向けFormal公開物です。
- `data/skills/` は外部化済みスキルデータです。
- `Export/` は書き出し成果物です。

同名データを複製せず、正式な保存元を一つに保つ方針です。
