# Build 472.42 Exact DELETE Rules

- Build 472.41を基準
- 接頭辞一致を廃止
- `archive/` のように末尾 `/` がある場合だけフォルダ配下を許可
- `BUILD_472.01.md` のような指定は完全一致ファイルのみ許可
- 初期許可値は `archive/` のみ
- DELETEは「許可済」、DELETE_BLOCKEDは「許可外」と表示
- 最終確認に許可ルールと削除対象最大20件を再表示
