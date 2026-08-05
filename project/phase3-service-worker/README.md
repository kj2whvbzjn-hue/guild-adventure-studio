# Phase 3 Service Worker先行整理

## ビルド

- Game: GA-B471
- Studio: GKS-B474

## 変更

Service Workerのキャッシュ名前空間を領域別に分離しました。

| 領域 | Cache | Delete prefix |
|---|---|---|
| root | `ga-root-b471` | `ga-root-` |
| game | `ga-game-b471` | `ga-game-` |
| game-tag-test | `ga-tag-test-b471` | `ga-tag-test-` |
| studio | `gks-studio-b474` | `gks-studio-` |

各Workerは自領域の古いキャッシュだけを削除します。

## 実行していないこと

- 旧ファイル削除
- ファイル移動
- 改名
- archive化
- game、game-tag-test、rootへの新規SW登録

Studioは既存登録のキャッシュ更新番号だけを`v=474`へ更新しています。
