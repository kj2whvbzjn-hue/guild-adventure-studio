# Build 472.24 — AI用Battle Packageひな形

## 目的

AIへそのまま渡し、戦闘検証データ作成を依頼できる空のBattle Packageひな形ZIPをStudioから出力する。

## 追加

- 戦闘検証専用ファイル欄に「AI用Battle Packageひな形ZIPを出力」を追加
- ZipCore Writerで `GK_BattleVerification_AI_Template_v1.0.0.zip` を生成
- `manifest.json`
- 空の `execution_plan.json`
- `README_AI.md`
- `SPECIFICATION.md`
- `ai/REQUEST_TEMPLATE.md`
- rosters / tests / opponent_sets / benchmarks の配置案内

## 方針

- 人間はZIPをAIへ渡し、作成したいテスト内容だけ依頼する
- AIは同じZIP構造のままリソースと実行計画を追加して返す
- 未使用リソースはエラーにしない
- 実行対象は `execution_plan.json` のjobsだけで決定する
- 初期実行対応はbattle-testを前提とする

## 非変更

- Battle Package Reader
- 一括実行
- 結果ZIP
- 既存個別JSONひな形
- GitHub配置
- PHP Export
- 戦闘計算
