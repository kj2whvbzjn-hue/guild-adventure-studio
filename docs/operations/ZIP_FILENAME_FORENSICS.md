# ZIPファイル名の仕様準拠解析と証跡

## 判定順序

1. General Purpose Bit 11がある場合、中央ディレクトリの名前バイトを厳密UTF-8で解釈する。
2. Bit 11がなくASCIIだけならASCIIとして解釈する。
3. Bit 11がなく非ASCIIを含む場合、Unicode Path Extra Field `0x7075`のversion、元名CRC32、UTF-8名を検証し、有効な場合だけ採用する。
4. どの条件にも該当しない名前は推測変換せず停止する。

## 相互検証

中央ディレクトリから仕様に従って得た名前とJSZip/Python zipfileの名前を比較する。不一致時はGitHubへ送信しない。

## 証跡

生の名前バイト、フラグ、extra field、`0x7075`解析結果、CRC一致、解釈元、ライブラリ名を記録する。`#Uxxxx`の文字置換は行わない。
