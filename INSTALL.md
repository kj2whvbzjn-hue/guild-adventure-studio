# 検証モジュールの導入

現行の導入対象は `studio/index.html` です。

以下のファイルを `studio/modules/verification/` へ配置します。

```text
modules/verification/verification-guide.css
modules/verification/verification-guide.js
modules/verification/ai-export.js
```

`studio/index.html` の `<head>` 内へ追加します。

```html
<link rel="stylesheet" href="modules/verification/verification-guide.css">
```

`</body>` の直前へ追加します。

```html
<script src="modules/verification/verification-guide.js"></script>
<script src="modules/verification/ai-export.js"></script>
```

通常は次の補助ツールを使用できます。

```bash
python tools/apply_to_project.py .
```

補助ツールは `studio/index.html` が存在する場合だけ更新し、同じ参照を重複追加しません。
