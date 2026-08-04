# DECISION APPLICATION — GVF-003 Scenario Validation

- Status: Adopted / Implemented
- Version: GK Studio v1.20.0
- Build: 300

## Decision
シナリオ品質検査を設定駆動型で実装する。章・節・シーン・メインクエストの順序、親子階層の章番号整合、ボス節配置、イベントフラグの先行条件、必須マイルストーンを検査する。

## Policy
- 正式Exportが空の場合はPASSとする。
- 構造・進行不能につながる異常はCriticalとする。
- 必須マイルストーン不足は制作中はWarning、`--strict-milestones`指定時はCriticalとする。
- 検査基準は `schemas/scenario-validation-rules.json` で変更可能とする。

## Required milestones
- CH3: エリシア加入
- CH7: 瘴気解除能力の解放
- CH9: 王妃救出
- CH10: 宰相との最終決戦
