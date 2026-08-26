# Development Project AI Execution Protocol

Development Projectを使う作業だけで読む条件ポリシー。通常の調査やSource編集では起動時に読まない。`AI_START.md`の共通原則に追加して適用する。

## 1. 正本の分離

- Development Project JSONは「何を、どの順序・依存関係・承認状態で作業するか」の正本である。
- 永続正本はGit canonical path `development-project-data/<workspace.id>.json` の1系統だけとする。Registry / Session / localStorage / cacheを本文の復元元にしない。
- `authority.version` / `authority.instance_id` / `authority.canonical_path`を必須とし、競合検知はGit canonical fileのSHAを使用する。Project独自revisionは持たない。
- authority欠落、instance不一致、Git SHA競合、複数canonical候補は自動migration・自動勝敗判定・別Snapshot復元をせずFail Closedする。
- Source / Game実ファイルは現在の実装の正本である。
- Projectに存在しないTaskを推測で作成・実行せず、順序・依存関係を独自変更しない。

## 2. 対象Project

1. HumanがProject IDまたはDevelopment Project JSONを明示した場合はそれを使用する。
2. Source内Projectを候補にする場合もauthorityを検証する。
3. 複数案件・複数instanceから一意に決められない場合はFail Closedする。
4. `workspace.ai_attention=Exclude`は自動実行しない。
5. `lifecycle.status=Active`以外は自動実行しない。

## 3. Development Task work_type

- `DEVELOPMENT_ONLY`: Projectの工程・仕様・Decision・Task・Check・History等だけを更新する。
- `GAME_DATA`: Game Dataのみ。`GAME_DATA_UPDATE`手順へ対応付ける。
- `SOURCE_UPDATE`: Studio / Game本体、AI運用文書、検査基盤等のSourceを変更する。

1 Taskに複数work_typeを混在させない。別work_typeが必要なら安全に停止し、Task分割案を統合JSONへ記録する。Development Task自動実行では`HYBRID`を使用しない。

## 4. 実行可能Task

Taskは次をすべて満たす場合だけ実行できる。

- `status`が`Todo`または`Doing`
- `box_id`とArchitecture Node参照が実在する
- `depends_on`がすべて`Done`
- `requires_human_approval=true`なら`approval.status=Approved`
- `work_type`が正式値
- ProjectがActiveかつAI対象
- workflowが実行を禁止していない

複数候補は`execution_order`昇順、次にTask ID辞書順。なお一意に判断できない場合はFail Closedする。

旧schemaで実行メタデータが不足するTaskは一般則で自動実行しない。HumanがTaskを明示した場合、または案件内にHuman承認済みの一意な暫定順序がある場合だけ使用できる。

## 5. 1回の実行範囲

安全側の既定は1 Taskである。ただし、次の条件を**すべて**満たす場合だけ、同一セッションで次Taskへ連続着手してよい。

- 次Taskを含め、各Taskが開始前から個別に実行可能である
- Human承認が必要なTaskはすべて事前に`Approved`
- 同一`work_type`かつ同一成果物経路である
- Task間に追加のHuman checkpointがない
- 先行Taskの結果によって後続Taskの仕様・Acceptance Criteria・対象範囲が変化しない
- 各TaskのAcceptance CriteriaとGateを独立して検証・記録する

1件でもFailure / Blocked / 不確実性が出た時点で連続実行を停止する。連続実行を理由にGate / Test / Security条件を省略・弱体化しない。

## 6. work_typeごとの成果物

`DEVELOPMENT_ONLY`:
- Development統合JSONを必須成果物とする。
- Source更新ZIP、Game成果物、Build更新、`package_manifest.json`変更を行わない。

`GAME_DATA`:
- `GAME_DATA_UPDATE`のProject JSON / Gameデータ配置手順を使用する。
- Development統合JSONも返す。
- Studio Source更新ZIPへGame Dataを混在させない。

`SOURCE_UPDATE`:
- `AI_START.md`と成果物ポリシーの`SOURCE_UPDATE`手順を使用する。
- Development統合JSONも返す。
- 実装変更は`implementation_records`へBuild、Task、検査証跡を記録する。

## 7. Development統合JSON契約

