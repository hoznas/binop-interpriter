# binop

BinOp 言語の複数実装を収録したリポジトリ。

サンプルコードは [sample.bo](sample.bo)、文法規則は [bo.bnf](bo.bnf) を参照。
言語仕様の概要は [LANGUAGE.md](LANGUAGE.md) を参照。

**[▶ ブラウザで試す](https://hoznas.github.io/binop-interpriter/)**

## 構成と実行方法

以下はプロジェクトの構成と、各実装の実行方法の案内です。詳細は用途に応じて該当 README を参照してください。

| フォルダ                           | 説明                                 | ドキュメント |
| ---------------------------------- | ------------------------------------ | ------------ |
| [ts-interpreter/](ts-interpreter/) | TypeScript によるインタプリタ実装    | [README](ts-interpreter/README.md) |
| [go-interpreter/](go-interpreter/) | Go によるインタプリタ実装            | [README](go-interpreter/README.md) |
| [go-compiler-vm/](go-compiler-vm/) | Go によるコンパイラ + スタックVM実装 | [README](go-compiler-vm/README.md) |

サンプルコードは [sample.bo](sample.bo) にあります。
