# Cleanup Phase 4

GitHub配置時の削除差分判定を修正。

- DELETE_MANIFEST.txt に明示されたパスだけを削除候補にする。
- ZIPに存在しないだけのGitHub既存ファイルは保持する。
- マニフェスト外の既存ファイルを BLOCKED（許可外）として数えない。
- Phase 1・2の削除対象109件は維持する。
