# 実機確認チェックリスト

- [ ] `/studio/`を開き、Service Workerが`/studio/` scopeで登録される
- [ ] Cache Storageに`gks-studio-b474`が作成される
- [ ] `ga-game-*`、`ga-tag-test-*`、`ga-root-*`をStudio SWが削除しない
- [ ] `/game/`がGA-B471として表示される
- [ ] 正式運用回帰JSONが`passed: true`
- [ ] Studio出力17件を読み込む
- [ ] production 16/16
- [ ] validation 1/1期待拒否
- [ ] console errorなし
