# Studio Data Exchange

`GKS_DATA_EXCHANGE` は、既存の全プロジェクトJSON・Game Export・GitHub配置検査とは独立した部分データ交換入口です。

初回実装範囲:
- 専用Envelope
- 専用Schema / Dataset Registry
- Canonicalization / SHA-256 package hash
- Monster任意選択Export
- 関連データ none / direct / recursive Export
- 管理画面の専用入口骨格

DE-8実装済み:
- Import Parser / Dry Run（正本変更なし）
- add / unchanged / conflict / invalid / incompatible / stale_source / broken_reference / readonly_modified 判定
- package_hash検証 / project_id・version互換確認

未実装（次フェーズ）:
- Conflict解決
- Safe Merge / Atomic Apply
- Undo

既存GitHub完成資産は変更しません。
UI統一ルール:
- Data Exchange都合のネイティブチェックボックスをマスター項目へ追加しない。
- 複数選択はStudio既存仕様に合わせ、項目全体のタップ/クリックで選択状態を切り替える。
- 編集・削除など既存操作は選択操作と分離する。


## DE-9実装済み
- DataExchangeIntegrityValidator（Data Exchange専用、既存DataIntegrityValidator非改変）
- project / format / version / schema整合
- ID欠落・重複、unknown dataset、record_count不整合
- read_only差異、参照切れ、DELETE v1拒否
- Applyは未実装。DE-10 Stale / Permission Enforcementへ継続。


## DE-11 Stale Source
- Export時に `base_project_revision` / aggregate `base_hash` に加えて、writable対象の `metadata.record_hashes` を保存する。
- Import時は対象record hashを現在の正本と比較し、Export後に変更されたrecordだけを `stale_source` として個別表示する。
- Project revisionだけが変わり、選択対象record hashが一致する場合はstale扱いにしない。
- `record_hashes` を持たない旧Packageはaggregate `base_hash` で後方互換検査する。
- `stale_source` はApply blockingとする。
