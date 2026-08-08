# Studio Data Exchange

`GKS_DATA_EXCHANGE` は、既存の全プロジェクトJSON・Game Export・GitHub配置検査とは独立した部分データ交換入口です。

初回実装範囲:
- 専用Envelope
- 専用Schema / Dataset Registry
- Canonicalization / SHA-256 package hash
- Monster任意選択Export
- 関連データ none / direct / recursive Export
- 管理画面の専用入口骨格

未実装（次フェーズ）:
- Import Dry Run
- Conflict解決
- Safe Merge / Atomic Apply
- Undo

既存GitHub完成資産は変更しません。
