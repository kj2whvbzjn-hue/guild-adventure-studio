# BUILD415 タグ修復プランナー 完成報告

## 実装範囲

GK Studio の「データ検証」画面に、監査結果から修復候補を生成・確認・選択・適用するタグ修復プランナーを追加した。

### 修復計画

- `buildTagRepairPlan()` による候補生成
- `gk.tag-repair-plan.v1` JSON 出力
- 廃止タグの有効な置換チェーンを最終置換先まで解決
- 参照箇所と件数のプレビュー
- 未使用・廃止済み・安全削除可能なタグを物理削除候補として提示

### 承認と適用

- 個別選択、全選択、選択解除
- 参照置換候補は初期選択
- 物理削除候補は破壊的操作として初期未選択
- 適用直前に条件を再評価し、古い計画の実行を停止
- ユーザー確認後のみ適用

### 安全性

- 適用前に `before-build415-tag-repair` バックアップを作成
- 変更対象は `characters[].tags`、`masters.*[].tags`、および明示的に選択されたタグ定義のみ
- 重複タグ参照を置換時に正規化
- 適用後に保存、TagIndex 再構築、Validation 再実行
- 同一セッション内で直前の修復をロールバック可能
- ロールバック前にもバックアップを作成

## 互換性

- プロジェクト保存スキーマ変更なし
- Export スキーマ変更なし
- PHP Runtime 変更なし
- BUILD407〜BUILD414 の既存機能を維持

## 検証

- Inline JavaScript 構文: PASS
- BUILD407: PASS
- BUILD408: PASS
- BUILD410: PASS
- BUILD411: PASS
- BUILD413: PASS
- BUILD414: PASS
- BUILD415 static/syntax: PASS
- PHP tag-runtime: 8/8 PASS

既存の PHP Runtime 総合テストには、BUILD415 と無関係な既知の `MANIFEST_UNKNOWN_FILE` / manifest 登録不整合が残っているため、総合スイート全体は PASS ではない。BUILD415 は PHP Runtime および Export を変更していない。
