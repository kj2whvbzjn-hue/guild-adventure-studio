# P01-01 開発コンソール識別修正

- Game: GA-B481
- Studio: GKS-B484

URLとページIDが一致しない場合、ゲーム系キャッシュとService Workerを解除し、現在URLを再取得します。Safariのページ復元時も再検査します。

DELETEなし。
