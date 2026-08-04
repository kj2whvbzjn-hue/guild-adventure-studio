# Build392 DOT三種付与スキル検証

## 実装範囲

- スキル定義から毒・燃焼・出血を付与する検証スキル。
- 対象規則 `enemy` による敵単体への付与。
- 各スキルのMP消費と構造化実行ログ。
- DOT固定ダメージを耐性によるダメージ軽減なしで適用。
- 毒・燃焼・出血を別インスタンス・別タイマーとして保持。
- 同一DOTの独立Stackを維持。

## 開発専用検証値

公式バランス値ではない。ExportおよびSaveへ検証スキルを出力しない。

- `devPoison`: MP 8 / 毒 1000固定ダメージ / 300 Tick
- `devBurn`: MP 9 / 燃焼 2000固定ダメージ / 300 Tick
- `devBleed`: MP 10 / 出血 1500固定ダメージ / 300 Tick
- 3種同時の期待DOTダメージ: 4500 / Tick
- 状態異常耐性: 0%

## AI検証シナリオ

`skill_dot_triad_application`

PASS条件:

1. 毒・燃焼・出血の3スキルがスキルDBへ登録されている。
2. 3種が敵単体へ独立した状態インスタンスとして付与される。
3. 各スキルのMP消費合計27が反映される。
4. 1 Tickで固定ダメージ合計4500が発生する。
5. 3種の残り時間がそれぞれ独立して299 Tickになる。
6. 毒の再付与が別instanceIdの独立Stackとして追加される。
7. JSONLへ `SKILL_STATUS_APPLIED`、`DOT_STACK_ADDED`、`SKILL_EXECUTED`、PASS/FAILを記録する。

## 影響範囲

- 開発用Battle Core検証のみ。
- Exportのスキルデータ変更なし。
- Save構造変更なし。
- 公式UI変更なし。
