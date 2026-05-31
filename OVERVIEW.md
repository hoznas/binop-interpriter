# BinOp プロジェクト概要

## BinOp 言語とは

**BinOp**（びんおーぴー）は、**二項演算子を文法の中心に置いた**動的型付けプログラミング言語です。

`1 + 2` や `a.foo(b)` はもちろん、`;`（順次処理）や `,`（引数区切り）まで、ほぼすべての構文が「左辺 演算子 右辺」の二項演算子として統一されています。  
`for`/`while` ループや単項演算子は存在せず、繰り返しは再帰で表現します。

**真偽値のルール**: `nil` だけが偽。`0` も `""` も真です。

```
# 変数定義と代入
n := 5
n = n + 1

# 条件分岐（if はメソッド）
(n > 3).if("big", "small").print()

# 再帰による繰り返し
factorial := fun(n,
  (n > 1).if(n * factorial(n-1), 1))
factorial(5).print()  "=> 120"
```

## 3つの実装

このリポジトリには、**同一言語仕様**を持つ 3 つの独立した実装が含まれます。

| ディレクトリ | 言語 | 実装方式 | 詳細 |
|---|---|---|---|
| `ts-interpreter/` | TypeScript | CPS + トランポリンによる木走査評価器 | [OVERVIEW.md](ts-interpreter/OVERVIEW.md) |
| `go-interpreter/` | Go | 直接再帰による木走査評価器 | [OVERVIEW.md](go-interpreter/OVERVIEW.md) |
| `go-compiler-vm/` | Go | バイトコードコンパイラ + スタック VM | [OVERVIEW.md](go-compiler-vm/OVERVIEW.md) |

すべての実装は以下の共通パイプラインを持ちます:

```
ソースコード → トークナイザ → パーサ → AST → 評価器 or (コンパイラ → VM)
```

## 言語仕様

詳細は [LANGUAGE.md](LANGUAGE.md) と [bo.bnf](bo.bnf) を参照してください。

| 機能 | 説明 |
|---|---|
| データ型 | 数値（float64）、文字列、nil、関数、マクロ、ユーザーオブジェクト |
| 演算子優先度 | `.` > `* / %` > `+ -` > 比較 > `== !=` > `&& \|\|` > `:= =` > ユーザー定義 > `;` > `,` |
| オブジェクト | プロトタイプベース（`Object.clone()` で派生） |
| クロージャ | `fun(args, body)` で生成、定義時の環境をキャプチャ |
| マクロ | `macro(args, body)` で生成（インタープリタのみ） |
| メタプログラミング | `message()`, `evalNode()`, `evalStr()`（インタープリタのみ） |

## 実行方法

### TypeScript インタープリタ
```bash
cd ts-interpreter
tsc && node main ../sample.bo
tsc && node tests
```

### Go インタープリタ
```bash
cd go-interpreter
go run . ../sample.bo
go test ./...
```

### Go コンパイラ + VM
```bash
cd go-compiler-vm
cd go-compiler && go build -o binop-compiler . && cd ..
cd go-vm       && go build -o binop-vm .       && cd ..
./go-compiler/binop-compiler ../sample.bo | ./go-vm/binop-vm
```
