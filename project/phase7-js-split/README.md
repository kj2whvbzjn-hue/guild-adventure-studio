# Phase 7 JavaScript段階分割 Step 1

## ビルド

- Game: GA-B475
- Studio: GKS-B478

## ADD

- `/game/assets/js/app-runtime.js`
- `/game-tag-test/assets/js/validation-runtime.js`

## MODIFY

- `/game/index.html`
- `/game-tag-test/index.html`
- `/index.html`
- `/docs/index.html`
- `/studio/index.html`
- `/assets/shared/config/runtime-config.js`
- 4件のService Worker

## DELETE

なし。

## 方針

巨大なメイン実行スクリプトをHTMLから外部ファイルへそのまま移しました。
関数内容、宣言順、イベント登録順は変更していません。
ゲームと検証の差分も維持しています。
