# Build 335 Formal Manifest Correction Report

## 目的

人間による承認を受け、GK Studio Formal Build 335とCPF正式ManifestのBuild 328不一致を解消する。

## 修正内容

- `CPF_FORMAL_RELEASE_MANIFEST.json`の正式Buildを335へ更新
- 直前の正式基準Buildを328として記録
- Fix01〜Fix05の承認範囲を明記
- UI統合、Runtime Export変換、実ゲームE2Eを承認対象外として明記
- `CPF_APPROVAL_RECORD.md`へBuild 335の人間承認記録を追加
- `package_manifest.json`を現在の配布内容から再生成
- SHA-256一覧を自己参照しない方式で再生成

## 安全方針

本修正はゲームデモ版そのもののリリース承認ではない。自動承認、自動昇格、Repository自動書込みは追加しない。

## 検証条件

- Project AuditがPASSすること
- Formal Manifestに列挙された文書が存在すること
- SHA-256一覧が完全一致すること
- ZIP CRC検査がPASSすること
