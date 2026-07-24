# CPF

Current state: CPF-001 Story Pipeline Core implementation complete; multi-version CI verification pending.  
Target release: v1.23.0.

## Implemented

- Project and unified Node management
- Approval, rejection, lock and unlock
- Version and history records
- Manual field preservation
- Candidate Revision creation, rejection, and approve-to-promote
- Stale Revision conflict prevention
- Dependencies and transitive impact analysis
- JSON diff and partial regeneration requests
- Workflow Graph complete structural validation
- Generator Registry management and resolution
- Migration framework
- Unified and individual CLI commands
- Automated tests and PHP 8.1–8.4 CI configuration

## Main CLI examples

```bash
php cpf/bin/cpf.php project:create work/project CPF_PROJECT_001 "ギルド冒険物語"
php cpf/bin/cpf.php node:create work/project CH001 chapter '{"theme":"王とは何か"}'
php cpf/bin/cpf.php revision:create work/project CH001 '{"payload":{"boss":"ORC_KING"}}' "ボス設定"
php cpf/bin/cpf.php revision:approve work/project CH001 REV_CH001_000001 user
php cpf/bin/cpf.php workflow:validate cpf/config/workflow-graph.json
php cpf/bin/cpf.php generator:resolve cpf/config/generator-registry.json chapter
php cpf/bin/cpf.php validate work/project
```

Real plot and chapter generation starts in CPF-002. GUI remains outside CPF-001.

## CPF-002 Story Import and Analysis

```bash
php bin/cpf.php story:import <project-dir> examples/story-import.sample.json
php bin/cpf.php story:analyze <project-dir> STORY001
```

Use `--replace-drafts` as the third import argument only when replacing unlocked `DRAFT` or `REJECTED` Nodes. Approved and locked Nodes are never replaced by the importer.


## 提出物配布ルール（統一運用）
- すべての提出物（監査報告・検査結果・修正計画・成果物・ログ・チェックリスト）は必ずZIP形式で配布する。
- 単体ファイルのみで正式提出してはならない。
- ZIPには関連ログ、SHA-256一覧、マニフェスト等を含める。
- リリースチェックではZIP作成・CRC・展開確認・SHA確認を実施する。
