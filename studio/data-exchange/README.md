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
UI統一ルール:
- Data Exchange都合のネイティブチェックボックスをマスター項目へ追加しない。
- 複数選択はStudio既存仕様に合わせ、項目全体のタップ/クリックで選択状態を切り替える。
- 編集・削除など既存操作は選択操作と分離する。

