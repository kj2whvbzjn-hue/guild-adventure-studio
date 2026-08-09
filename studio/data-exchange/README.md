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

### DE-11 stale/conflict precedence
- record_hashesによりExport後の正本変更を確認できた同一IDは、通常の `conflict` より `stale_source` を優先する。
- 同一レコードを `conflict` と `stale_source` の二重計上にしない。


## DE-13 影響範囲Preview
- Dry Run結果からApply前の影響範囲を表示する。
- 区分: 直接変更 / 参照追加 / 既存参照 / 参照差異 / 影響なし。
- conflict / stale_source等の直接変更にはcanonicalized recordのフィールド単位diffを表示する。
- Previewは表示専用で、正本データを変更しない。
- Merge単位はレコード単位のままとし、diffは判断材料として表示する。


### DE-13 AI-first運用
- 人間向け画面は件数要約のみとし、全参照一覧は展開しない。
- `GPT用影響範囲JSONを出力` で `GKS_DATA_EXCHANGE_IMPACT / 1.0.0` を保存する。
- JSONは direct_changes / references.additions / references.existing / references.differences / unaffected_datasets を全件保持する。
- フィールドdiffと元Data Exchange Packageの識別情報も保持し、GPTが追加の画面確認なしに解析できることを優先する。


### DE-13 AI Impact Export download fix
- GPT用影響範囲JSONはUTF-8 JSON Blobを生成して既存 `downloadBlob(blob, name)` に渡す。
- 共通ダウンロード関数の引数順を維持し、iPhone/Safariでも保存可能な経路に統一する。


## DE-14 DataExchangeTransaction
固定手順:
current data → deep clone → Safe Merge candidate → normalize → Data Exchange validation → candidate hash → Backup → commit → persist。

- Backup失敗時はcommitしない。
- candidate validation失敗時はBackup/commit/persistを行わない。
- persist失敗時はcommit前のdataへrollbackする。
- `beforeHash` / `candidateHash` / `afterHash` をTransaction結果として保持する。
- 既存AtomicExportUpdaterは変更せず、Data Exchange専用層として独立実装する。


## DE-15 Safe Merge
- 新規ID: add
- 同一内容: unchanged
- 同一ID差分: conflict。未解決のままApply不可。
- Conflictは `keep`（既存維持） / `import`（Import採用）をレコード単位で明示選択する。
- 一括「全て既存維持」「全てImport採用」も提供するが、内部PlanはID単位choiceとして保持する。
- Import採用時は現在側にしか存在しないフィールドを保持し、古いImportによる新フィールド消失を防止する。
- 現在側にもschema安全リストにも存在しない未知フィールドがImportに来た場合はApply停止。
- DELETEは引き続きunsupported。


## DE-16 Data Exchange Audit / Undo
- Apply成功後のみ `GKS_DATA_EXCHANGE_AUDIT / 1.0.0` Sessionを確定する。
- 記録: import_session_id / timestamp / package_hash / source filename / before_hash / candidate_hash / after_hash / dataset / added / changed / kept / conflict choices。
- Undo用にはProject全体コピーではなく、追加IDのremove listとImport採用前recordだけを保存する。
- Undoは現在Project hashがSessionのafter_hashと完全一致する場合のみ許可する。
- Undo候補を再構成後、before_hash一致・構造検証・Backup・commit・persist・再検証を行う。
- Auditは最大10Session、既定3MiBまで。古いSessionから自動整理する。
- GPT用Audit JSONを出力できる。


### DE-16.1 Audit Undo device regression fix
- DE-15で更新されたcoreのブラウザキャッシュ番号を更新し、旧DE-14 Planが残る状態を防止する。
- Auditは旧Plan `{ids, add_count}` でもTransaction結果から `added` / `undo_snapshot.remove_ids` を復元できる。
- 実機で検出した「applied_idsはあるがundo_snapshotが空」を回帰テスト化する。


### DE-16.3 Undo semantic hash fix
- 実機で `Undo候補hashが元状態と一致しません` を検出。
- 原因は Studio `persist()` が毎回 `project.updated_at` と `history` を更新するため。
- Data Exchange Transaction/Undo の projectHash はゲーム・マスターデータの意味的状態を比較し、`project.updated_at` と `history` を除外する。
- モンスター等の実データ変更は引き続きhash差分として検出する。
- persist由来メタデータだけが変化した状態で `canUndo()` が成功する回帰テストを追加。


