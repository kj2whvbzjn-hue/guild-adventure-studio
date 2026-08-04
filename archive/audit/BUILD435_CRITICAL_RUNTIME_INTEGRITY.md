# GKS-B435 Critical Runtime Integrity

## 目的
GitHub Pagesで実行するために重要なファイルについて、欠落・切り詰め・意図しない変更を自動検出する。

## 追加
- `shared/integrity/critical-runtime-manifest.json`
- `tools/integrity/check-critical-runtime.py`
- 一括検査 `tools/integrity/check-project.sh` への統合

## 互換性
- 公開URL変更なし
- 実行ファイル移動なし
- ファイル削除なし
- localStorage形式変更なし

## 対象
ゲーム、Studio、分類入口、PWA、共通実行資産、依存関係定義の重要20ファイル。
