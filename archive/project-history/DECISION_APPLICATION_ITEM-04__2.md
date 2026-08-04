# DEC-0002 精査項目4 適用記録

- 22 Exportファイルすべてに基本個別Schemaを割当てた。
- Schema正本は `schemas/exports/*.schema.json`、割当表は `schemas/export-schema-map.json`。
- 初期段階は `additionalProperties: true`。空データを許可する。
- 配列レコードは `id` を必須、空文字を禁止。既知項目の型・明白な下限を検証する。
- Node自動E2EとPHP Runtimeは同じSchema正本を参照する。
- ID参照整合性は精査項目5へ分離する。
- schema_versionは1.0.0を維持する。
