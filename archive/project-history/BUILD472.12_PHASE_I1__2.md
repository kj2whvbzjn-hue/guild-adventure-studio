# Build 472.12 / Phase I1

- `runBattleSimulation(input, options)` を新設
- 戦闘計算中核をDOM・保存・描画から分離
- `runBattleTest()` は既存UI互換ラッパーとして維持
- 戦闘数式、保存形式、画面導線は変更なし
- `studio/index.html` と `apps/studio/index.html` を同期

次フェーズへ進む条件:
- 同一Seedで変更前後の主要結果が一致
- 単発戦闘、複数Seed、数式比較が動作
