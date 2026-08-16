# Gameデータ GitHub配置 運用マニュアル

適用: GA-B486.182 / GKS-B590  
対象窓口: **Studio → GitHub同期 → Gameデータ配置**

## 1. このマニュアルの目的

Studioで作成したMonster / Map / Quest / Box / Event / Reward Table / Flag / Skillなどの正式Gameデータを、Studio本体の更新とは分離してGitHubの`Export/`へ安全に配置し、実機Gameへ反映するための運用手順をまとめる。

Gameデータ配置とStudio更新配置は別窓口である。Gameデータ配置ではStudio本体ファイルを更新せず、正式Exportで生成した`Export/`配下だけを対象とする。

## 2. 全体の流れ

### 2.1 AIがGameデータを作成・修正する場合

AIへGameデータ作業を依頼する場合は、`Export/`を直接編集するのではなく、**現在のStudio Project JSONを入口とする。**

標準手順:

```text
Studioで現在のProject JSONを出力
        ↓
AIへProject JSONを渡す
        ↓
AIは既存データを保持して承認範囲だけ追加・変更
        ↓
AIから全件読込用Project JSONを受け取る
        ↓
Studio「JSON全件読込」でPre-flight検証
        ↓
ERROR 0件を確認して全件読込
        ↓
Studio画面でMonster / Event / Reward / Quest等を確認
        ↓
Data Versionを進める
        ↓
「Gameデータ配置」で正式Export生成・差分確認
        ↓
人間承認後、Export/だけをGitHubへ配置
        ↓
Gameで「Storyデータを再読込」
        ↓
新規QuestRunで実機確認
```

全件読込は現在のProject全体を置換するため、AIへ部分データだけを渡して全件読込用JSONを作らせない。必ず現在のProject JSONを基準にし、既存Story / Skill / ID / 参照を保持する。

Pre-flightでERRORが出た場合は配置へ進まず、検証レポートの原因だけを修正する。未登録タグ、ID形式、参照切れ等を推測で無視しない。

### 2.2 Studio内で直接編集する場合

```text
StudioでMonster / Map / Quest / Event / Reward Table / Flag / Skill等を編集
        ↓
Gameデータ配置を開く
        ↓
正式Export検証
        ↓
GitHub版と比較
  追加 / 差し替え / 除外
        ↓
Flag・Quest参照整合性チェック
        ↓
GitHubファイル差分確認
        ↓
人間が確認
        ↓
Export/だけを1 Commitで配置
        ↓
GitHub Pages反映待ち
        ↓
Gameで「Storyデータを再読込」
        ↓
実機確認
```

## 3. Studio更新との違い

| 項目 | Gameデータ配置 | Studio更新配置 |
|---|---|---|
| 主目的 | Gameが読む内容を更新 | Studio/Game本体ソースを更新 |
| 主対象 | `Export/` | 更新ZIPに含まれるソース（`Export/`は強制除外） |
| Quest/Event/Flag差分 | ID単位で表示 | 対象外 |
| GitHubファイル削除 | 0件 | 削除ポリシーと個別承認に従う |
| 履歴 | Game配置専用履歴 | Studio更新専用履歴 |
| ロールバック | Game配置専用 | Studio更新専用 |

**Gameのバランス調整では原則としてGameデータ配置を使う。** Studio本体の機能修正ZIPをGameデータ配置へ入れない。

Studio更新配置は、更新ZIP内に`Export/`が同梱されていても配置対象から強制除外する。またDELETE_MANIFESTや保護領域削除承認があっても`Export/`は削除対象にしない。GitHub上の公開Gameデータを更新できる窓口はGameデータ配置だけとする。

## 4. 事前準備

### 4.1 Studioデータを保存する

配置前にQuest / Event / Flag等の編集を保存する。重要な調整前にはStudioのバックアップも残す。

### 4.2 GitHub接続先

Gameデータ配置は既存のGitHub同期設定を再利用できる。

必要項目:

- Owner
- Repository
- Branch
- Personal Access Token (PAT)

Owner / Repository / Branchは端末保存できる。**PATは保存されず、開いているタブのメモリ内だけで使用するため、配置時に毎回入力する。**

### 4.3 Data Version

デモ・バランス調整では配置ごとにData Versionを更新する。

例:

```text
demo-0.1.0
demo-0.1.1
demo-0.1.2
demo-0.2.0
```

「どのGameデータを実機で確認しているか」を判別するため、内容を変更して配置するたびにVersionを進める。

## 5. 初回デモデータを配置する手順

