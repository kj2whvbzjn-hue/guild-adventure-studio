# BUILD 472.0 Event Timeline / Character History Linkage

- イベント登録・更新時に時系列を自動生成・同期
- 発生シーンに紐づく章番号・節番号を自動反映
- 登場キャラクターごとに時系列レコードを作成
- 登場キャラクターの `event_history` にイベント履歴を保存
- イベント編集時は自動生成済みの連携データを更新
- イベント削除時は `auto_generated: true` の連携データのみ削除
- 手動登録した時系列は削除しない
