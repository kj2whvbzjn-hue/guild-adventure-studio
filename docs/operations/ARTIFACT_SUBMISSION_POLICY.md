# 成果物提出ポリシー — 人間向けガイド

> **Informative only.** 成果物経路の規範的正本は `shared/integrity/ai-operating-policy.json` の `work_types` と `artifact_submission`。このMarkdownや互換JSONへ同じルール値を再定義しない。

## 使い方

1. `AI_START.md`でEDITを判定する。
2. 規範JSONからwork typeを選び、そのwork typeのartifact定義を読む。
3. `requires` / `forbids` / `deployment` / `validation` をそのまま適用する。
4. HYBRIDの場合は規範JSONの分離条件に従い、各系統のGateを独立して満たす。
5. 規範JSONまたは必要なmachine policyを取得できない場合はFail Closedとし、成果物を生成・配置しない。

## Source Updateの検証手順

Studio更新成果物を扱う場合は、`docs/operations/SOURCE_UPDATE_APPLIED_STATE_GATE.md` と `docs/operations/TEST_INTEGRITY_AND_IMPACT_GATE.md` を併用する。baseline/target binding、manifest同期、適用後完成ツリーの検証、protected asset承認などの詳細は各machine policy / Gate実装を正本として確認する。

## Game Dataの検証手順

Game Data成果物を扱う場合は `docs/operations/GAME_DATA_DEPLOYMENT_MANUAL.md` を併用し、Studioの正式取込・配置フローで検証する。

## Authority

- Normative: `shared/integrity/ai-operating-policy.json`
- Compatibility pointer: `shared/integrity/artifact-submission-policy.json`
- Human guidance: this document

競合時はNormative JSONを優先する。
