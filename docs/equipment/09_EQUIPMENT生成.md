# 09_EQUIPMENT生成

Equipment完全統合仕様 v1.1 と防具係数仕様に基づく AI → Studio 接続工程。

- writable: `equipment` のみ
- Tag / MOD / Stats / Balance Config / Generation Rules は read_only
- AIは装備カテゴリ、BaseItem候補、iLv/帯、生成数を指定できる
- AIは `required_*`, `attack`, `accuracy`, `magic_weapon_bonus`, `base_critical_rate`, `hp_bonus`, `mp_bonus`, `evasion` を正規値として直接決定しない
- 正規経路: AI request → Studio Generator → Generation Rules → Active Balance Config → Validator → Preview → Commit → Equipment Master
- 存在しないTag/MOD IDを推測生成しない

## バランス数値の扱い

装備の数値はバランス調整後に確定するため、現行値を固定値として扱わない。
Generator本体にはバランス数値をハードコードせず、次の値は `studio/equipment/equipment-balance-config.json` から取得する。

- iLv最小/最大
- 武器種別 STR/DEX/INT 要求係数
- attack / accuracy 倍率
- magic_weapon_bonus の参照係数方式
- base_critical_rate
- 防具カテゴリ VIT/MND/AGI 要求係数
- 防具部位係数

Balance Configの数値を変更すれば、Generatorコードを変更せず再生成できる。

## 防具生成

防具はカテゴリと部位を別入力として扱う。

- 要求値: `iLv × カテゴリ係数`
- HP: `required_vit × 部位係数`
- MP: `required_mnd × 部位係数`
- 回避: `required_agi × 部位係数`

現在のConfigには資料記載値を初期調整値として登録しているが、最終確定値ではない。
旧カテゴリ名 `スカウト` は互換入力として `軽装` に正規化する。


## BaseItem Pipeline v1.2 / GKS-B495

単体生成に加えて、同一Generatorを共有する以下の経路を正式接続する。

- 一括試算: `simulateBatch()`。Equipment Masterへ保存しない。
- 一括生成: `generateBatch()` → Validator → Preview → `commitBatch()`。全件OKの場合のみ保存可能。
- AI request: `prepareAiRequest()`。AIはカテゴリ、BaseItem候補、iLv帯、生成数、seed、ID prefixのみ指定可能。
- AI requestへ `required_*`、`attack`、`accuracy`、`magic_weapon_bonus`、`base_critical_rate`、`hp_bonus`、`mp_bonus`、`evasion` を直接指定した場合はエラー。

### Growth拡張点

Balance Configの `growth` を使用する。防具は `hp / mp / evasion` をiLv別に独立設定できる。初期値はすべて1.0。武器は拡張点のみ保持し `enabled=false` とする。要求閾値にはGrowthを掛けない。

### Data Exchange

正式Equipment field（武器性能、防具性能、要求値、生成履歴）をData Exchangeの許可fieldへ追加する。生成履歴 `generation` にGenerator / Rules / Config / seed / calculation traceを保持する。
