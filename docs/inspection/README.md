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



## accept — SOURCE_UPDATEの通常受入

SOURCE_UPDATEのGitHub配置前は、重いFullを機械的に二重実行せず、次の3段階を1つの受入として実行する。

1. **Integrity**: baseline binding、package manifest、Encoding、削除境界、保護テスト/Gate/Schemaの改変を先に確認する。
2. **Impact**: 基準ソースとの差分を保守的に分類し、影響テストだけを選択する。分類不能・共通基盤・Schema・Gate・受入基準変更は自動的にFullへ昇格する。
3. **Full**: Impact plannerがFullを要求した場合、またはrelease時だけ実行する。SOURCE_UPDATEでは適用後完成ツリーに対して1回だけ実行し、更新ZIP単体と完成ツリーで同じFullを重複実行しない。

```bash
python3 -S -B tools/inspection/run.py accept \
  --context update \
  --baseline-source /path/to/exact-baseline-source
```

`accept`は安全強度を下げる軽量モードではない。Impact ruleに確信がない差分は`fallback=full`で必ずFullへ昇格する。公開前の`release`は従来どおりFullを含む。

### Test Integrity / Anti-Tampering

`shared/integrity/test-integrity-policy.json`により、既存の`tests/**`、`tools/inspection/**`、`tools/integrity/**`、`shared/integrity/**`、`shared/tests/test-registry.json`、`schemas/**`等をbaseline基準で保護する。

- Build識別子・そこから導出されるcache tokenだけが変化し、正規化後の全バイトが同一ならBuild追随として許可する。
- 明示許可された機械生成hash台帳（現在は`shared/integrity/critical-runtime-manifest.json`）は、既存entryの構造・path集合・順序が不変で、変更された`size` / `sha256`がbaseline/applied実ファイルの再計算値と完全一致するとGate自身が証明した場合だけ承認不要とする。path追加・削除・変更、非派生フィールド変更、捏造hashは通常の保護変更として扱う。
- それ以外の保護ファイルの変更・削除・新規追加は、更新ZIP外の`TEST_CHANGE_APPROVAL.json`による完全一致パス、baseline SHA-256、updated SHA-256、理由を必須とする。更新ZIP内の承認JSONは拒否する。
- Studio配置時にもGitHub HEADからhashを再計算し、保護変更がある場合は通常の配置確認とは別の人間確認を要求する。
- 追加テスト自体は追加可能だが、release test registryを変更する場合はregistryが保護対象なので承認が必要になる。
- タイムアウト、テスト失敗、成果物不合格は保護テスト改変の承認理由にはならない。仕様変更として人間が明示承認した場合だけ別扱いにする。

### Timeout分類

各release testには個別timeoutを設定し、停止したテスト名を`RELEASE_TEST_TIMEOUT`として特定する。Inspection結果では`failure_kind=timeout`、return code 124として記録し、通常のassertion failureと区別する。ただし必須GateとしてはどちらもFAILであり、timeoutを黙ってskip/warnへ降格しない。

## SOURCE_UPDATEの適用後Gate

`SOURCE_UPDATE`は更新ZIP単体のFull PASSだけでは配置可としない。Studio更新はZIPに含まれないGitHub既存ファイルを保持するため、更新ZIPとその`package_manifest.json`だけが相互に整合していても、適用後の完全ソースで未登録ファイルが発生し得る。

そのため`--context update`では、**更新対象となる正確な完全ソース基準**を必須指定する。

```bash
python3 -S -B tools/inspection/run.py accept \
  --context update \
  --baseline-source /path/to/exact-baseline-source
```

GitHub Download ZIPを直接基準にする場合: 

```bash
python3 -S -B tools/inspection/run.py accept \
  --context update \
  --baseline-zip /path/to/exact-baseline.zip
```

Gateは次を行う。

1. 基準ソース自身のSource Contextと`package_manifest.json`整合性を確認する。
2. `studio-update.json:baseline_source`のBuild、manifest SHA-256、完全source tree SHA-256が基準と一致することを確認する。
3. `target_source`と`artifact_id`が適用後完成ツリーへ一致し、target Studio Buildがbaselineより前進していることを確認する。同一Build番号の成果物再利用はFAILとする。
3. 更新ZIPのうち`system-file-policy.json`で`persistent`に分類されたファイルだけを基準へoverlayする。ルート`Export/**`は`game_data`としてoverlayしない。`cpf/src/Export/**`のようなネストした`Export`ディレクトリは通常の`persistent`ソースである。
4. 承認済み`DELETE_MANIFEST.txt`の完全一致パスだけを適用後ツリーから削除する。
5. 完成ツリーへ通常のSource Quick / Full Gateを再実行する。

基準指定なしの`--context update`はsetup errorで停止する。これにより「更新ZIPから誤ってpersistentファイルを落とし、manifestからも同時に落としたためZIP単体ではPASSする」状態を配置前に検出する。

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
