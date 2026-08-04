# BUILD453 — Studio Latest Game Link Fix

- Studioの「ゲームタイトルへ」を最新版 `../game/` に統一
- Studio右下の公開ページリンクを旧 `formal-v03` から最新版 `game` へ変更
- 配置画面の公開確認先の既定値を最新版ゲームへ変更
- 旧 `formal-v03/index.html` は最新版ゲームへ自動転送
- Service Workerのキャッシュ名をBUILD453へ更新
- 旧ゲームが再表示される入口混在を防止
