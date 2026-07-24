# DEC-0027 — GitHub差分配置・公開自動化計画の正式採用

- 状態: 決定済
- 判断: 採用
- 決定日: 2026-07-24
- 対象: GK Studio本体のGitHub Pages用Repositoryへの更新配置
- 正本:
  - `GITHUB_DEPLOY_IMPLEMENTATION_PLAN.md`
  - `GITHUB_DEPLOY_OPERATION_PROCEDURE.md`
  - `GITHUB_DEPLOY_SECURITY_SPECIFICATION.md`
  - `GITHUB_DEPLOY_ACCEPTANCE_CHECKLIST.md`

## 決定

手動で多数ファイルをGitHubへアップロードする運用を廃止し、Studio内の「スタジオ更新配置」から更新ZIPを検査し、GitHub上の既存ファイルと比較して、追加・変更対象だけを明示承認後に配置する方式を正式採用する。

## 必須原則

1. 初期版では削除操作を実装しない。
2. `.git/`、`.github/`、秘密情報、プロジェクトデータ、隠しファイルを配置対象から除外する。
3. Tokenは永続保存せず、タブ内メモリだけで扱う。
4. `index.html`を必須ファイルとする。
5. 配置前にパス正規化、ZIP Slip、重複パス、ファイル数、容量、SHA-256を検査する。
6. 差分一覧と重要ファイル警告を表示し、人間の明示承認後のみ配置する。
7. 更新ログ、対象SHA、Commit SHA、失敗点を監査証跡として保存する。
8. GitHub Pages公開確認は配置成功と分離し、公開反映未確認を成功扱いしない。
9. 部分更新リスクを低減するため、Git Data APIによる単一Commit方式を最終方式とする。
10. Contents API逐次更新は移行実装としてのみ許可し、正式完了条件にはしない。

## 人間側の必須作業

- Owner、Repository、Branch、配置先を確定する。
- Fine-grained Personal Access Tokenを作成する。
- RepositoryのContents Read/Write権限を付与する。
- GitHub Pagesの公開元を設定する。
- 初回基準一式をRepositoryへ登録する。
- 配置差分を確認し、明示承認する。

## 実装段階

- Phase 0: 設定・前提条件確定
- Phase 1: 安全なZIP解析・配置候補作成
- Phase 2: GitHub差分取得・SHA比較
- Phase 3: 明示承認・監査ログ
- Phase 4: 単一Commit配置
- Phase 5: Pages公開確認・失敗復旧
- Phase 6: GitHub Actionsによる監査・配布自動化

## 完了判定

`GITHUB_DEPLOY_ACCEPTANCE_CHECKLIST.md`の必須項目がすべてPASSし、正常系・異常系・途中失敗・再実行・競合試験の証跡が保存された時点で正式実装完了とする。
