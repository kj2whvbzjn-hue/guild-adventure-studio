# CPF データ仕様

文書ID: CPF-DATA-001  
状態: APPROVED

## Project

```json
{
  "project_id": "CPF_PROJECT_001",
  "title": "ギルド冒険物語",
  "status": "ACTIVE",
  "current_phase": "CPF-001",
  "story_version": 1,
  "created_at": "2026-07-24T00:00:00+09:00",
  "updated_at": "2026-07-24T00:00:00+09:00"
}
```

## Node

```json
{
  "node_id": "NODE_CH003",
  "node_type": "chapter",
  "source_node_ids": ["NODE_PLOT_001"],
  "status": "APPROVED",
  "locked": false,
  "version": 3,
  "generator_id": "chapter-generator",
  "generator_version": "1.0.0",
  "rule_version": "1.0.0",
  "seed": 20260724,
  "manual_fields": [],
  "approved_by": "user",
  "change_reason": "第3章でエリシア加入へ変更"
}
```

## History

```json
{
  "history_id": "HIST_000001",
  "node_id": "NODE_CH003",
  "operation": "REGENERATE",
  "from_version": 2,
  "to_version": 3,
  "changed_fields": ["join_character_ids", "ending_change"],
  "change_reason": "第3章でエリシア加入へ変更",
  "metadata": {"revision_id": "REV_NODE_CH003_000001"},
  "created_at": "2026-07-24T00:00:00+09:00"
}
```

## Dependency

```json
{
  "dependency_id": "DEP_000001",
  "source_node_id": "CHAR0007",
  "target_node_id": "CH007_SEC002",
  "dependency_type": "REQUIRED_CHARACTER",
  "impact_level": "HIGH"
}
```
