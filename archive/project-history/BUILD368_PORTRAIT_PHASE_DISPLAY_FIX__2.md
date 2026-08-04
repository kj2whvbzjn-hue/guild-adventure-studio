# Build 368 — Portrait Phase Display Fix

## 不具合
iPhone縦画面の開発者モードで、開発ホーム画面が他フェーズでも常時表示され、拠点・リザルト等へ重なっていました。透明ではない画面要素が操作対象を覆うため、一部ボタンも反応しない状態でした。

## 修正
- `.dev-workspace` は通常非表示を維持
- `body[data-phase="devhome"]` の場合だけ開発ホームを表示
- 拠点、イベント、戦闘、リザルトの同時表示を防止
- 重なりによるタップ阻害を解消
- Build表示を368へ更新

## 変更範囲
- `formal-v03/index.html`
- Studio、Export形式、セーブ形式、Battle Core計算、旧版は変更なし
