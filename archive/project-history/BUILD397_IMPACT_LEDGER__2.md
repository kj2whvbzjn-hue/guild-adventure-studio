# Build397 Impact Ledger

## 変更ファイル

### MODIFY
- `formal-v03/index.html`
  - `BattleStatusManager`
  - `SkillExecutor`
  - `renderBattle`
  - `resetBattle`
  - 検証シナリオ群
  - JSONLビルド情報
- `sw.js`
  - `CACHE_NAME`
  - `appv`
- `VERSION.txt`
  - Formal Build番号

### ADD
- `BUILD397_BUFF_DEBUFF_TAG_INTEGRATION_PHASE3_VERIFICATION.md`
- `BUILD397_ADR_BUFF_DEBUFF_TAG_CONNECTION.md`
- `BUILD397_IMPACT_LEDGER.md`

## 実際に変更したBattleStatusManagerメソッド
- `addBuff(target, buff, source)`
- `removeBuff(target, buffRef, reason, source)`
- `updateAtTickStart(target)`
- `addStatus(target, status, source)`
- `removeAllStatuses(target, reason)`
- `applyDamage(target, amount, context)`
- `outgoingDamageMultiplier(target)`
- `healingEffectMultiplier(source)`
- `incomingHealingMultiplier(target)`

## 新規メソッド
- `effectTagId(category, key)`
- `ensureEffectTag(target, category, key, name, source)`
- `releaseEffectTag(target, category, key, remainingCount, reason, source)`
- `strongestBuff(target, stat)`
- `strongestStatusByMultiplier(target, statusId, field, defaultValue)`

## データ構造
### BUFFインスタンス
- `id`
- `instanceId`
- `name`
- `stat`
- `power`
- `duration`
- `remaining`
- `sourceId`

### 非DOT DEBUFFインスタンス
既存status構造を維持し、再付与時の上書きを廃止して固有`instanceId`を持つ別インスタンスとして追加する。

## 呼び出し関係
- BUFFスキル → `SkillExecutor.execute` → `BattleStatusManager.addBuff` → BUFFインスタンス追加 → BUFFタグ同期
- 状態付与スキル → `SkillExecutor.execute` → `BattleStatusManager.addStatus` → 非DOT DEBUFFインスタンス追加 → DEBUFFタグ同期
- Tick開始 → `updateAtTickStart` → 各インスタンス減算 → 期限切れ削除 → 最終インスタンス消滅時にタグ削除
- ダメージ受領 → `applyDamage` → sleepインスタンス削除 → 最後のsleep消滅時にタグ削除

## 将来の全面置換時に削除候補となる同期層
- `ensureEffectTag`
- `releaseEffectTag`
- 既存`buffs`／`statuses`と`tags`を二重管理する呼び出し

## 将来の調査対象
- `BattleStatusManager`
- `SkillExecutor`
- `SkillTargetSelector`
- `renderBattle`
- `processTicks`
- `makeCombatant`
- `resetBattle`
- `verificationJSONL`
- Save処理（現Buildでは変更なし）
- Export処理（現Buildでは変更なし）

## リスクと対策
- 同期タグの残留: 最後の同種インスタンス削除時のみタグを削除。
- 複数効果の加算: 能力計算は最大BUFFまたは最も不利な倍率DEBUFFのみ参照。
- DOT挙動の破壊: DOT_STATUS_IDSは既存処理を維持し、DEBUFFタグ同期から除外。
- 全面移行時の二重管理残存: 本台帳の同期層と呼び出し関係を削除チェックリストとして使用。
