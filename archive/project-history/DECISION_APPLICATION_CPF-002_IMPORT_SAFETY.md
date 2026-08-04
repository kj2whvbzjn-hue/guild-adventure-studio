# DEC-CPF-0003 — CPF-002 Import Safety Hardening 正式採用

- 状態: 決定済
- 判断: 採用
- 決定日: 2026-07-24
- 優先度: S
- 適用範囲: CPF-002 Story Importer / Structure Analyzer / Plot・Chapter Generator前提条件

## 決定

Plot Generator着手前に `CPF-002A Import Safety Hardening` を必須割込み工程として実施する。Story Importerの基本実装は維持し、再取込、途中失敗、子Node減少、型不正、並行実行に対する安全性を強化する。

## 必須実装

1. Import入力JSON Schemaと事前型検証
2. Project単位Import Lock
3. Stage → Validate → Commit方式のImport Transaction
4. 失敗時Rollbackと再実行可能性
5. 子Node同期と消失NodeのARCHIVED/SUPERSEDED化
6. Chapter内Milestone詳細の二重管理解消
7. Import Snapshot世代管理・hash・latest参照
8. 内部IDと日本語表示名の完全分離
9. Dependency一括更新と孤立依存関係除去
10. 境界・異常・並行実行試験

## 移行ゲート

上記の受入基準と回帰試験が合格するまで、Plot GeneratorおよびChapter Generatorの正式実装へ進まない。

## 理由

生成機能を先に追加すると、残存Node、部分Import、古いMilestone、依存関係不整合が候補RevisionとPreview Rebuildへ伝播し、正式採用時のデータ破損リスクが増大するため。
