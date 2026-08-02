# Build 470.2 検証ガイド・AIエクスポート

ファイル単位で追加できるモジュールです。

- 検証ホームの「使い方ガイド」
- 画面内の `？` ヘルプ
- ガイドMarkdown出力
- AI用プロジェクトZIP出力
- README / project-summary / project / design-cards / references / guides をZIPへ同梱

## 自動適用

```bash
python3 tools/apply_to_project.py /path/to/project
```

`studio/` と `apps/studio/` の両方へファイルを配置し、`index.html` にCSS/JS読込を追加します。
