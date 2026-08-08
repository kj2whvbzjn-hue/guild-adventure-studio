# Data Exchange 専用検査

通常開発では、この独立検査入口を使用する。

- Quick: `python3 studio/data-exchange/tests/run.py quick`
- Full: `python3 studio/data-exchange/tests/run.py full`

運用:
- 通常開発: Data Exchange Quick
- Phase完了: Data Exchange Full + 既存 Quick
- 大きな節目: Data Exchange Full + 既存 Full
- 完成判定: Data Exchange Release相当 + 既存 Full/Release

既存 `tools/inspection` および既存 `test-registry` はData Exchange都合で変更しない。
