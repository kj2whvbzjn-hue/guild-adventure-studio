# Runtime Phase 1 タグ受け入れ基盤 実装報告

## 基準
- 開発順序: GA-Build403
- 仕様: V9ライブラリ（タグシステム設計書 Version 5.1）
- データ形式: GK STUDIO BUILD406のJSON構造

## 実装内容
- GK STUDIOプロジェクトJSONの `tag_categories` と `tags` を読み取る、読み取り専用のランタイムタグ辞書を追加。
- タグID、名称、エイリアスからタグIDを解決する索引を追加。
- カテゴリ、親子関係、ロック、廃止、推奨置換タグをランタイムで参照可能にした。
- 親子関係は管理情報として保持し、ゲーム効果の継承には使用しない。
- あらゆるデータ内の `tags` 配列を共通走査し、未登録タグ参照を検出する検証器を追加。
- タグ定義の重複ID、参照切れ、自己参照、親子循環を起動前に拒否する検証を追加。
- StudioプロジェクトJSONを検査できるCLIを追加。

## 差分
### 追加
- `php-runtime/src/RuntimeTagRegistry.php`
- `php-runtime/src/RuntimeTagReferenceValidator.php`
- `php-runtime/bin/validate-studio-tags.php`
- `php-runtime/tests/tag-runtime.php`

### 変更
- `php-runtime/bootstrap.php` にタグ受け入れクラスの読込を追加。

### 削除
- なし。

## 影響範囲
- 既存Battle、Skill、Passive、AIの挙動は変更していない。
- 既存Exportの22ファイル構成、Save/Export経路は変更していない。
- 開発用検証機能のみ追加し、ゲーム保存データには影響しない。

## 検証
- PHP構文検査。
- 既存php-runtime回帰テストを実行。ベースライン既存のExport不整合により完走不可。
- 新規タグランタイム単体テスト。
- 新規タグランタイム単体テスト: 8項目すべて成功。
- PHP構文検査: 対象ファイルすべて成功。
- ベースライン既存問題: `Export/cpf` の45ファイルがmanifest未登録、さらにExport文書のdata_versionがmanifestと不一致。このため既存総合回帰テストは変更前データ段階で停止。
- ブラウザ実行検証は対象外。

## 未実装
- Battle/Skill/Passive/AIによるタグ効果の実行。
- GK STUDIO Exportへのタグマスター専用ファイル追加。
- ランタイムオブジェクトの可変タグコンテナ。
