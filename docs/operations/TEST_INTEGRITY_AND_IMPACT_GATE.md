# Test Integrity / Impact Acceptance Gate

## 目的

SOURCE_UPDATEで、成果物を通すために受入テスト・Schema・Gateを弱める行為を防止しつつ、同一Fullの重複実行や無関係テストの常時実行によるtimeoutを減らす。

安全性の原則は「軽量化のために検査を削除する」のではなく、**安価な改ざん検知を最初に実行し、差分を保守的に分類し、不確実ならFullへ戻す**ことである。

## Stage 1 — Integrity

基準完全ソースを正本に、既存の次の領域を保護する。

- `tests/**`
- `tools/test_*`
- `tools/inspection/**`
- `tools/integrity/**`
- `shared/integrity/**`
- `shared/tests/test-registry.json`
- `schemas/**`
- `studio/data-exchange/tests/**`

Build識別子とそこから機械的に導出されるcache tokenだけが変化し、正規化後の内容が完全一致する場合はBuild追随として扱う。加えて、`shared/integrity/test-integrity-policy.json`で明示許可された**機械生成hash台帳**については、既存entryのpath・順序・membership・schema・purpose・非派生フィールドが不変で、変更された`size` / `sha256`をGate自身がbaseline実ファイルと適用後実ファイルから再計算して完全一致を証明できた場合に限り、人間承認を不要とする。現時点の許可対象は`shared/integrity/critical-runtime-manifest.json`だけである。

それ以外の**変更・削除・新規追加**は、更新ZIPとは独立した外部`TEST_CHANGE_APPROVAL.json`の完全一致パス、baseline SHA-256、updated SHA-256、理由を要求する。更新ZIP内への承認JSON同梱はFAILとする。参照先ファイル自体が保護対象なら、そのファイルのロジック変更に対する承認要求はhash台帳同期とは独立して残る。

明示許可された機械生成hash台帳について、path・membership・非派生フィールドが不変で**derived fieldだけが変化している候補**にもかかわらず、baselineまたは最終配置Treeの参照実ファイルから再計算した`size` / `sha256`と一致しない場合は、通常の保護変更へフォールバックしない。これは`INTEGRITY FAIL`であり、人間承認では解除できない。台帳のmembership/path/非派生フィールド自体を変更する場合だけ、意味変更として通常の保護変更承認対象にする。

Studio配置でもGitHub HEADからbaseline SHA-256を再計算し、**更新ZIPとは別に選択された承認ファイル**と一致することを確認する。外部人間承認のpath / baseline SHA-256 / updated SHA-256 / reasonが完全一致した場合、その承認を成立済みとして扱う。GitHub書込み開始直前にも同じ外部承認を再機械検証し、不一致ならFail Closedとする。完全一致後に同内容の保護変更専用human confirmを重ねて要求せず、通常の配置確認だけを残す。

## Stage 2 — Impact

`shared/integrity/impact-test-policy.json`で差分を分類する。

- Formal AIだけの変更はAI関連release testsとBattle接続テストを実行する。
- Battle Coreだけの変更はBattle/COUNTER/FOLLOW_UP/AURA境界テストを実行する。
- 文書だけの変更は固定の安全テストと静的Gateを実行する。
- Gate、Integrity、Schema、test registry、共有基盤、未分類ファイルは**必ずFullへ昇格**する。ただしStage 1で実ファイル再hashまで完了した機械生成hash台帳同期はgenerated metadataとしてImpact差分から除外する。

分類不能時の既定値は`full`であり、Impact判定を理由に未知の変更を軽量テストだけで通さない。

## Stage 3 — Full

次の場合にFullを実行する。

- Impact plannerが`full`を返した。
- Test Integrityの保護資産に実変更がある。
- releaseを実行する。
- 変更が安全に狭い範囲へ分類できない。

SOURCE_UPDATEでは更新ZIP側と適用後完成ツリー側でFullを二重実行しない。更新ZIP側はbinding、hash、Encoding、分類境界、manifest等を確認し、**機能Fullは適用後完成ツリーで1回**実行する。

## Timeout

release testは個別timeoutを持つ。timeout時は次のように扱う。

- 終了コード: `124`
- Inspection: `failure_kind=timeout`
- Gate判定: **FAILのまま**

timeoutを`warn`や`skip`へ自動降格しない。timeout解消のためにassertや期待値を変更しない。対象テスト名を特定し、実装・fixture・テスト性能のどこが遅いかを修正する。

## 通常コマンド

```bash
python3 -S -B tools/inspection/run.py accept \
  --context update \
  --baseline-source /path/to/exact-baseline-source \
  --timeout 120 \
  --timeout-per-test 30
```

GitHub Download ZIPを基準にする場合は`--baseline-zip`を使用する。

`full --context update`も引き続き利用可能で、明示的にFullを要求した場合は適用後完成ツリーでFullを1回実行する。
