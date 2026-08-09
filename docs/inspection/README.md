# 検査体制

検査は目的別に3段階へ分ける。

## quick

通常の編集後に実行する。必須入口、JSON、リンク、主要メタデータ、重要ランタイム、削除マニフェスト、パッケージマニフェストに加え、重要ランタイムJavaScriptと検査基盤Pythonの軽量構文検査を行う。

全JavaScript・全PHP・全Pythonの網羅構文検査は`full`/`release`で維持する。Quickから検査能力を削除するのではなく、日常検査と配置前完全検査の責務を分離する。

```bash
python3 tools/inspection/run.py quick
```

Quick検査基盤そのものを変更した場合は、独立回帰テストも実行する。これは日常Quickや既存Fullの正式ゲートには追加しない。

```bash
python3 tools/inspection/test-quick-framework.py
```

## full

GitHubへ配置する前に実行する。quickに加え、構成、共有資産、依存関係、実行境界、配置定義、ルート保護、`shared/tests/test-registry.json`の現行release gate、GitHub Pages候補を確認する。

全JavaScript・全PHPの構文検査は検査対象を減らさず、各ランタイム1プロセスで一括解析する。Python検査子プロセスは標準ライブラリ専用の`-S -B`で起動し、外部site初期化の影響をFull内部へ持ち込まない。

```bash
python3 -S -B tools/inspection/run.py full --report reports/inspection-full.json
```

## release

公開パッケージを作る直前に実行する。fullに加え、GitHub Pages ZIPを生成してZIP整合性を検査する。

```bash
python3 -S -B tools/inspection/run.py release --report reports/inspection-release.json
```

## 判定規則

- 必須検査が1件でも失敗した場合は終了コード1とする。
- Quickではcritical-runtime manifestに列挙されたJavaScriptだけを構文検査し、対象が存在する場合はNode.jsを必須とする。Full/Releaseでは全JavaScript・全PHP・全Pythonの網羅構文検査を必須とする。
- 現行のリリース判定テストは`shared/tests/test-registry.json`の`release_gate`だけを実行する。
- レポートは明示的に`--report`を指定した場合だけ生成し、通常検査で作業ツリーを変更しない。
- 削除可否は検査とは分離し、`DELETE_MANIFEST.txt`の完全一致パスだけを許可する。

既存の`tools/integrity/check-project.sh`と`tools/release/run-approved-flow.sh`は互換入口として残し、この統一ランナーを呼び出す。

## 削除の既定動作

通常更新では削除を行わない。`DELETE_MANIFEST.txt`はコメントのみとし、削除件数0を正常状態とする。

削除が1件でもある場合は、今回分だけを記載した`DELETE_MANIFEST.txt`と、完全一致する人間承認`DELETE_APPROVAL.json`が必要になる。保護領域、20件超、一般指示による承認、削除制御変更との同時実行は不合格になる。

詳細:

- `docs/operations/DELETION_POLICY.md`
- `docs/operations/DELETE_WORKFLOW.md`
- `AI_WORK_RULES.md`

## AI起動ガバナンス

`ai_governance`検査は`AI_START.md`の存在、必須読込順、Gateway・Studio AIエクスポートへの接続を確認する。起動順が欠ける場合は必須失敗となる。
