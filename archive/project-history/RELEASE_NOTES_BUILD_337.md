# GK Studio Build 337 Release Notes

## Bootstrap Foundation Integration

- Bootstrap Contextのローカル読込・検証・表示・再出力を追加。
- 起動レベル、Blocking Issues、Warnings、権限状態を表示。
- repository write authorityを`human_only`として検証。
- AI自己承認を禁止。
- 読込上限を2 MiBに設定。
- GitHub API書込み、自動反映、承認操作は追加しない。

## Authority

本番・GitHub反映は人間のみ。
