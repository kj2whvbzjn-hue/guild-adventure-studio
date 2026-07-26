# Build 335 Demo Foundation Fix06 作業報告

## 目的
GK Studioで承認されたCPFデモコンテンツを、PHP Runtimeが検証・読込み可能なExportへ接続する最小経路を完成させる。

## 実装
- CPF Node種別に `scene` を追加。
- Demo Readinessの必須経路を `story -> plot -> chapter -> section -> scene -> event` に拡張。
- Candidate GeneratorにScene候補生成を追加し、Eventの上位をSceneへ変更。
- 実際の処理内容に合わせて生成モード名を `scaffold_and_candidate` に修正。
- `CpfDemoRuntimeExporter` を追加。
- CLI `demo:export-runtime <CPF_PROJECT_DIR> <BASE_EXPORT_DIR> <OUTPUT_DIR> [DATA_VERSION]` を追加。
- 承認済み・ロック済みのChapter、Section、Scene、EventだけをRuntime Exportへ変換。
- 既存Exportをテンプレートとして別ディレクトリへ原子的に生成。
- 全22 JSONのメタデータを統一し、ManifestのSHA-256を再生成。
- PHP RuntimeのExportLoaderで生成物を実検証する結合試験を追加。

## 安全方針
- 元のExportは上書きしない。
- 出力先は元Exportと別ディレクトリを必須とする。
- 必須Node不足時は出力を停止する。
- 一時ディレクトリで生成し、成功時だけ出力先へ切り替える。
- AIによる承認・昇格・本番反映は行わない。

## 承認状態
このFix06は継続開発成果であり、人間の正式レビュー・承認待ち。既存のFix01～Fix05正式基準は変更していない。
