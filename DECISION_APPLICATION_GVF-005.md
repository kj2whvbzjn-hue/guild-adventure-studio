# DECISION APPLICATION GVF-005

## Decision
Runtime、データ参照整合性、ゲームバランス、シナリオ整合性、戦闘シミュレーションを単一のRelease Quality Reportへ統合する。

## Adopted behavior
- 通常モードでは戦闘ケース未指定をSKIPPEDとして記録し、制作中の品質確認を継続可能とする。
- `--strict-release`では全5検査を必須とし、SKIPPED・FAIL・BLOCKEDをRelease Gate失敗とする。
- 評価基準と重みは`schemas/release-quality-rules.json`で設定する。
- JSONおよびHTMLレポートを提供し、終了コードをCIのRelease Gateとして利用する。
