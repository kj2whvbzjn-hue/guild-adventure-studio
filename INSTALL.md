# 手動導入

各Studioフォルダへ以下をコピーします。

```text
modules/verification/verification-guide.css
modules/verification/verification-guide.js
modules/verification/ai-export.js
```

`<head>` 内へ追加:

```html
<link rel="stylesheet" href="modules/verification/verification-guide.css">
```

`</body>` の直前へ追加:

```html
<script src="modules/verification/verification-guide.js"></script>
<script src="modules/verification/ai-export.js"></script>
```

モジュールはDOM読込後に検証ホームと検証ランチャーへ入口を自動追加します。
