# GA-B470 index.html 整理記録

## ビルド

- Game: GA-B470
- Studio: GKS-B473（変更なし）

## 採用した正式入口

| パス | 役割 |
|---|---|
| `/` | プロジェクト全体の入口 |
| `/game/` | 正式ゲーム |
| `/studio/` | GK Studio |
| `/game-tag-test/` | タグランタイム検証 |
| `/docs/` | 開発資料 |

## 調査結果

| index.html | 現在の役割 | 扱い |
|---|---|---|
| `apps/game/index.html` | 旧ゲーム複製 | 互換保持 |
| `apps/index.html` | 旧アプリ入口 | 互換保持 |
| `apps/studio/index.html` | Studio複製 | 互換保持 |
| `archive/pre-split-game/index.html` | 分割前ゲーム | 保管 |
| `docs/index.html` | 開発資料入口 | 開発 |
| `formal-v01/index.html` | 旧正式版基盤 | 退役候補 |
| `formal-v02/index.html` | 旧正式戦闘コア | 退役候補 |
| `formal-v03-legacy/index.html` | 旧正式戦闘コア | 退役候補 |
| `formal-v03/index.html` | 最新版ゲームへの転送 | 互換保持 |
| `formal-v09-phase-a/index.html` | 旧Phase A版 | 退役候補 |
| `game-tag-test/index.html` | タグランタイム検証 | 開発 |
| `game/index.html` | 正式ゲーム本体 | 正式 |
| `index.html` | プロジェクト全体の正式入口 | 正式 |
| `legacy-home/index.html` | 旧ホーム | 退役候補 |
| `studio/index.html` | GK Studio本体 | 正式 |

## 今回実施したこと

1. ルートをプレイヤー優先の入口へ整理。
2. Studio、検証、資料を開発領域として明示。
3. `/docs/index.html` を追加。
4. ゲームの表示・キャッシュ・検証出力ビルドをGA-B470へ更新。
5. 既存の互換入口と旧ページは削除せず保持。

## 今回実施していないこと

- Studio本体の変更
- JavaScriptの大規模分割
- 旧ページの物理削除
- 旧URLの強制転送統一
- ゲームロジックの変更

## 削除を保留した理由

現在は本番ユーザー資産を考慮する必要は小さいものの、旧ページ間の参照関係を完全に検証していないためです。正式導線からは外し、次の整理工程で参照監査後に削除します。
