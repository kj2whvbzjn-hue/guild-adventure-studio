# DEC-0021 Repository接続 適用記録

## 決定
PHPゲーム本体はExport JSONやEnvelopeを直接参照せず、`GameMasterRepository`を通じてマスターデータを取得する。

## 実装
- `RecordCollection`: ID索引、`all/count/has/find/require`
- `GameMasterRepository`: 20個のID付きマスターを名前付きコレクションとして公開
- `balance()` / `gameSettings()`: オブジェクト型設定を専用取得
- 未知コレクション、必須ID欠落、Repository入力不正を固有エラーで停止
- Loader→ExportPackage→Repositoryの自動E2Eを追加

## 境界
Repositoryは読取専用。戦闘計算、クエスト進行、セーブデータはこの層へ含めない。

## 結果
Runtime Reliability A-1〜A-5は完了。次工程はProduction Readinessの個別精査。
