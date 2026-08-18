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


## iPhoneタップ操作改善 / GKS-B499

- 生成設定の「係数を変更する」「武器ベースアイテムセット」「防具ベースアイテムセット」は、iPhoneで誤タップしにくい独立タップ領域として表示する。
- 各開閉行は44px以上のタップ領域を持ち、項目間に十分な余白を設ける。
- AI・JSON入力の「JSONを貼り付ける」も独立した大きなタップ領域とし、ファイル状態・試算操作との間隔を確保する。
- 本変更はUI操作性のみを対象とし、生成計算、JSON形式、ベースセット、Data Exchangeの仕様は変更しない。


## JSONファイル選択UI統一 / GKS-B500

- 装備生成の武器JSON・防具JSON選択は、管理→GitHub配置で採用しているネイティブのファイル選択UIに合わせる。
- 「ファイル未選択」を独立した状態ボックスとして表示せず、ファイル選択コントロール内で未選択／選択済みファイル名を確認できる。
- AIテンプレート出力、JSON貼付、試算、生成確認の機能仕様は変更しない。

## アクセサリ生成

- 区分は `accessory`。生成対象は `アミュレット` / `指輪` / `ベルト`。
- 装備先はそれぞれ `amulet` / `ring` / `belt` へ直接割り当てる。`accessory` という装備スロットは作成しない。
- アミュレット・指輪は「アクセサリ_ベース名称仕様_採用」の魔法系名称セット、ベルトは軽装名称セットを初期プリセットとする。名称セットはStudioで編集可能。
- ベースアクセサリのレアリティは `NORMAL`、`mod_ids` は空配列。
- 能力値閾値（STR/DEX/INT/VIT/MND/AGI）は設定しない。装備生成上の管理値はiLvのみ。

## 確定ベース名称セット整合 / GKS-B640

- 防具はカテゴリごとに確定名称セットを使用する。`重装` / `軽装` / `ローブ` の生成時は、それぞれ同名プリセットを自動選択し、他カテゴリのActiveプリセットを流用しない。
- `杖` / `ワンド` は確定 `杖・ワンド` 名称セット、`魔導書` は確定 `魔導書` 名称セットを使用する。
- 魔導書の確定名称は名称自体に「魔導書」を含むため、武器種名を末尾へ重複追加しない。
- 上記プリセットの行はStudioのベースアイテムセット編集から変更可能。保存済み同名プリセットがある場合は、そのプロジェクト側の内容を使用する。
- この変更は名称解決だけを対象とし、武器・防具の要求係数、性能計算、アクセサリ生成、Game側装備スロット、Save、戦闘処理は変更しない。
