# Build 472.29 Battle Package Multiple Jobs

- 複数battle-testジョブの順次実行を正式化
- enabled=falseジョブをINFOとしてスキップ
- required / continue_on_error / stop_on_required_failureを反映
- skipped / not_runをResult Packageへ収録
- 複数ジョブ確認用サンプルZIP出力を追加
