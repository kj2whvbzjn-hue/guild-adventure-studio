# AI Gateway Local Bridge v0.7

1. `config.example.php` を `config.php` にコピーし、長いランダムトークンを設定します。
2. `start.sh` または `start.bat` を実行します。
3. GK Studio の AI Gateway 画面で接続先と同じトークンを入力します。
4. 「接続確認」「現在状態を同期」を実行します。

AI向けエンドポイントは読み取り専用です。`/bridge/snapshot` はGK Studio画面から明示的に押した場合だけ、現在状態のスナップショットをローカル保存します。外部送信は行いません。
