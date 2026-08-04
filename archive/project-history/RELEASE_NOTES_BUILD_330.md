# GK Studio Build 330 Release Notes

## Added
- Git Data APIによる単一Commit配置
- ZIP選択後の自動安全検査とGitHub差分解析
- ADD / MODIFY / UNCHANGED / PROTECTED表示
- 最後の「配置実行（人間承認）」のみを必須操作とする承認境界
- Branch HEAD競合検出、Fast-forwardのみ、ref最終更新

## Removed
- 100ファイル上限
- Contents APIによるファイル単位Commit

## Safety
- 削除、force更新、.github更新、Token永続保存を禁止
- 実Repository本番試験とiPhone大容量試験は未確認
