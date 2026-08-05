# Phase 9 新基準確定・旧構成凍結

## 新しい正式基準

- Game: GA-B479
- Studio: GKS-B482

## 確定事項

- 正式入口：`/`, `/game/`, `/studio/`, `/game-tag-test/`, `/docs/`
- 正式スキルデータ：`/Export/skill/skills.json`
- 旧ページ：`/archive/retired/`
- 正式ゲームとタグ検証のJavaScript分割完了
- Service Workerの領域別キャッシュ分離完了
- Phase 8静的回帰：PASS
- 分割JS直接URL：404なし
- 正式運用回帰JSON：`passed: true`
- console：iPhone単体のため未確認として記録

## 最終整合修正

- game／tag-test共通ナビの`GKS-B475`を`GKS-B482`へ更新
- 正式運用回帰JSON生成側の旧ビルド表記を`GA-B479`へ更新
- 全Service Workerのキャッシュrevisionを更新

## DELETE

なし。
