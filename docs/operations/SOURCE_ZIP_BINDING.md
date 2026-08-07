# 入力ZIPと展開ツリーの結合検査

source検査では、入力ZIPの中央ディレクトリと展開後ツリーを、相対パス・サイズ・SHA-256で完全照合する。

- `SOURCE_ZIP_BINDING_OK`: ZIPと展開ツリーが完全一致
- `EXTRACTED_PATH_SUBSTITUTION`: 内容は同一だがパス名が変換された
- `ZIP_TREE_CONTENT_MISMATCH`: 同じパスの内容が異なる

過去に同一内容が`README_GITHUB反映.md`から`README_GITHUB#U53cd#U6620.md`へ変わる事例があった。
現在の永続名はASCII安全名`README_GITHUB_REFLECTION.md`とし、同様のパス変換を避ける。
source検査でZIP中央ディレクトリと展開ツリーのパスが変わった場合は、GitHub実体の不良と推測せず、展開・取得・パス変換層の不一致として停止する。

sourceのQuick／Fullでは`--input-zip`を渡し、展開ツリーだけで完全検査済み判定をしない。
`#Uxxxx`の推測復元は行わず、再発時は`source-zip-binding.json`を保存する。
