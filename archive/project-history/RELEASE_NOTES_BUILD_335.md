# Release Notes — Formal Build 335

## 開発フェーズ
Build334のDEC-0032「開発側運用負荷軽減P0」を継続。外部認証なしで完了可能なローカル事前検査自動化をDEC-0033として実装。

## 変更
- Project Auditに生成物・一時ファイル混入検査を追加。
- READMEとstudio-updateのBuild同期検査を追加。
- Build334配布物に含まれていた `tools/__pycache__/*.pyc` を除外。
- Build番号、PWAキャッシュ、正式Manifest、Decision Trackerを335へ同期。

## 未完了
- 実Repository書込み・Pages反映受入。
- 100件超・1,000件規模の実Repository性能試験。
- 書込み失敗時の安全な再開設計。