1. Studioでデモ用Monster / Map / Quest / Box / Event / Reward Table / Flag等を保存する。
2. **GitHub同期 → Gameデータ配置**を開く。
3. Owner / Repository / Branchを確認する。
4. PATを入力し、必要なら「接続を確認」を実行する。
5. Data Versionを入力する。初回例: `demo-0.1.0`。
6. **「検証・差分取得」**を押す。
7. 「正式Export検証 合格」とFlag・Quest参照整合性OKを確認する。
8. **追加 / 差し替え / 除外**の件数とID一覧を確認する。
9. GitHubファイル差分で、更新対象が`Export/`配下だけであることを確認する。
10. 初回は必要に応じて「テスト実行（GitHubへ書き込まない）」で確認する。
11. コミットメッセージを確認する。
12. **「GameデータをGitHubへ配置」**を押す。
13. 確認ダイアログの件数を確認して承認する。
14. 配置完了Commitを確認する。
15. GitHub Pagesへ反映されるまで待つ。
16. Gameを開き、Quest一覧付近の **「Storyデータを再読込」** を押す。
17. 表示されたExport Data VersionとQuest件数を確認する。
18. デモQuestを実際に開始して、Random Monster / Battle / Event / Flag / Reward / 最終集計等を確認する。

## 6. 追加・差し替え・除外の意味

### 6.1 追加

GitHub版の正式Exportに存在しないIDが、今回の正式Exportに存在する状態。

例:

```text
+ QUEST-DEMO-003
+ EVENT-DEMO-008
+ FLAG-DEMO-004
```

新規コンテンツは新しい安定IDで追加する。

### 6.2 差し替え

GitHub版と今回の正式Exportで**同じID**を持つが、中身が変更されている状態。

バランス調整は原則この方式を使う。

例:

```text
QUEST-DEMO-001
  推奨Lv 3 → 4
  冒険時間 300 → 360

EVENT-DEMO-BATTLE-01
  敵構成変更
  Reward変更
```

**同じゲーム上の存在を調整するだけならIDを変えない。** IDを変えるとGameからは別データとして扱われる。

### 6.3 除外

GitHub版には存在するIDが、今回の正式Exportには存在しない状態。

除外を含む場合、配置前にもう一度確認が出る。

重要:

- GitHub上の`events.json`等の**ファイルそのものを削除する意味ではない**。
- 次回Game再読込後、そのIDが現行Gameデータから外れる。
- 既存プレイヤーSaveのFlagやQuest履歴を自動削除しない。

### 6.4 現行B583の「一時除外」の制限

現在のGameデータ配置窓口は、GitHub版と正式Exportの比較から「除外」を検出できるが、**Studioにデータを残したまま任意の1件だけを`Game反映: OFF`にする専用スイッチはまだない。**

そのため、バランス調整中のデータを一時的にGameへ出したくないだけの理由で、Studioデータを物理削除してはならない。

一時公開/非公開を頻繁に切り替える運用が必要になった場合は、専用の「Game反映 対象 / 一時除外」機能を追加してから運用する。

## 7. Flag運用

FlagはGame世界の進行状態を記憶する。

正式ExportではFlag定義とQuest/EventのFlag参照を接続する。

### 7.1 配置前に検査される主な参照

- Quest `required_flags`
- Quest `set_flags`
- Event `required_flags`
- Event `set_flags`
- Quest `prerequisite_ids`
- Quest `next_quest_ids`

参照先が今回の正式Exportに存在しない場合、Game配置は停止する。

### 7.2 default_value

新しいFlagをGameが初めて認識したとき、Saveに未登録なら`default_value`を初期値として補完する。

既存Saveに同じFlagが存在する場合は、Studioで`default_value`を変更してもプレイヤーの現在値を上書きしない。

例:

```text
Studio: FLAG-001 default_value = true
既存Save: FLAG-001 = false

→ falseを保持
```

完全な初期条件から再テストしたい場合だけ、テスト用Saveを初期化する。

## 8. バランス調整の標準手順

1. 実機テストで調整対象を特定する。
2. Studioで**同じID**のQuest / Event / Reward等を修正する。
3. 保存する。
4. Data Versionを1つ進める。
5. Gameデータ配置で「検証・差分取得」。
6. 対象IDが「差し替え」として表示されることを確認する。
7. 意図しない「除外」が0件であることを確認する。意図した除外がある場合はIDを個別確認する。
8. GitHubへ配置する。
9. Pages反映後、Gameで「Storyデータを再読込」。
10. Export Data Versionを確認する。
11. **新しく開始したQuest**で調整結果を確認する。

## 9. 進行中Questと差し替えの関係

Adventure Questは開始時に今回の結果をQuestRunとして記録する設計になっている。

