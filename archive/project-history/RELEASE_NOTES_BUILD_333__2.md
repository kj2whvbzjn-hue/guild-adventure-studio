# Release Notes — Formal Build 333

## 主題
GitHub連携画面追加を最優先課題として完了判定し、操作導線と実装・計画記録の不一致を是正。

## 変更
- GitHub連携UIの初回操作ガイドを追加。
- Owner／Repository／Branch／PAT／更新ZIPの準備状態を表示。
- Build番号、PWAキャッシュ、更新manifestを333へ更新。
- DEC-0031を採用。
- REVIEW_PRIORITY_LISTの実装済みPhase 1〜5を実態に合わせて更新。

## 安全境界
- 最後の配置実行のみ人間操作。
- Token非保存。
- 削除・force更新・`.github`更新は禁止。
