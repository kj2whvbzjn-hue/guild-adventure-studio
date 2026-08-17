# SOURCE_UPDATE 適用後完成ツリーGate

## 目的

Studio更新ZIPは「ZIPに存在しない既存GitHubファイルを保持する」overlay方式で配置する。したがって、更新ZIP単体とZIP内`package_manifest.json`が一致しているだけでは、GitHubへ適用した完成ツリーの整合性を保証できない。

本Gateは、更新ZIPを正確な基準完全ソースへStudioと同じファイル分類規則で適用し、**適用後完成ツリーそのもの**をSource Gateへ通す。

## 必須入力

- 更新ツリー: `studio-update.json`、`DELETE_MANIFEST.txt`を含む直接のSOURCE_UPDATE
- 基準: `--baseline-source`または`--baseline-zip`で指定した正確な完全ソース
- `studio-update.json:baseline_source`
- `studio-update.json:target_source`
- `studio-update.json:artifact_id`（`<target studio build>-<target source tree SHA-256先頭12桁>`）
  - `game_build`
  - `studio_build`
  - `package_manifest_sha256`
  - `source_tree_sha256`

基準bindingが一致しない場合は、別のGitHub状態に対する検査結果を流用できないよう停止する。

GKS-B620以降のStudio更新画面も、GitHub差分解析の開始時にHEAD上の`package_manifest.json`を取得してSHA-256を照合し、`package-build.json`のGame/Studio Buildも確認する。CLIで検査した基準と実際の配置先HEADが一致しない場合は、GitHub書込み前に停止する。

## 適用モデル

`shared/integrity/system-file-policy.json`を正本とし、更新ツリーから`studio_upload_classes`（通常は`persistent`）だけを完成ツリーへoverlayする。

- `Export/**` → `game_data`。Studio SOURCE_UPDATEでは適用しない。
- `cpf/src/Export/**`等 → ルート`Export/**`には一致しないため`persistent`。通常ソースとして適用する。
- `studio-update.json` / `DELETE_MANIFEST.txt` / `DELETE_APPROVAL.json` → `update_only`。GitHub完成ツリーへ残さない。
- ZIPにないpersistentファイル → GitHub上に残る。削除するのは有効な`DELETE_MANIFEST.txt`で明示された完全一致パスだけ。

## 判定

適用後完成ツリーへ通常のSource QuickとAcceptを実行する。AcceptはImpact plannerが安全に狭い範囲へ分類できる場合だけ影響テストを選択し、Gate/Schema/共有基盤/未分類差分や保護テスト変更では自動的にFullへ昇格する。更新ZIP単体と適用後完成ツリーで同じFullを二重実行しない。例えば基準に`cpf/src/Export/CpfDemoRuntimeExporter.php`が存在し、更新ZIPからそのファイルとmanifest entryを同時に落とした場合、ZIP単体では整合していても適用後ツリーにはファイルが残るため、`UNLISTED cpf/src/Export/CpfDemoRuntimeExporter.php`としてFAILする。

## 標準コマンド

```bash
python3 -S -B tools/inspection/run.py accept \
  --context update \
  --baseline-source /path/to/exact-baseline-source
```

または:

```bash
python3 -S -B tools/inspection/run.py accept \
  --context update \
  --baseline-zip /path/to/exact-baseline.zip
```

基準指定なしのupdate Gateは許可しない。

## Build / artifact 一意性

- target Studio Buildはbaseline Studio Buildより必ず大きくする。
- 同一Studio Build番号の別内容をSOURCE_UPDATEとして発行しない。
- 適用後完成ツリーの`package-build.json`、`package_manifest.json` SHA-256、source tree SHA-256が`target_source`と完全一致しない場合はFAILする。
- `artifact_id`はtarget source tree SHA-256に結び付き、メタデータだけを差し替えて別成果物として扱うことを禁止する。
- Studio配置時もGitHub HEADのbaseline一致確認後にtargetが前進Buildであることを再確認し、同一Build再適用を停止する。
