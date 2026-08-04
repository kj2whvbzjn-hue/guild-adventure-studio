# Build 364 — Title Continue & Settings Integration Fix

仕様ライブラリ V9 の参照優先順位に従い、既存ゲームロジックを変更せずタイトル導線を修正した保守ビルドです。

## 修正内容
- `つづきから` がブラウザ保存を読み込み、拠点へ遷移する処理を独立関数として再構成
- 保存がない場合に明確な案内を表示
- タイトル・設定・拠点・イベント・戦闘・リザルトのイベント登録を一箇所へ統合
- 重複していたイベント登録を削除
- Build表記とセーブ内 `gameVersion` を Build 364 に統一
- 既存セーブ Version 1、戦闘ロジック、Studio、Export、旧版は変更なし

## 検査
- JavaScript構文検査: `node --check` 合格
- 更新対象: `formal-v03/index.html`
