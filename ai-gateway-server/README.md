# AI Gateway Local Bridge v0.8

1. `config.example.php` を `config.php` にコピーし、長いランダムトークンを設定します。
2. `start.sh` または `start.bat` を実行します。
3. GK Studio の AI Gateway 画面で接続先と同じトークンを入力します。
4. 「接続確認」「現在状態を同期」を実行します。

AI向けエンドポイントは読み取り専用です。`/bridge/snapshot` はGK Studio画面から明示的に押した場合だけ、現在状態のスナップショットをローカル保存します。外部送信は行いません。


## 読み取りAPI

- `GET /ai/status` — 接続状態、スナップショット状態、公開能力
- `GET /ai/project` — 最後に明示同期したプロジェクト情報
- `GET /ai/validation` — 最後に明示同期した検証結果
- `GET /ai/handover` — 許可済み引き継ぎ文書
- `GET /ai/file-range?path=...&start=1&end=200` — 最大500行の部分取得

すべてBearerトークン必須、読み取り専用です。プロジェクト状態はGK Studio画面の「現在状態を同期」を実行した時だけ更新されます。