そのため、Quest開始後にGitHub上のGameデータを差し替えても、**進行中Questを途中から新しい抽選結果へ差し替える運用はしない。**

バランス調整後の確認は、新しいGameデータを再読込してから新規QuestRunを開始して行う。

## 10. Saveを守るルール

Gameデータの差し替え・除外は、既存Saveの進行状態を自動消去しない。

保持される代表例:

- `completed_quest_ids`
- `unlocked_quest_ids`
- Flagの現在値
- 既存の冒険履歴

したがって、デモ検証では次を使い分ける。

- **継続プレイの互換性確認**: 既存Saveを保持
- **初期状態のバランス確認**: テスト用Saveを初期化

## 11. 配置前チェックリスト

- [ ] Studioの編集内容を保存した
- [ ] 必要ならバックアップを作成した
- [ ] Owner / Repository / Branchが正しい
- [ ] PATを今回入力した
- [ ] Data Versionを前回から進めた
- [ ] 正式Export検証が合格した
- [ ] Flag / Quest参照整合性が合格した
- [ ] 「追加」のIDが意図どおり
- [ ] 「差し替え」のIDが意図どおり
- [ ] 「除外」のIDが意図どおり
- [ ] 意図しない除外がない
- [ ] GitHubファイル差分が`Export/`だけ
- [ ] 必要ならDry Runを実行した
- [ ] コミットメッセージを確認した

## 12. 配置後チェックリスト

- [ ] Gameデータ配置が1 Commitで完了した
- [ ] GitHub Pages反映を待った
- [ ] Gameで「Storyデータを再読込」を実行した
- [ ] 表示Data Versionが今回のVersionになった
- [ ] Quest件数・除外件数に異常がない
- [ ] 対象Questが表示される
- [ ] Quest開始条件が正しい
- [ ] Eventが正しく参照される
- [ ] Flag条件・Flag更新が正しい
- [ ] Rewardが正しい
- [ ] バランス調整後は新規QuestRunで再確認した

## 13. 異常時の対応

### 正式Export検証で停止した

表示された参照切れを修正する。検査を無視して配置しない。

### 意図しない除外が表示された

**配置しない。** どのIDが正式Exportから消えているか確認してから再度差分取得する。

### 差分取得後にBranchが更新された

競合防止で自動停止する。別の変更を取り込み、改めて「検証・差分取得」を実行する。

### 配置したがGameへ出ない

1. Pages反映待ちを確認する。
2. Gameで「Storyデータを再読込」を押す。
3. Export Data Versionを確認する。
4. Gameの読込失敗表示に`manifest`や世代不一致が出ていないか確認する。

### 配置を戻したい

Gameデータ配置の「履歴・ロールバック」から直前配置を戻せる。

ただし、**配置後に別Commitが存在する場合は他の変更を守るため自動停止する。** 無理にforce更新しない。

## 14. ロールバックの意味

Gameデータのロールバックは、GitHub Branchを過去へforce resetするのではなく、直前のGameデータ配置前のTreeを使った**新しい復元Commit**を作る。

ロールバック後もPages反映を待ち、Gameで「Storyデータを再読込」する。

ロールバックは既存Saveを過去状態へ戻す機能ではない。

## 15. デモ運用の推奨ルール

1. 公開済みIDを安易に変更しない。
2. バランス調整は同じIDで差し替える。
3. Data Versionは配置ごとに進める。
4. 意図しない除外が1件でもあれば配置しない。
5. Flag IDは特に安易に再利用・改名しない。
6. 既存Save互換テストと初期Saveテストを分ける。
7. Gameデータ配置とStudio更新配置を混同しない。
8. PATは保存しない。
9. GitHubファイル削除0件を通常運用とする。
10. 不具合確認時は「Data Version / Quest ID / Event ID / Monster ID / Reward Table ID / Flag ID」を記録する。
11. QuestRun開始時に確定したRandom Event / Monster編成 / Rewardは、履歴表示やPlaybackで再抽選しない。

## 16. 現行の安全境界

Gameデータ配置窓口は次を守る。

- 対象は`Export/`配下に限定
- GitHub上のファイル削除0件
- Flag / Quest参照整合性ゲート
- ID単位の追加 / 差し替え / 除外表示
- ファイル単位のADD / MODIFY表示
- 差分取得後のBranch競合検出
- 人間確認後の1 Commit配置
- Game配置とStudio更新の履歴分離
- 直前Game配置の競合安全ロールバック

この境界を外れる操作が必要な場合は、既存の配置処理を迂回せず、先に専用手順または機能を追加する。