- `schema_version`は対象Projectの現行schemaに合わせる。
- `workspace.id`と`authority.version / instance_id / canonical_path`を作業開始時の正本と一致させる。
- `updated_at`をauthority判定に使わない。
- 既存ID付きRecord更新は部分patchでなく完全Recordを返す。
- `project_context / current_focus / source_baseline / lifecycle / workflow`を更新する場合も完全Objectを返す。変更不要ならkeyを出さない。
- workflow Human承認は前進のみ。Lifecycle変更は通常のAI統合JSONで行わない。
- 新規Recordは必須fieldと参照整合性を満たす完全Recordにする。
- `history`へ今回の結果を1件以上追加する。
- 実施した検査だけを`checks`へ記録し、未実施を`Passed`にしない。
- Failed Check解消時は元Failedを書換えず、Passed/Waived Checkの`resolves_check_ids`で解決関係を持つ。
- Source / Game実装を変更した場合だけ`implementation_records`を追加する。
- Development JSON生成だけを理由にSource ZIPやmanifestを変更しない。
- 安全に値を確定できなければFail Closedする。

## 8. Autonomous Correction

Autonomous CorrectionはCurrentの唯一の正規経路へ収束させるための限定手順であり、Testを通すための互換層・例外緩和ではない。

### 候補条件

次をすべて満たす場合だけCorrection候補を提示できる。

- Failure Signatureが再現可能
- 原因がCurrent Sourceの決定的欠陥へ一意に追跡可能
- Currentの既存正式API / Contract / Owner境界へ戻すだけで修正可能
- Game仕様、Balance、Game Data意味、Schema意味、Security境界を変更しない
- Test / Gate / Acceptance Criteriaを変更・弱体化しない
- ファイル削除不要
- 同一Failure Signatureの試行が2回未満

Human明示指示なしにCorrection Taskを生成しない。

### Human承認

`prepare`にはHumanの明示指示が必須。Humanが**Correction Taskの生成だけ**を指示した場合、生成Taskは`approval=Pending`とする。

Humanが同じ明示指示内で、対象Failure/Correctionを特定したうえで**生成後のTask実行まで承認**した場合は、その指示をTask単位承認として記録して`approval=Approved`にしてよい。AIが曖昧な「進めて」等から実行承認を推測してはならない。

### Compatibility Budget 0 / Exception Budget 0

既存基準を維持し、緩和しない。

- legacy / compat / fallback / shim / adapter / alias、dual-read / dual-write、`try new -> catch old`、silent recovery、廃止API wrapperを新設しない。
- エラー処理自体がAcceptance Criteriaでない限りproduction codeの局所`catch`数を増やさない。
- Budget違反はFail Closed。
- 本当に必要なMigration / CompatibilityはHuman承認された専用Taskへ分離し、対象Versionと終了/削除条件を持たせる。

### 機械判定

```sh
python3 -S -B tools/development/autonomous-correction.py analyze --project <Development Project JSON> --check-id <Failed Check ID>
python3 -S -B tools/development/autonomous-correction.py prepare --project <Development Project JSON> --check-id <Failed Check ID> --output-project <working Development Project JSON> --human-authorized --human-instruction "<Humanの明示指示>"
python3 -S -B tools/development/autonomous-correction.py budget --baseline-source <Correction baseline> --target-source <Correction target>
```

同じ明示指示がTask実行まで承認する場合は`prepare`へ`--human-approve-execution`を追加する。曖昧な指示では使用しない。

CorrectionのSource差分はTargeted -> Quick -> `accept --context update` -> 必要なFull / Releaseを実行する。Compatibility / Exception BudgetがPASSしなければ破棄する。Correction Artifact生成だけで元Failedを解決せず、Human Apply後のCurrent Sourceで元E2Eを独立再実行して解決する。同一Failure Signatureで2回失敗したら停止する。

## 9. 完了報告

通常報告に加えて以下を明示する。

- Development Project ID
- 実行Task ID / work_type（連続実行時は全件）
- 各Taskの最終statusとAcceptance Criteria結果
- Development統合JSONとStudio取込経路
- 連続実行した場合は、5章の条件を満たした根拠
- 次の未実行Taskがある場合はその状態
