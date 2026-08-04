# 精査項目4 自動検証記録

## 適用

- 個別Schema: 22件
- Schema割当漏れ: 0件
- Node E2EとPHP Runtimeで同じSchema正本を利用
- schema_version: 1.0.0維持
- additionalProperties: true
- 空配列・空オブジェクト: 許可

## 自動試験

- 最小実データ22ファイル: 合格
- PHP Runtime読込: 合格
- 空文字ID: DATA_SCHEMA_INVALIDで停止
- 既知項目の型違反: DATA_SCHEMA_INVALIDで停止
- 明白な負数: DATA_SCHEMA_INVALIDで停止
- 既存異常系: 継続合格
