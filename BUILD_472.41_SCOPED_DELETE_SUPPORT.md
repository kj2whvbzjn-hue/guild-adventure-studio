# Build 472.41 Scoped DELETE Support

- Build 472.40を基準
- DELETEは削除許可パスに一致するものだけ
- 初期許可:
  - archive/
  - AUDIT_
  - ARTIFACT_SHA256
  - BUILD
  - WORK_REPORT
  - RELEASE_NOTES
  - DECISION_
- 許可外の候補はDELETE_BLOCKEDとして表示
- 保護ファイル・危険パス・配置先外は引き続き削除不可
- 実行確認に削除許可ルールを表示
