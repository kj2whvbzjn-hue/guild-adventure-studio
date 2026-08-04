# AI Gateway v0.8

## 目的
外部AIが迷子になった際に、必要な基本方針・プロジェクト状態・検証結果・ソース範囲を小さな単位で取得できる読み取りAPIを完成させる。

## 追加
- `/ai/status`
- `/ai/project`
- `/ai/validation`
- `/ai/handover`
- `/ai/file-range`
- Request ID / セキュリティヘッダー
- 部分取得は最大500行

## 安全性
- Bearerトークン必須
- 許可ファイルのみ
- 外部への自動送信なし
- スナップショット更新はStudioの明示操作のみ
- Human Approvalを維持
