# AI START — Semantic Entrypoint

> **Authority:** このMarkdownはAI向けの入口・説明であり、規範的な運用ルールの正本ではない。唯一の規範的正本は `shared/integrity/ai-operating-policy.json`。内容が競合した場合はJSONを優先する。

## 1. 起動の意味

AIが意味理解のため最初に読むファイルは **`AI_START.md` だけ** とする。

一方、AI Gatewayが機械的に事前取得するファイルは別概念である。現在の機械preloadは `ai-gateway-manifest.json` の `gatewayMachinePreloadFiles` が定義し、規範値は `shared/integrity/ai-operating-policy.json` から取得する。

- `AI_PROJECT_INDEX.json` / `AI_PROJECT_STATUS.json` は参考情報であり、規則の正本ではない。
- `package_manifest.json` はAIが起動時に全文解釈する対象ではない。整合性は機械Gateで検証する。

## 2. READ_ONLY と EDIT

最初に、変更を伴わない調査・レビューか、Source / Game Data / Development Project / 成果物を変更・生成する作業かを判定する。

- `READ_ONLY`: 必要な対象だけを調査する。Sourceや成果物を変更しない限り、編集用の作業種別宣言は不要。
- `EDIT`: 編集前に規範JSONを取得し、その `work_modes` / `work_types` / `conditional_documents` に従って必要な範囲・成果物・検査を確定する。Buildは `package-build.json` から読む。

Gatewayを使わず直接Sourceを扱う場合も、EDITへ入る前に `shared/integrity/ai-operating-policy.json` を読む。

## 3. 条件文書

詳細な人間向け手順は、規範JSONの `conditional_documents` により必要時だけ読む。Markdown側へ運用値を再定義しない。

## 4. 正本とFail Closed

実装・Build・Studio Project Data・公開Game Dataの正本は、規範JSONの `authoritative_sources` に従う。

規範JSON、必要なmachine policy、または必須Gateを取得・検証できない場合、推測で成果物生成・削除・配置へ進まない。

## 5. Test / Gate

起動コンテキストの削減は、テスト削減を意味しない。Test / Gate / timeout / protected change の判定は規範JSONおよびTest Integrityのmachine policyに従い、失敗回避のために弱体化しない。

## 6. 完了

EDITでは、規範JSONが要求するscope、artifact route、検査、削除/除外報告、完了報告を満たしてから完了とする。READ_ONLYでは調査対象、確認結果、未確認事項を明確にする。
