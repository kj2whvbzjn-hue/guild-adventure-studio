# DEC-0030 — GitHub Pages自動確認・配置監査証跡ZIP

- Status: APPROVED / IMPLEMENTED
- Date: 2026-07-24
- Build: 332
- Priority: HIGHEST NEXT PHASE

## 決定

DEC-0027 Phase 5を進め、Git Data APIによるCommit成功後にGitHub Pages公開HTMLを自動確認し、Commit結果とPages結果を分離記録する。さらにTokenを含まない配置監査ZIPを生成する。

## 安全境界

1. Pages確認は公開URLへの読取りのみとする。
2. Commit成功とPages未確認を別状態として保存する。
3. Tokenは監査JSON、ログ、ZIPへ保存しない。
4. 旧／新Commit SHA、変更ファイルSHA-256、削除0、force=falseを証跡化する。
5. GitHub書込みは従来どおり「配置実行（人間承認）」後だけ許可する。
6. CORS、反映遅延、ネットワーク障害時はCommitを失敗扱いに戻さない。
