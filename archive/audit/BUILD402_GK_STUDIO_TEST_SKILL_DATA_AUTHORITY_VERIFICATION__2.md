# Build402 GK Studio Test Skill Data Authority Verification

## Purpose
開発・検証用スキルデータをすべてGK Studioで管理し、GK Studio Exportからゲームへ供給する。

## Implemented
- 既存の開発・検証用スキル14件をGK Studioスキルマスターへ登録。
- GK Studio Export `skill/skills.json`へ14件を出力。
- ゲーム本体から開発・検証用スキルのインラインデータ定義を削除。
- ゲーム起動時に必須検証スキル14件の存在を確認。
- 不足時は推論・代替データ生成を行わず、明示的な読み込みエラーとする。
- Save形式、Export envelope、JSONキー、ID体系は変更しない。

## Verification
- GK Studio初期マスター／Export一致: PASS
- ゲーム側インライン検証スキルデータ削除: PASS
- 必須検証スキル存在確認: PASS
- Export manifest hash: PASS
- JavaScript構文: PASS
- JSON構文: PASS
- ZIP整合性: PASS
- ブラウザ統合検証: 保留（既定方針）
