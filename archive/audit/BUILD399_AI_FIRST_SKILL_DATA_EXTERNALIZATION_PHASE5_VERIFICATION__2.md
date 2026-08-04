# Build399 AIファースト・スキルデータ外部化 Phase5 検証

## 実装範囲
- Build398を直接基礎とする。
- 開発用タグ駆動スキルを外部JSONへ配置。
- JSON Schemaを追加。
- スキル索引JSONを追加。
- 起動時に外部スキルデータを読み込み、既存SkillExecutorへ接続。
- 読み込み失敗時はBuild398のインライン開発用データへフォールバック。
- Save／Exportは変更しない。

## AI検証
- JSON構文確認。
- JSON Schema整合確認。
- 索引参照先確認。
- 外部データと実行エンジン接続確認。
- JavaScript構文確認。
- Build番号統一確認。
- ZIP整合性確認。
- ブラウザ統合検証は既定方針により保留。
