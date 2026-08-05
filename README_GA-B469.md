# GA-B469 正式運用環境分離

- Studio build: GKS-B473（変更なし）
- Game build: GA-B469
- `SKL-TEST-INVALID` を `environment: validation` へ分離
- production定義は全件コンパイル成功を要求
- validation定義は期待どおり拒否されることを要求
- 固定production定義が0件であることを継続監査
