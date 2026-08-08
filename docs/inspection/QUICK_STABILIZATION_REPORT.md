# Quick検査安定化 実測報告

基準ソース: `guild-adventure-studio-main(20260808-210720).zip`

## 原因

1. `tools/inspection/check-context.py` がStudio versionを `GKS-B484` に固定しており、現行 `package-build.json` の `GKS-B485` と不整合だった。
2. 旧Quickは全JavaScript（約101件）・全PHP（約119件）・全Pythonを毎回構文検査していた。
3. JavaScript/PHPはファイル単位で外部プロセスを起動するため、Quick一回で200回超のランタイム起動が発生していた。

## 修正

- Studio versionは `package-build.json:studio_build` を正本として判定する。
- Quickのsyntax検査はcritical-runtime manifestに登録されたJavaScriptと、検査基盤Pythonに限定する。
- 全JavaScript・全PHP・全Pythonの網羅構文検査は既存Full/Releaseにそのまま維持する。
- Quick Framework専用回帰テストを独立追加し、既存Fullの正式ゲートには追加しない。

## 実測

同一実行環境での測定:

- 修正前Quick: 70秒の外側測定枠でも完走せず。JavaScript全件検査完了時点で約35秒、その後PHP全件検査中に制限超過。
- 修正後Quick: 22.32秒でPASS。
- 修正後Quick: 10ゲート、failed=0、warnings=0。

外部ランタイム起動の概算:

- 修正前: JavaScript約101 + PHP約119 + 各検査サブプロセス等で200回超。
- 修正後: critical JavaScript 4件 + 各軽量検査サブプロセス。critical PHPは現行0件。

## 回帰テスト

`tools/inspection/test-quick-framework.py` で以下8ケースを検証:

1. 現行Studio versionを受理
2. 将来versionを `package-build.json` から追従して受理
3. 不一致versionを拒否
4. 更新制御ファイル欠落を拒否
5. critical JavaScript構文エラーを拒否
6. critical runtimeファイル欠落を拒否
7. package manifest hash不一致を拒否
8. 保護ファイル削除要求を拒否

結果: `QUICK_FRAMEWORK_REGRESSION_OK cases=8`

## 保護機構

Quickから削除していない検査:

- inspection context
- AI governance
- encoding
- required paths / JSON
- HTML links
- package metadata
- critical runtime
- package manifest
- source tree immutability/evidence

全件構文検査は削除せずFull/Release側に維持する。
