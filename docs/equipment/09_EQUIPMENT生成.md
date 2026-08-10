# 09_EQUIPMENT生成

Equipment完全統合仕様 v1.1 と防具係数仕様に基づく AI → Studio 接続工程。

- writable: `equipment` のみ
- Tag / MOD / Stats / Balance Config / Generation Rules は read_only
- AIは装備カテゴリ、BaseItem候補、iLv/帯、生成数を指定できる
- AIは `required_*`, `attack`, `accuracy`, `magic_weapon_bonus`, `base_critical_rate`, `hp_bonus`, `mp_bonus`, `evasion` を正規値として直接決定しない
- 正規経路: AI request / 手動入力 → Studio Generator → Generation Rules → Active生成設定 → Validator → Preview → JSON出力 → バランステスト往復 → 完成後に「管理 → 読込」のData Exchangeゲートからマスター登録
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


## iPhone / AI JSON Pipeline v1.3 / GKS-B497

- 装備生成画面を「生成設定 → JSON/手動入力 → 試算・数値確認 → JSON出力」の4段階に整理する。
- 生成係数は静的 `equipment-balance-config.json` を初期値とし、プロジェクト内 `equipment_generation.active_config` に保存した設定を以後の生成基準として優先する。
- 武器種のSTR/DEX/INT、防具カテゴリのVIT/MND/AGI、部位係数、攻撃倍率、命中倍率、基礎クリティカル率はiPhoneから編集可能とする。高度な設定は設定JSONの読込・出力で往復できる。
- AI一括入力は `GKS_EQUIPMENT_GENERATION_REQUEST` の `requests` 配列を正式入口とし、JSONファイル読込と貼付の両方に対応する。従来の単一requestも互換入力として受け付ける。
- AIは正式性能数値を直接決定できない。すべてActive生成設定から再計算する。
- 確認画面では要求閾値と正式性能をカードで表示し、各装備の計算過程を展開表示できる。
- `GKS_EQUIPMENT_GENERATION_WORK` は生成要求・使用Config・生成結果をまとめた往復用JSON。AI再編集およびバランステスト工程の受渡しに使用する。
- 完成装備は既存 `GKS_DATA_EXCHANGE` のequipment Dataset形式で書き出す。装備生成画面からマスターへ直接登録する入口は追加しない。登録は既存の「管理 → 読込」に一本化する。
- 旧 `commit()` / `commitBatch()` APIは後方互換・既存テスト資産のため保持するが、通常UIには表示しない。


## BaseItem Name Sets / Split Batch UI v1.4 / GKS-B498

- ベースアイテム名は武器用と防具用を完全分離し、プロジェクト内 `equipment_generation.base_name_sets` に保存する。
- 初期プリセットは武器 `標準武器`、防具 `標準防具`。iLv1〜11は既存の「木の / 鉄の / 鋼鉄の ...」を維持する。
- 各セットはレベル番号と接頭名の一覧として編集し、`＋追加` で iLv12 以降を追加できる。例: `12 / 伝説の`。
- `設定を確定` したセットを新規生成の名称基準として使用する。確定セットに追加された最大iLvまで生成上限を自動拡張する。
- 武器・防具はそれぞれ独立したプリセットを複数登録でき、選択プリセットをActive化できる。一方のプリセット変更は他方へ影響させない。
- 自動名称は `武器ベース名 + 武器種`、`防具ベース名 + 防具カテゴリ + 部位` で作る。手動名称が明示された場合は手動名称を優先する。
- AI/JSON一括入力UIは武器と防具を別入口に分ける。各入口では異なるkindのrequest混入を拒否し、混在を防ぐ。内部APIは従来の複数request形式との互換を維持する。
- JSON出力の表示名は用途を明確化し、`調整用JSONを書き出す`（バランステスト往復・AI再調整）と `完成装備JSONを書き出す`（管理→読込用）に分ける。
- `GKS_EQUIPMENT_GENERATION_WORK` v1.1 はActive生成設定に加えて `base_name_sets` を保持する。
