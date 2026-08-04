# Content Production Framework 実装計画

文書ID: CPF-IMPL-001  
状態: APPROVED

## 1. コア構成

```text
cpf/
├─ bin/
├─ config/
├─ schemas/
├─ src/
│  ├─ Core/
│  ├─ Workflow/
│  ├─ Approval/
│  ├─ Dependency/
│  ├─ Generation/
│  ├─ Diff/
│  ├─ History/
│  ├─ Validation/
│  └─ Export/
├─ templates/
└─ tests/
```

## 2. コアサービス

- CpfProjectManager
- CpfWorkflowManager
- CpfApprovalManager
- CpfLockManager
- CpfGenerationManager
- CpfDependencyManager
- CpfImpactAnalyzer
- CpfDiffService
- CpfHistoryRepository
- CpfValidationBridge
- CpfExportBridge

## 3. Generator

- StoryOutlineGenerator
- SimplePlotGenerator
- ChapterGenerator
- WorldRegionGenerator
- MapGenerator
- BossGenerator
- ChapterStoryGenerator
- CharacterGenerator
- SectionGenerator
- EventGenerator
- DialogueGenerator
- EncounterGenerator
- RewardGenerator

## 4. 共通インターフェース案

```php
interface ContentGeneratorInterface
{
    public function supports(string $nodeType): bool;

    public function validateInput(
        GenerationContext $context,
        GenerationRequest $request
    ): ValidationResult;

    public function generate(
        GenerationContext $context,
        GenerationRequest $request
    ): GenerationResult;
}
```

## 5. CPF-001 初回実装範囲

- CPFプロジェクト作成・読込
- ノード作成・更新
- ステータス遷移
- 承認・却下
- ロック・解除
- バージョン管理
- 生成履歴
- 依存関係登録
- 影響範囲一覧
- JSON差分
- 部分再生成要求
- CLI
- 自動試験

## 6. 初回対象外

- AIによる本文生成
- 会話本文生成
- マップ自動生成
- キャラクター自動命名
- イベント自動生成
- GUI

CPF-001では生成結果を安全に管理する器を先に完成させる。

## 7. CPF-002 正式実装範囲

- Story Importer
- Story Structure Analyzer
- Plot Generator
- Chapter Generator
- Story Preview Rebuild
- 現行版・候補版の差分プレビュー
- 改善方針、再生成範囲、変更許可範囲の指定
- LOCKED／manual_fields／Story Milestone保護
- 変更理由・影響範囲・警告・評価の表示
- 全体採用、章単位採用、フィールド単位採用、却下、再生成
- 単一章再生成後の全体整合性再検証

実装順序は `Story Importer → Structure Analyzer → Import Safety Hardening → Plot/Chapter Generator → Preview Rebuild → Partial Adoption` とする。

### CPF-002A Import Safety Hardening

- Import JSON Schema / strict type validation
- Project-level import lock
- staging transaction / atomic commit / rollback
- child Node synchronization and ARCHIVED/SUPERSEDED handling
- Milestone single-source-of-truth conversion
- versioned snapshots with hashes and latest pointer
- internal ID / display name separation
- dependency batch rebuild and orphan cleanup
- idempotency, failure injection, concurrency, and boundary tests

CPF-002AはPlot Generatorの前提条件であり、任意の改善項目ではない。