### DE-16.4 Dataset-scoped Undo verification
- 実機でDE-16.3後も `Undo候補hashが元状態と一致しません` を確認。
- 現在Projectの `after_hash` 一致チェックは維持し、Apply後に別編集があればUndoを拒否する。
- Undo復元の正しさはProject全体before hashではなく、対象Datasetの `before_dataset_hash / after_dataset_hash` で検証する。
- これによりStudio側の非Dataset運用状態が変化しても、対象マスターを正しく元状態へ戻せる。
- 旧SessionはDataset hashが無い場合のみ従来のbefore_hash検証へフォールバックする。


### DE-16.5 Audit runtime cache bust
- DE-16.4実機で `GKSDataExchangeAudit.datasetHash is not a function` を検出。
- 最新GitHubソースには `datasetHash` 定義・export・UI呼出が揃っていたため、旧Audit JSキャッシュ残留と判定。
- `data-exchange-audit.js` cache versionを v3→v4、`data-exchange-ui.js` を v14→v15 へ更新。
- 機能ロジックは変更しない。


## DE-17 Monster Vertical Slice Gate
MonsterをData Exchangeの基準Vertical Sliceとして固定する受入Gate。

Gate対象:
- Monster Export / package hash / dependency read_only
- Import Dry Run: add / unchanged / conflict
- AI-first Impact JSON
- conflict keep / import
- stale_source blocking
- broken_reference blocking
- read_only差異 blocking
- DELETE v1 blocking
- DataExchangeTransaction
- Audit Session / Undo / undone記録

`monster_vertical_gate` がQuick/Fullの双方でPASSしない限り、DE-18 Tag / Skill拡張へ進まない。

### DE-17 Reload restoration
- Safe Apply後のAudit Sessionは既存のproject-scoped `localStorage` を正本として再利用する。
- Studio再読込時に `renderAuditPanel()` を自動実行し、保存済みAudit SessionとUndo可能状態を復元する。
- Safari等で初期表示が追随しない場合に備え、GitHub配置履歴と同じ再読込パターンで `履歴を再確認` を提供する。
- Importファイル選択・Dry Run結果・競合選択などの一時UI状態は復元対象外とする。


## DE-18 Tag / Skill Vertical Slice Gate
Monster Vertical Sliceで固定した安全条件をTag / Skillへ拡張する。

追加した安全条件:
- Tagを主DatasetとしてExport / Dry Run / Safe Merge / Transaction / Audit / Undo可能
- Tagの `parent_id` / replacement / `category_id` 参照切れをblocking
- Skillを主DatasetとしてExportし、参照Tagをread_only dependencyとして同梱
- SkillのTag参照切れ・read_only差異・stale source・DELETE v1をblocking
- Tag / Skillの新規追加時、既知の安全なトップレベル項目以外をSafe Apply前に拒否
- 既存Monster Vertical Gateを同じQuick/Fullで回帰

専用Gate: `tag_skill_vertical_gate`

DE-18完了後もData Exchangeのwritable Datasetは1分類、Dependencyはread_only、競合はkeep/import明示選択を維持する。


## Story nested partial exchange (GKS-B491)
- Chapterの既存保存形式 `chapters[].sections[].scenes[].dialogues[]` は変更しない。
- Data Exchange上だけ `story_sections` / `story_scenes` / `story_dialogues` を仮想Datasetとして提供する。
- Sectionは `chapter_id`、Sceneは `chapter_id + section_id`、Dialogueは `chapter_id + section_id + scene_id` を親コンテキストとして持つ。
- SectionのImportは既存 `scenes` を保持し、SceneのImportは既存 `dialogues` を保持する。子配列を巻き込んだ上書きを行わない。
- 親参照切れはApply blocking。既存レコードの親階層変更（re-parent）は未対応としてblockingする。
- Story Editor既存仕様に合わせ、1章20節の上限をData Exchange経由のSection追加にも適用する。
- Transaction / Audit / Undoは仮想Dataset単位の差分を記録し、正本の入れ子構造へ安全に復元する。
