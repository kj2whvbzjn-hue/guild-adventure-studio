# Inspection Full 安定化 実測報告

## 対象
- 案件: Inspection Full安定化
- 基準ソース: `guild-adventure-studio-main(20260808-233324).zip`
- 基準ZIP SHA-256: `053a7ebc42d3fac038b8e5f1676d3a8912ae10f4c85a074194e46076b2382848`
- Data Exchange DE-10は本案件中は反映保留。

## FI-1 構造解析
標準Fullは統一Runnerから多数の検査を直列起動する。既存資産として5シャード(`core / manifests / architecture / tests / candidate`)と集約器が存在し、改修後も互換性を維持する。

## FI-2 / FI-3 原因
1. Python検査を別プロセスで多数起動していた。
   - 通常Python起動: 約1.44〜1.52秒/回（この解析環境）
   - `python -S`: 約0.03秒/回
   - 検査スクリプト群は標準ライブラリだけで成立するためsite初期化は不要。
2. Full構文検査はJavaScript 102件、PHP 119件をファイル単位で外部プロセス起動していた。
   - 旧JavaScript構文検査: 約9.2秒
   - 旧PHP構文検査: 約6.8秒
   - 大量の短命プロセス起動後、後続Python起動が不安定になる再現があった。
3. `active_test_gate`は31 release tests合計で約10〜12秒（旧起動方式）であり、単独の主原因ではなかった。
4. `github_candidate`本体は軽量だが、大量プロセス起動後にPython起動段階で停止するケースがあった。

## FI-4 / FI-5 改修
- Full/Quick Runnerから起動するPython検査を `-S -B` で隔離。
- `check-test-registry.py`から起動するPython release testsも `-S -B` 化。
- `test_source_zip_binding.py`のネストPython起動も `-S -B` 化。
- JavaScript全件構文検査を `check-full-javascript-syntax.js` の1 Nodeプロセスへ集約。
- PHP全件構文検査を `check-full-php-syntax.php` の1 PHPプロセスへ集約。
- 検査項目自体は削除していない。

## FI-6 / FI-7 回帰
`test-full-framework.py`を追加。
- 正常JavaScript: PASS
- 意図的なJavaScript構文破損: FAILを確認
- 正常PHP: PASS
- 意図的なPHP構文破損: FAILを確認
- 従来Full必須19項目が残っていることを確認
- Python子検査がsite隔離されていることを確認

## FI-8 性能比較
### 改修前
- 標準Full: 120秒枠で完走しないケースを再現。
- JavaScript構文検査: 約9.2秒
- PHP構文検査: 約6.8秒

### 改修後
初回:
- Full wall time: 16.02秒
- 21/21 PASS
- JavaScript構文検査: 169ms
- PHP構文検査: 83ms
- active_test_gate: 3.62秒
- organization: 8.16秒

連続安定性確認:
- 約15.5秒 PASS
- 15.05秒 PASS
- 15.15秒 PASS

注: ChatGPT解析環境ではRunner起動前のsite初期化にArtifact Tool warmupが割り込む場合がある。これはソースFull内部とは分離して扱う。`python -S -B`による実測ではFull本体の安定完走を確認した。

## FI-9 全体回帰
- Inspection Quick: 1.92秒 / 10/10 PASS
- Inspection Full: 21/21 PASS
- Data Exchange Quick: PASS
- Data Exchange Full: PASS
- package manifest: PASS
- critical runtime: PASS
- 分割Full 5シャード: 全PASS
- aggregate: `FULL_PASS`, errors=0

## 判定
FI-0〜FI-9はPASS。検査能力を削らず、Fullの主要な不安定要因を除去した。
次はFI-10として更新ZIPを反映し、GitHub反映後ソースで再実測する。
