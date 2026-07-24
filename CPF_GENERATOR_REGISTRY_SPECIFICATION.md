# CPF Generator Registry仕様

RegistryはGenerator ID、Version、対応Node Type、Capability、優先度、状態を管理する。

必須操作:
- register
- unregister
- resolve
- list
- validateCompatibility

同一Node Typeへ複数Generatorを登録可能とし、プロジェクト設定または優先度で選択する。
