# RELEASE NOTES v0.7.0

Release: Version 4.4 Update Stable

変更:
- バージョン識別子を4.4へ完全切替
- Build ID 070追加
- Service Worker URLキャッシュバスター追加
- 新キャッシュ領域へ移行
- manifest start_url/id更新
- 即時Service Worker有効化
-旧キャッシュ自動削除
- Network First継続
- 強制確認URLを標準化

データスキーマ:
変更なし

既存LocalStorage:
同じドメインで開く限り原則維持

注意:
旧ホーム画面PWAは旧Service Workerを保持することがあるため、初回のみ削除・再追加を推奨
