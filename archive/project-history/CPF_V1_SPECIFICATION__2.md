# Content Production Framework v1.0 仕様書

文書ID: CPF-SPEC-V1-001  
状態: FROZEN  
仕様版: CPF v1.0  
採用日: 2026-07-24

## 1. 仕様確定

本書をCPF v1.0の正式仕様とし、以降のCPF-001〜007実装は本仕様を基準に行う。
重大な互換性変更はCPF v2.0候補として管理し、v1.xでは後方互換性を維持する。

## 2. 統一Nodeモデル

Story、Plot、Chapter、Map、Boss、Character、Section、Event、Milestoneを共通Nodeとして扱う。

```json
{
  "node_id": "NODE_CH001",
  "node_type": "chapter",
  "status": "APPROVED",
  "version": 1,
  "locked": false,
  "manual_fields": [],
  "rule_version": "1.0.0",
  "generator_id": "chapter-generator",
  "generator_version": "1.0.0",
  "payload": {}
}
```

## 3. Generator Registry

生成器はRegistryへ登録し、node_typeとcapabilityで解決する。
将来のDialogue、Quest、Monster等を追加可能とする。

## 4. Rule Version

すべての生成結果はrule_versionを保持する。
同一generator_versionでもルール変更時は結果差異を追跡できること。

## 5. Manual Override

人間が固定した項目はmanual_fieldsへ登録し、再生成時に上書きしない。
例: join_chapter、personality、speech_style、boss_id、chapter_theme。

## 6. Workflow Graph

生成工程を有向グラフとしてJSON管理する。

```text
Story -> Plot -> Chapter -> Section -> Event
                |-> Map
                |-> Boss
                |-> Character
                |-> Milestone
```

## 7. Story Milestone

重要事件を独立Nodeとして管理し、章・節・イベントへ依存関係を持たせる。
必須マイルストーン欠落はExport不可とする。

## 8. GUI/API準備

CPF-001ではGUI実装を対象外とするが、サービス層とDTOをCLI専用にしない。
将来APIから同一Application Serviceを呼び出せる構造を必須とする。

## 9. 互換性方針

- Node IDは原則不変
- 削除IDは再利用しない
- v1.x内で既存JSONを破壊しない
- 新フィールドは既定値を持つ
- Migrationを用意する
