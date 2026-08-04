# CPF API準備仕様

CPF-001のApplication ServiceはCLI入出力から分離する。
CLI Adapter、将来HTTP Adapter、将来GUI Adapterが同じUse Caseを呼び出す構造とする。

禁止事項:
- Service内で標準入力を直接読む
- Service内で画面表示を直接行う
- CLI引数形式をDomainへ持ち込む
