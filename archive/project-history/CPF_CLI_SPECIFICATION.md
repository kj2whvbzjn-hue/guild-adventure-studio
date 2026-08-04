# CPF CLI仕様

文書ID: CPF-CLI-001  
状態: APPROVED

```bash
php cpf/bin/cpf-project.php create project.json
php cpf/bin/cpf-generate.php plot CPF_PROJECT_001
php cpf/bin/cpf-generate.php chapters CPF_PROJECT_001
php cpf/bin/cpf-regenerate.php chapter CH004
php cpf/bin/cpf-diff.php NODE_CH004
php cpf/bin/cpf-approve.php NODE_CH004
php cpf/bin/cpf-reject.php NODE_CH004 --reason="要修正"
php cpf/bin/cpf-lock.php NODE_CH004
php cpf/bin/cpf-unlock.php NODE_CH004 --reason="設定変更"
php cpf/bin/cpf-impact.php CHAR0007
php cpf/bin/cpf-validate.php CPF_PROJECT_001
php cpf/bin/cpf-export.php CPF_PROJECT_001 Export_candidate
```

## 終了コード案

| Code | 意味 |
|---:|---|
| 0 | 成功 |
| 1 | 入力・検証エラー |
| 2 | 承認ゲート未達 |
| 3 | ロック違反 |
| 4 | 依存関係競合 |
| 5 | GVF失敗 |
| 6 | Export失敗 |
