# GitHub差分配置 受入チェックリスト

## 前提
- [ ] 公開Repository確定
- [ ] Private Data Repository分離
- [ ] Fine-grained Token作成
- [ ] Pages公開元設定
- [ ] 初回基準一式登録

## 安全検査
- [x] ZIP Slip拒否
- [x] 絶対パス拒否
- [x] 重複正規化パス拒否
- [ ] シンボリックリンク拒否
- [x] 件数・単体・総容量制限
- [x] index.html必須
- [x] 保護・拒否パス適用

## 差分
- [x] ADD判定
- [x] MODIFY判定
- [x] UNCHANGED除外
- [x] PROTECTED表示
- [ ] 削除候補は表示のみ
- [ ] 重要ファイル警告

## 配置
- [x] 明示承認必須
- [ ] Commit message必須
- [x] 単一Commit
- [x] Fast-forwardのみ
- [x] 競合時停止
- [x] 途中失敗でref未更新

## 証跡・復旧
- [x] 旧/新Commit SHA保存
- [x] 対象SHA-256保存
- [ ] エラーコード保存
- [x] Token非保存確認
- [x] Pages確認結果保存
- [x] ロールバック手順表示

## 回帰
- [ ] Project Audit PASS
- [ ] SSF-001〜005 PASS
- [ ] Export試験 PASS
- [ ] PHP Runtime/E2E PASS
- [ ] ZIP CRC PASS
- [ ] 再展開SHA PASS

## 最終判定
- [ ] 全必須項目PASS
- [ ] 監査ZIP作成
- [ ] 正式実装Decision更新
- [ ] 公開承認
