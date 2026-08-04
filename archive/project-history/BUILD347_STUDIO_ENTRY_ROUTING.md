# Build 347 — Studio Entry Routing

## 変更内容

- GitHub Pages のルート `/index.html` を軽量な起動ページへ変更。
- 起動先を `./studio/` に固定。
- クエリ文字列とハッシュを維持して Studio へ遷移。
- `studio/index.html` と Studio 内の「正式版を起動」導線は変更しない。

## 公開構成

- GitHub Pages: `main` / `/(root)`
- 公開ルート → `studio/`
- Studio → 既存のゲーム起動導線
