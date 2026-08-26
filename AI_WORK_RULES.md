# AI作業ルール — EDIT向け人間用ガイド

> **Informative only.** 規範的正本は `shared/integrity/ai-operating-policy.json`。この文書に規則値を追加・変更して正本化しない。

## 使い方

`AI_START.md`でEDITと判定した後、規範JSONを読み、今回のwork typeとscopeを確定する。本書はその実行順を人間向けに説明する補助資料である。

1. `package-build.json`で現在Buildを確認する。
2. 規範JSONの `work_modes.EDIT` と `work_types` から必要な宣言、成果物形式、検査を取得する。
3. 規範JSONの `conditional_documents` から今回必要な専門手順だけを読む。
4. 宣言したscope外を便乗修正しない。
5. 必須Gateを実行し、Fail/timeoutを成功扱いへ変更しない。
6. 完了時は規範JSONの `completion` に従って変更、削除/除外、検査結果、成果物経路を報告する。

## 専門ポリシー

削除、Game Data、Development Project、Test Integrity、Encoding、Full分割、Forensic、System file分類などの詳細は、規範JSONの `conditional_documents` に列挙されたmachine policy / human procedureを使用する。ここへ同じ規則を複製しない。
