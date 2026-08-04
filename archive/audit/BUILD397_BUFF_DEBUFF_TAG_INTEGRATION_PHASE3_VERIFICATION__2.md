# Build397 BUFF／DEBUFFタグ統合 Phase3 検証記録

## 基礎ビルド
- GA-Build396

## 採用方式
- 既存の `buffs`／`statuses` を維持し、タグ基盤へ接続する互換方式。
- DOT（poison／burn／bleed）は既存の個別スタック処理を維持し、DEBUFFタグ同期の対象外。
- BUFFおよび非DOT状態は、同一ID・同一効果量・同一付与元でも別インスタンスとして追加。
- 各インスタンスの `remaining` を個別にTick管理。
- 能力計算では同種のうち最も強い1件だけを参照し、加算しない。
- 同種インスタンスが1件以上ある間は対応タグを1個だけ保持し、最後の1件が消えたときに削除。

## タグID
- BUFF: `BUFF:<stat>`
- DEBUFF: `DEBUFF:<statusId>`

## 追加JSONLイベント
- `BUFF_INSTANCE_ADDED`
- `BUFF_INSTANCE_REMOVED`
- `BUFF_INSTANCE_EXPIRED`
- `DEBUFF_INSTANCE_ADDED`
- `STATUS_INSTANCE_EXPIRED`
- `BUFF_TAG_SYNC`
- `DEBUFF_TAG_SYNC`

## 検証シナリオ
- `skill_buff_application`
- `buff_debuff_tag_integration_phase3`

## 静的検証
- JavaScript構文確認
- Build番号残存確認
- ZIP整合性確認

## 実行制約
ブラウザ上の一括シナリオ実行結果は、実際に実行できた場合のみ別途PASS／FAILを記録する。
