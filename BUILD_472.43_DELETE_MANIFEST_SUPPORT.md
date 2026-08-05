# Build 472.43 DELETE_MANIFEST Support

- 汎用削除マニフェスト方式
- ZIPルートの `DELETE_MANIFEST.txt` を検出
- 1行1パス
- 空行と `#` コメントを無視
- 末尾 `/` はフォルダ配下、その他は完全一致
- ManifestがないZIPでは削除チェックを無効化
- Manifest自体はGitHubへ配置しない
- 保護ファイル・危険パス・配置先外は削除不可
- 実行前にルールと削除対象を確認
