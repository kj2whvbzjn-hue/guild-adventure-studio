# 分割Full検査

Full検査を固定シャードへ分割し、各シャードを別プロセス・別証跡として実行する。

## シャード

- `core`
- `manifests`
- `architecture`
- `tests`
- `candidate`

各シャードは、同じ入力ZIP SHA-256、同じ展開ツリーSHA-256、同じcontextでなければ集約できない。
検査前後でソースツリーが変化したシャードは不合格とする。

## 実行例

```bash
for shard in core manifests architecture tests candidate; do
  python3 -B tools/inspection/run-full-shard.py "$shard" \
    --context source \
    --input-zip /outside/source.zip \
    --evidence-dir "/outside/evidence/$shard" \
    --report "/outside/reports/$shard.json"
done

python3 -B tools/inspection/aggregate-full-shards.py \
  --reports-dir /outside/reports \
  --output /outside/full-aggregate.json
```

集約結果は次のいずれか。

- `FULL_PASS`: 全シャード・全項目が合格
- `FULL_FAIL`: 不合格、混在、改変、重複などを検出
- `FULL_INCOMPLETE`: 必須シャードまたは有効なレポートが不足

ゲーム内機能・実機テストはこの検査の対象外。
