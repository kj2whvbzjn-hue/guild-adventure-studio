# AI START

このプロジェクトで作業するAIは、**他のファイルを調査・編集する前に、この起動シーケンスを完了すること。**

## 必須読込順

1. `AI_PROJECT_INDEX.json`
2. `AI_PROJECT_STATUS.json`
3. `AI_WORK_RULES.md`
4. `docs/operations/ARTIFACT_SUBMISSION_POLICY.md`
5. `docs/operations/DELETION_POLICY.md`
6. `package-build.json`
7. `package_manifest.json`
8. 必要な実装ファイルだけを読む

## 成果物提出の最重要規則

アップロードを伴う成果物は、管理資料、仕様書、画像、PDF、表計算、単独文書、ソースコードを含め、**必ず1つのZIPで提出する。**

この規則と上記の必須ファイルを取得・確認できない場合、AIは成果物生成を開始してはならない。設定不備として報告すること。

## 正本の扱い

- 現在の実装判断は最新GitHubソースを優先する。
- ビルド識別子は`package-build.json`の各コンポーネント値を参照し、過去資料から推測しない。
- ゲームとStudioは別系列として扱う。
- 過去資料は通常読まない。必要な経緯がある場合だけ対象を限定して参照する。

## 削除

削除は禁止が原則である。一般的な「進めて」「整理して」は削除承認ではない。例外削除は、個別承認と専用手順が揃うまで実施しない。
