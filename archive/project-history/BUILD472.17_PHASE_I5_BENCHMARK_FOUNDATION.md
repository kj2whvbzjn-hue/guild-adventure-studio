# Build 472.17 Phase I5 Benchmark基盤

## 追加
- battle-opponent-set 読込・出力・一覧・削除
- battle-benchmark 読込・出力・一覧・削除
- 基準編成1件 × 対象編成集合N件のBenchmark実行
- 各組合せの複数Seed試行
- 実行進捗と中止要求
- 組合せ別集計・ランキング
- 完全結果JSON・AI解析用JSON
- Benchmark結果履歴と削除

## 人数仕様
- 1対100、6対6などを固定仕様にしない
- 基準編成・対象編成の配列とcountを使用
- システム上限がある場合のみ上限判定

## Benchmarkの組合せ
- 基準編成の味方側を固定
- 対象編成の敵側を対戦相手として使用
- 対象編成に敵側がない場合、味方側を敵側として使用

## 継続利用
- 既存runBattleSimulation
- 既存可変人数編成
- 既存単発テスト・結果管理
- 旧battle_tests / battle_snapshotsとは別領域
