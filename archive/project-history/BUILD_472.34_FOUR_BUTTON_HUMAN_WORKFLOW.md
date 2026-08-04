# Build 472.34 — Four-button human workflow

Battle画面を人間向けの4操作だけに整理しました。

1. Battle Package ZIPを読み込む
2. 読み込んだPackageを実行
3. 結果Package ZIPを出力
4. 結果Package ZIPを読み込む

既存の詳細UI・QA・個別JSON機能はDOM内に保持し、通常画面では非表示です。既存ロジックは再利用しています。
