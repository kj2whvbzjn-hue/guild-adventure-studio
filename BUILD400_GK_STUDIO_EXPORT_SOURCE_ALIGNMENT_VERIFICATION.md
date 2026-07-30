# Build400 GK Studio Export Source Alignment Verification

## Purpose
GK Studioを唯一の正本とし、ゲームがStudio Exportデータを読み込む正式経路へ統一する。

## Implemented
- Build399で追加されたゲーム側の外部スキルデータ正本を削除。
- 独自スキルSchemaと独自索引を削除。
- 起動時のスキル外部読み込み先をGK Studio Export経路へ統一。
- 開発検証用インラインスキルは正式マスターデータではなく検証資材として維持。
- Build番号をBuild400へ統一。
- Save／Export形式、JSONキー、保存形式、ID体系は変更なし。

## Verification
- GK Studio正本原則: PASS
- ゲーム側重複マスターデータ削除: PASS
- Export形式非変更: PASS
- Save形式非変更: PASS
- JavaScript構文: PASS
- ZIP整合性: PASS
- ブラウザ統合検証: 保留（既定方針）
