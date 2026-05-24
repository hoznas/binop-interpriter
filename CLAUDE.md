# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) へのガイダンスを提供します。

## このプロジェクトについて

BinOp は動的型付け・プロトタイプベースのプログラミング言語で、（ほぼ）あらゆる構文が二項演算子として表現されます。このリポジトリには、同一の言語仕様を持つ 3 つの独立した実装が含まれています。

| ディレクトリ | 言語 | 実装方式 |
|---|---|---|
| `ts-interpreter/` | TypeScript | CPS による木を直接辿る評価器 |
| `go-interpreter/` | Go | CPS による木を直接辿る評価器 |
| `go-compiler-vm/` | Go | バイトコードコンパイラ + スタック VM |

言語仕様: [LANGUAGE.md](LANGUAGE.md)。文法規則: [bo.bnf](bo.bnf)。サンプルプログラム: [sample.bo](sample.bo)。

## コマンド

### TypeScript インタープリタ
```bash
cd ts-interpreter
tsc && node main ../sample.bo   # ファイルを実行
tsc && node tests               # テストを実行
```

### Go インタープリタ
```bash
cd go-interpreter
go run . ../sample.bo           # ファイルを実行
go test ./...                   # テストを実行
```

### Go コンパイラ + VM
```bash
cd go-compiler-vm

# バイナリをビルド
cd go-compiler && go build -o binop-compiler . && cd ..
cd go-vm       && go build -o binop-vm .       && cd ..

# 実行（コンパイラの標準出力を VM の標準入力にパイプ）
./go-compiler/binop-compiler ../sample.bo | ./go-vm/binop-vm

# テストを実行
cd go-compiler && go test ./... && cd ..
cd go-vm       && go test ./...  && cd ..
```

## アーキテクチャ

3 つの実装はすべて次のパイプラインを共有しています。

```
ソース → トークナイザ → パーサ → AST → (評価器 | コンパイラ → VM)
```

各層はそれぞれ独立したファイル（`tokenizer.*`、`parser.*`、`evaluator.*` / `compiler.*` + `vm.*`）に実装されています。

### トークナイザ
正規表現ベース。改行と `;` を単一の `;` トークンに正規化します。主なトークン種別：数値、文字列、シンボル、二項演算子、括弧。

### パーサ
演算子優先順位に基づく再帰下降型パーサ。AST のノード型は 2 種類：
- **Num / Str** — リテラル
- **Message** — それ以外すべて（二項演算子・メソッド呼び出し・関数呼び出し・制御構文）

演算子優先順位（高い順）：`.` → `* / %` → `+ -` → 比較演算子 → `== !=` → `&& ||` → `:= =` → ユーザー定義演算子 → `;` → `,`

### オブジェクトシステム（`object.*`）
```
BoObject
├── Num       (float64)
├── Str       (string)
├── Nil       (唯一の偽値)
├── UserObject (スロットマップ + クローン元親オブジェクト)
├── Fun       (キャプチャした環境を持つクロージャ)
├── Macro     (評価前の AST ノードを引数として受け取る)
└── Message   (メタプログラミング用の AST ノード)
```

### メモリ / スコープ（`memory.*`）
レキシカルスコープチェーン。各 `Memory` は `Slots`（変数マップ）と `Super`（親スコープへのポインタ）を持ちます。変数の参照はチェーンをたどります。`:=` は現在のフレームに定義し、`=` はバインディングが存在する最も近いフレームを更新します。

### 評価器（インタープリタ）
両インタープリタとも、深い再帰によるスタックオーバーフローを防ぐために **CPS + トランポリン** を使用しています。
```
Bounce = BoObject | Thunk(fn: () → Bounce)
trampoline: BoObject が返るまで Thunk.fn() を繰り返し呼び出す
```
すべての `eval*` 関数は継続 `k` を引数に取り、`Bounce` を返します。

### コンパイラ + VM
**コンパイラ**（`go-compiler/compiler.go`）は AST を走査し、`Instruction` 構造体のリストを生成します。主な変換ルール：
- リテラル → `PUSH_NUM` / `PUSH_STR` / `PUSH_NIL`
- 変数 → `LOAD` / `DEFINE` / `UPDATE`
- 二項演算 `a OP b` → compile(a) + compile(b) + `SEND OP 1`
- `a ; b` → compile(a) + `POP` + compile(b)
- `&&` / `||` → `JUMP_IF_NIL` / `JUMP_IF_NOT_NIL` による短絡評価
- `fun(args, body)` → `MAKE_FUN` + compile(body) + `END_FUN`

**VM**（`go-vm/vm.go`）は `Instruction.Op` で分岐するスタックマシンです。約 25 種類の命令は `go-compiler/instruction.go` で定義されています。

> 注意：マクロとメタプログラミング（`evalNode`、`evalStr`、`message`）はコンパイラ / VM では未実装で、インタープリタのみのサポートです。

## 言語仕様クイックリファレンス

- `nil` のみが偽値。`0` や `""` を含む他のすべての値は真値。
- `a.foo(b)` とユーザー定義中置演算子 `a foo b` は同等。どちらも受信者 `a`、メッセージ名 `foo`、引数 `b` の `Message` ノードとして表現される。
- 文字列に対する `/` は最初のスペースより前の部分を返し、`%` はそれ以降を返す（Lisp の car/cdr に相当）。
- オブジェクトはクローンベース（プロトタイプ型）の継承：`child := parent.clone()`。
- マクロは評価前の `Message` AST ノードを受け取り、`evalNode()` で手動評価する。
