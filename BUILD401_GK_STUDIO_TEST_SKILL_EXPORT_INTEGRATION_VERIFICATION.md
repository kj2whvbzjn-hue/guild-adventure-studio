# Build401 GK Studio Test Skill Export Integration Verification

## Purpose
検証用スキルデータをゲーム本体ではなくGK Studioで作成し、正式Export経路からゲームへ供給する。

## Implemented
- `devTagDrivenInteraction`をGK Studioのスキルマスター初期データへ登録。
- GK Studio Exportの`skill/skills.json`へ同データを出力。
- ゲーム側のインライン相互作用スキル定義を削除。
- ゲーム起動時にGK Studio Exportのスキルを読み込み、検証シナリオへ接続。
- Save形式とExportスキーマは変更なし。

## Verification
- GK Studio初期マスター／Export一致: PASS
- ゲーム側インライン定義削除: PASS
- Export manifest hash: PASS
- JavaScript構文: PASS
- ZIP整合性: PASS
- ブラウザ統合検証: 保留（既定方針）
