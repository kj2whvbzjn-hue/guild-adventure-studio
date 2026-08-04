# PHP受渡し用データスキーマ仕様

## 1. 正式方針
GK Studioは `Export/` を生成し、PHP版ギルド冒険物語は `Export/` 配下のみをゲームマスターとして読み込む。Studio内部保存データを直接参照してはならない。

## 2. データ領域
### Studio内部のみ
- Decision Tracker
- 編集履歴・Undo
- GitHub接続設定
- UI状態
- Studio用バックアップ

### Export対象
- マスターデータ
- シナリオ
- クエスト
- イベント
- AI
- 石板
- バランス・ドロップ・ゲーム設定

### PHP実ゲーム側のみ
- セーブデータ
- プレイヤー進行
- 所持品個体
- プレイ履歴
- プレイヤーログ
- ユーザー設定

## 3. バージョン
- app_version: Studioアプリの版
- schema_version: JSON構造の版
- data_version: ゲームマスター内容の版
- save_version: セーブ構造の版

## 4. 共通JSON形式
```json
{
  "schema_version": "1.0.0",
  "data_version": "1.0.0",
  "generated_at": "2026-07-23T00:00:00+09:00",
  "generated_by": "GK Studio",
  "data": []
}
```

## 5. 読込規則
1. PHP側は `Export/manifest.json` を最初に読む。
2. 対応するschema_versionか検査する。
3. files一覧とSHA-256を検証する。
4. 必須ファイル不足または不正時はゲームを開始せず、明示的なエラーを出す。
5. Studio内部ファイルへのフォールバックは禁止する。

## 6. Export完了条件
- 全JSONがUTF-8
- 共通メタデータを保持
- ID重複なし
- 必須参照切れなし
- manifestと実ファイルが一致
- schema validation成功
