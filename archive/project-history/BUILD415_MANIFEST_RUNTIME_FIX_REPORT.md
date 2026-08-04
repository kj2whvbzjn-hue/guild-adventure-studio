# BUILD415 Manifest / PHP Runtime Fix Report

## 修正概要

BUILD415完成版に残っていたPHP Runtime総合試験のマニフェスト不整合を修正した。

## 原因

1. `Export/cpf/` に45個のCPF開発ファイルが重複配置されていた。
   - PHP Runtimeは`Export/manifest.json`に登録されていないファイルを拒否するため、`MANIFEST_UNKNOWN_FILE`が発生していた。
   - 正規のCPFソースはリポジトリ直下の`cpf/`に存在する。

2. `Export/manifest.json`のメタデータと、公式22 JSON文書のうち21文書のエンベロープが一致していなかった。
   - manifest: `data_version = 0.1.0-dev-build403`
   - 旧文書: `data_version = 0.1.0-draft`
   - `generated_at`も不一致だった。

## 実施内容

- 重複していた`Export/cpf/`を削除。
- 公式22文書のエンベロープをmanifestの以下の値へ統一。
  - `schema_version`
  - `data_version`
  - `generated_at`
  - `generated_by`
- 更新したJSON文書のSHA-256を再計算し、`Export/manifest.json`へ反映。
- RuntimeやStudioのロジック、Save形式、Export公式22パスは変更していない。

## 検証結果

- PHP Runtime総合試験: 全項目PASS
- 正常パッケージ: 22ファイル読込PASS
- Manifest未知ファイル拒否: PASS
- ハッシュ改ざん検出: PASS
- エンベロープ整合性検査: PASS
- Atomic update / rollback: PASS
- GVF-001〜GVF-005: PASS
- BUILD414 drift test: PASS
- BUILD415 repair planner test: PASS

## 統合判断

マニフェスト部分の既存不整合は解消済み。BUILD415完成版への反映が可能。
