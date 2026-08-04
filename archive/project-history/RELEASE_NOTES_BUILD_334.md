# Release Notes — Formal Build 334

## 方針
DEC-0032を適用し、開発側の運用負荷軽減をP0へ変更。

## 実装
- GitHub GET/HEAD APIの安全な自動再試行
- 429/502/503/504・ネットワーク一時障害に対応
- Retry-After／指数バックオフ
- Request ID・Rate Limit・試行回数の診断表示
- POST/PATCH書込みAPIの自動再試行禁止を維持

## 後順位
初回セットアップウィザード、一般利用者向け導入支援。
