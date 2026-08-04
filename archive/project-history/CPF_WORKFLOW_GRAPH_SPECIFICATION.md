# CPF Workflow Graph仕様

WorkflowはNode TypeとEdgeで定義する。
Edgeはrequires_approval、condition、min_count、max_countを保持できる。

必須検査:
- 循環
- 未定義Node Type
- 到達不能工程
- 承認ゲート欠落
- 必須工程欠落
