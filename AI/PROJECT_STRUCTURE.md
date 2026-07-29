# Project Structure
## Guild Adventure Studio

このファイルはAIがプロジェクト全体を理解するための資料です。

---

# 全体構成

guild-adventure-studio

├── studio/
│     GK Studio（制作ツール・正本）
│
├── Export/
│     Studioから出力されるゲームデータ
│
├── game/
│     共通ゲームライブラリ
│
├── formal-v01/
│     過去Build
│
├── formal-v02/
│     過去Build
│
├── formal-v03/
│     現在の正式ゲーム
│
├── formal-v03-legacy/
│     保存用（編集しない）
│
├── formal-v09-phase-a/
│     次世代開発エリア
│
├── schemas/
│     JSON Schema
│
├── tests/
│     テストコード
│
├── tools/
│     開発ツール
│
└── AI/
      AI向けドキュメント

---

# 正本

唯一の正本は

studio/

である。

ゲーム側でマスターデータを保持しない。

---

# データの流れ

GK Studio

↓

Export

↓

ゲーム

---

# 開発版

開発版では

Studio

↓

ゲームタイトル

↓

ゲーム

↓

Studio

の導線を維持する。

---

# 正式版

正式版では

Studio

Debug

開発者メニュー

は非公開とする。

---

# 修正対象

通常の修正対象

studio/

formal-v03/

game/

---

# 原則編集しない

formal-v01/

formal-v02/

formal-v03-legacy/

schemas/

Export/

---

# Build管理

Build番号は増やすだけ。

過去Buildは削除しない。

---

# AIへの注意

修正対象ファイルだけ編集する。

不要な新規ファイルは作らない。

既存コードを優先利用する。
