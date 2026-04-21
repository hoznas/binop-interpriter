# binop

BinOp 言語の複数実装を収録したリポジトリ。

サンプルコードは [sample.bo](sample.bo)、文法規則は [bo.bnf](bo.bnf) を参照。
言語仕様の概要は [LANGUAGE.md](LANGUAGE.md) を参照。

## 構成

| フォルダ                           | 説明                                 |
| ---------------------------------- | ------------------------------------ |
| [ts-interpreter/](ts-interpreter/) | TypeScript によるインタプリタ実装    |
| [go-interpreter/](go-interpreter/) | Go によるインタプリタ実装            |
| [go-compiler-vm/](go-compiler-vm/) | Go によるコンパイラ + スタックVM実装 |

## 各実装の実行方法

### ts-interpreter

```bash
cd ts-interpreter
tsc && node main sample.bo   # サンプル実行
tsc && node tests            # テスト実行
```

### go-interpreter

```bash
cd go-interpreter
go run . ../sample.bo        # サンプル実行
go test ./...                # テスト実行
```

### go-compiler-vm

詳細は [go-compiler-vm/README.md](go-compiler-vm/README.md) を参照。

```bash
cd go-compiler-vm
# ビルド
(cd go-compiler && go build -o binop-compiler .)
(cd go-vm && go build -o binop-vm .)
# 実行
go-compiler/binop-compiler ../sample.bo | go-vm/binop-vm
```
