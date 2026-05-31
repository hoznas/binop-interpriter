# go-compiler-vm 概要

BinOp ソースコードを**命令列（IL）にコンパイル**し、**スタックマシン（VM）で実行**する実装です。  
インタープリタと違い「コンパイラ」と「VM」の 2 段階に分かれています。

---

## 全体像

```
BinOp ソースコード (.bo ファイル)
        │
        ▼
  ┌─────────────────────────────────────────┐
  │  go-compiler （フロントエンド）           │
  │  ソースコードを機械が実行しやすい形に変換  │
  │                                         │
  │  tokenizer → parser → AST → compiler   │
  │                              ↓          │
  │             IL テキスト（命令列）を出力   │
  └─────────────────────────────────────────┘
        │ パイプ（標準出力 → 標準入力）
        ▼
  ┌─────────────────────────────────────────┐
  │  go-vm （バックエンド）                  │
  │  命令列を受け取り、順番に実行する          │
  │                                         │
  │  IL テキスト → Instruction 配列 → 実行  │
  └─────────────────────────────────────────┘
        │
        ▼
    実行結果（標準出力）
```

実行コマンド:
```bash
./go-compiler/binop-compiler sample.bo | ./go-vm/binop-vm
```

---

## ディレクトリ構成

```
go-compiler-vm/
├── go-compiler/          ← コンパイラ（ソース → IL 変換）
│   ├── instruction.go     命令セット定義
│   ├── compiler.go        AST → IL 命令列への変換エンジン
│   ├── compiler_state.go  コンパイル中の状態（命令バッファ・ラベル生成）
│   ├── object.go          AST ノード型（Num, Str, Message）
│   ├── parser.go          トークン列 → AST
│   ├── tokenizer.go       ソースコード → トークン列
│   ├── main.go            エントリポイント
│   └── compiler_test.go   テスト
│
└── go-vm/                ← VM（IL を受け取り実行）
    ├── vm.go              VM 実行エンジン
    ├── instruction.go     IL テキストのパーサ
    ├── object.go          ランタイムオブジェクト型
    ├── memory.go          スコープチェーン
    ├── parser.go          トークン → AST（コンパイラと同じ）
    ├── tokenizer.go       ソースコード → トークン（コンパイラと同じ）
    ├── main.go            エントリポイント
    └── vm_test.go         E2E テスト
```

---

## 命令セット（Instruction）

### 命令とは何か

BinOp のソースコードは人間が読みやすい形ですが、コンピュータが直接実行するには複雑すぎます。  
**命令（Instruction）** は、ソースコードを「もっとシンプルな操作の羅列」に分解したものです。  

各命令は「何をするか（OpCode）」と「引数（Operands）」からなります:

```go
type Instruction struct {
    Op       OpCode   // 命令の種類（例: "PUSH_NUM"）
    Operands []string // 引数（例: ["123"]）
}
```

IL（中間言語）は 1 行 1 命令のテキスト形式です:
```
PUSH_NUM 1
PUSH_NUM 2
SEND + 1
```

### 全命令一覧

#### リテラルをスタックに積む

| 命令 | 使い方 | 動作 |
|---|---|---|
| `PUSH_NUM` | `PUSH_NUM 42` | 数値 42 をスタックに積む |
| `PUSH_STR` | `PUSH_STR "hello"` | 文字列をスタックに積む |
| `PUSH_NIL` | `PUSH_NIL` | nil をスタックに積む |

#### 変数の読み書き

| 命令 | 使い方 | 動作 |
|---|---|---|
| `LOAD` | `LOAD x` | 変数 x の値をスタックに積む |
| `DEFINE` | `DEFINE x` | スタック先頭の値で変数 x を新規定義（値はスタックに残る） |
| `UPDATE` | `UPDATE x` | スタック先頭の値で変数 x を更新（値はスタックに残る） |

#### オブジェクトのスロット操作

| 命令 | 使い方 | 動作 |
|---|---|---|
| `GET_SLOT` | `GET_SLOT name` | スタックから obj を取り出し、`obj.name` をスタックに積む |
| `ASSIGN_SLOT` | `ASSIGN_SLOT name` | スタックから値と obj を取り出し、`obj.name = 値` を設定して値をスタックに積む |

#### メソッド呼び出し・関数呼び出し

| 命令 | 使い方 | 動作 |
|---|---|---|
| `SEND` | `SEND + 1` | スタックから引数 N 個とレシーバを取り出し、`recv.+(args...)` の結果を積む |
| `CALL` | `CALL add 2` | スタックから引数 N 個を取り出し、`add(args...)` の結果を積む |

**SEND と CALL の違い**:
- `SEND`: レシーバあり（`1 + 2` → `1.+(2)` → レシーバは `1`）
- `CALL`: レシーバなし（`add(1, 2)` → グローバル関数 `add` を呼ぶ）

#### スタック操作

| 命令 | 使い方 | 動作 |
|---|---|---|
| `POP` | `POP` | スタック先頭の値を捨てる |

#### 制御フロー（ジャンプ）

| 命令 | 使い方 | 動作 |
|---|---|---|
| `JUMP` | `JUMP L0` | 無条件でラベル L0 へジャンプ |
| `JUMP_IF_NIL` | `JUMP_IF_NIL L0` | スタック先頭が nil ならジャンプ（値はスタックに残る） |
| `JUMP_IF_NOT_NIL` | `JUMP_IF_NOT_NIL L0` | スタック先頭が nil 以外ならジャンプ（値はスタックに残る） |
| `LABEL` | `LABEL L0` | ジャンプ先のマーカー（実行時は何もしない） |

#### 関数・マクロ定義

| 命令 | 使い方 | 動作 |
|---|---|---|
| `MAKE_FUN` | `MAKE_FUN 2 a b` | 2 個のパラメータ a, b を持つ関数の定義開始 |
| `END_FUN` | `END_FUN` | 関数定義終了。Fun オブジェクトをスタックに積む |
| `MAKE_MACRO` | `MAKE_MACRO 2 a b` | マクロの定義開始（go-compiler-vm では未サポート） |
| `END_MACRO` | `END_MACRO` | マクロ定義終了（go-compiler-vm では未サポート） |

---

## スタックマシンとは

### 概念

**スタック**とは「後から入れたものを先に取り出す」データ構造です（皿を積み上げるイメージ）。

スタックマシンは、このスタックを使って計算します:
- 値は `push`（積む）で入れる
- 値は `pop`（取り出す）で出す
- 演算は「必要な値を pop → 計算 → 結果を push」で行う

### 例: `1 + 2` の計算

```
命令         スタックの状態       説明
─────────────────────────────────────────
初期状態      []
PUSH_NUM 1   [1]               1 を積む
PUSH_NUM 2   [1, 2]            2 を積む
SEND + 1     [3]               2 を pop、1 を pop、1+2=3 を積む
```

最終的にスタックに残った `3` が結果です。

### なぜスタックマシンなのか

- **シンプル**: 操作が push/pop だけで、実装が簡単
- **レジスタ不要**: 「どこに一時保存するか」を考えなくてよい
- **コンパイラが書きやすい**: 式を左から順にコンパイルするだけでよい

---

## コンパイラの仕組み

### AST を命令列に変換するルール

コンパイラは AST（構文木）を**深さ優先**で走査し、命令を出力します。

#### リテラル

```
BinOp:   123          →  PUSH_NUM 123
BinOp:   "hello"      →  PUSH_STR "hello"
BinOp:   nil          →  PUSH_NIL
BinOp:   x（変数）     →  LOAD x
```

#### 算術・比較演算（二項演算）

パターン: `compile(左辺) + compile(右辺) + SEND 演算子 1`

```
BinOp:   1 + 2
  ↓
PUSH_NUM 1
PUSH_NUM 2
SEND + 1
```

```
BinOp:   1 + 2 * 3    （パーサが 1 + (2*3) に変換済み）
  ↓
PUSH_NUM 1
PUSH_NUM 2
PUSH_NUM 3
SEND * 1
SEND + 1
```

#### セミコロン（順次処理）

パターン: `compile(左辺) + POP + compile(右辺)`

```
BinOp:   a ; b
  ↓
（a のコンパイル結果）
POP            ← a の結果を捨てる
（b のコンパイル結果）
               ← b の結果が残る（これが全体の戻り値）
```

#### 変数定義と更新

```
BinOp:   x := 5       →  PUSH_NUM 5 / DEFINE x
BinOp:   x = x + 1    →  LOAD x / PUSH_NUM 1 / SEND + 1 / UPDATE x
BinOp:   obj.x := 5   →  LOAD obj / PUSH_NUM 5 / ASSIGN_SLOT x
```

#### 論理演算（短絡評価）

`&&`: 左辺が nil なら右辺を評価しない

```
BinOp:   a && b
  ↓
（a のコンパイル結果）
JUMP_IF_NIL L0      ← a が nil ならジャンプ（nil はスタックに残る）
POP                 ← a が nil でない → a の値を捨てる
（b のコンパイル結果）← b の値がスタックに残る
LABEL L0            ← nil の場合はここに来る（nil はスタックにある）
```

`||`: 左辺が nil でなければ右辺を評価しない

```
BinOp:   a || b
  ↓
（a のコンパイル結果）
JUMP_IF_NOT_NIL L0  ← a が nil 以外ならジャンプ（a はスタックに残る）
POP                 ← a が nil → a を捨てる
（b のコンパイル結果）
LABEL L0
```

#### if 文

```
BinOp:   (cond).if(trueCase, falseCase)
  ↓
（cond のコンパイル結果）
JUMP_IF_NIL L_else   ← nil（偽）なら else へ
POP                  ← cond の値を捨てる（真ブランチで不要）
（trueCase のコンパイル結果）
JUMP L_end
LABEL L_else
POP                  ← nil を捨てる
（falseCase のコンパイル結果）
LABEL L_end
```

**例: `(2 > 1).if("big", "small")` のコンパイル結果**

```
PUSH_NUM 2
PUSH_NUM 1
SEND > 1
JUMP_IF_NIL L0
POP
PUSH_STR "big"
JUMP L1
LABEL L0
POP
PUSH_STR "small"
LABEL L1
```

#### 関数定義

```
BinOp:   fun(a, b, a+b)
  ↓
MAKE_FUN 2 a b    ← パラメータ数 2、名前は a と b
  LOAD a
  LOAD b
  SEND + 1
END_FUN           ← ここで Fun オブジェクトをスタックに積む
```

MAKE_FUN と END_FUN の間が関数本体の命令列です。  
VM はこの範囲を取り出して Fun オブジェクトに格納します。

#### メソッド呼び出しと関数呼び出し

```
BinOp:   obj.print()    →  LOAD obj / SEND print 0
BinOp:   obj.foo(1, 2)  →  LOAD obj / PUSH_NUM 1 / PUSH_NUM 2 / SEND foo 2
BinOp:   add(1, 2)      →  PUSH_NUM 1 / PUSH_NUM 2 / CALL add 2
```

### コンパイル状態管理（compiler_state.go）

```go
type CompilerState struct {
    instructions []Instruction  // 生成中の命令リスト
    labelCounter int            // ラベル生成カウンタ
}

// 命令を追加
cs.Emit(OP_PUSH_NUM, "42")

// ユニークなラベルを生成: L0, L1, L2, ...
label := cs.NewLabel()
```

---

## VM の仕組み

### 実行ループの構造

```go
func (vm *VM) executeFrame(instructions []Instruction, env *Memory) BoObject {
    stack := []BoObject{}                     // スタック（初期は空）
    labelMap := buildLabelMap(instructions)   // ラベル名 → 命令インデックスのマップ
    pc := 0                                   // プログラムカウンタ（次に実行する命令番号）

    for pc < len(instructions) {
        inst := instructions[pc]

        switch inst.Op {
        case OP_PUSH_NUM:
            v, _ := strconv.ParseFloat(inst.Operands[0], 64)
            stack = append(stack, NewNum(v))  // push

        case OP_POP:
            stack = stack[:len(stack)-1]      // pop

        case OP_LOAD:
            val := env.Get(inst.Operands[0])
            stack = append(stack, val)        // push

        // ... その他の命令処理 ...

        }
        pc++
    }

    return stack[len(stack)-1]  // 最終結果
}
```

`pc`（プログラムカウンタ）が命令を指すポインタです。通常は毎回 `pc++` で進みますが、ジャンプ命令が来たときだけ別の位置に飛びます。

### 関数呼び出しの仕組み

関数が呼び出されるたびに `executeFrame()` が**再帰的に呼ばれ**、新しいスタックとスコープが作られます。

```
グローバル実行 executeFrame()
  └── スタック: []
  └── env: グローバル環境 {add: Fun, x: 5, ...}
       │
       │ CALL add 2 → callFun() → executeFrame() が再帰呼び出し
       ▼
  add 関数の実行 executeFrame()
    └── スタック: []（新しい独立したスタック）
    └── env: add のローカルスコープ {a: 1, b: 2}
             └── super → グローバル環境
```

各関数呼び出しは**完全に独立したスタック**を持ちます。

### 関数とクロージャ

```go
type Fun struct {
    Params     []string       // パラメータ名 ["a", "b"]
    Body       []Instruction  // 関数本体の命令列
    CreatedEnv *Memory        // 定義時の環境（クロージャ用）
}
```

```go
func (vm *VM) callFun(this *UserObject, fn *Fun, args []BoObject) BoObject {
    // fn.CreatedEnv の子スコープを作成
    closure := fn.CreatedEnv.SubMemory()
    
    // パラメータを定義
    for i, param := range fn.Params {
        closure.DefineForce(param, args[i])
    }
    if this != nil {
        closure.DefineForce("this", this)
    }
    
    // 関数本体を新スコープで実行
    return vm.executeFrame(fn.Body, closure)
}
```

**クロージャの仕組み**:
```
makeCounter := fun(c := 0; fun(c = c+1))
counter := makeCounter()
```

```
makeCounter() 呼び出し時:
  新スコープ A = { c: 0 }
  内側の fun の CreatedEnv = スコープ A
  
counter() 呼び出し時:
  新スコープ B = { super: スコープ A }
  c を探す → スコープ B にない → スコープ A を探す → c = 0 が見つかる
  c = c + 1 → スコープ A の c を 1 に更新
```

### スコープチェーン（memory.go）

```go
type Memory struct {
    Super *Memory                // 親スコープへのポインタ
    Slots map[string]BoObject   // この階層の変数
}

// 変数を探すときはチェーンをたどる
func (m *Memory) Find(name string) map[string]BoObject {
    if _, ok := m.Slots[name]; ok {
        return m.Slots   // この階層で見つかった
    }
    if m.Super != nil {
        return m.Super.Find(name)  // 親を探す
    }
    return nil  // 見つからなかった
}
```

### 算術・比較演算

`SEND + 1` などの算術命令は、スタックからレシーバと引数を取り出して計算します:

```go
// 数値同士の演算
switch op {
case "+": return NewNum(lNum.Value + rNum.Value)
case "-": return NewNum(lNum.Value - rNum.Value)
case "*": return NewNum(lNum.Value * rNum.Value)
case "/": return NewNum(lNum.Value / rNum.Value)
}

// 文字列の特殊演算
// "abcd" + "ef"  → "abcdef"（連結）
// "abcd" / 2    → "ab"（前半2文字）
// "abcd" % 2    → "cd"（後半）
```

比較演算は `nil`（偽）か `1`（真）を返します:
```go
case "==": if cmp == 0 { return NewNum(1) } else { return NIL }
case "<":  if cmp < 0  { return NewNum(1) } else { return NIL }
```

### 組み込みメソッド

VM は以下の組み込みメソッドを特別扱いします:

| メソッド | 動作 |
|---|---|
| `print()` | レシーバの値を出力し、レシーバを返す |
| `clone()` | レシーバをコピーして返す |
| `if(true, false)` | レシーバが nil でなければ true を評価、nil なら false を評価 |
| `doWhile(block)` | レシーバ（Fun）が nil を返すまで block を繰り返す |

---

## 完全な実行例

### `add := fun(a, b, a+b); add(2, 3)` を実行する

#### ステップ 1: コンパイル結果

```
MAKE_FUN 2 a b
  LOAD a
  LOAD b
  SEND + 1
END_FUN
DEFINE add
POP
PUSH_NUM 2
PUSH_NUM 3
CALL add 2
```

#### ステップ 2: VM 実行の流れ

```
命令                スタック         環境
────────────────────────────────────────────────────
MAKE_FUN 2 a b     []           グローバル: {}
  （body 命令を抽出して Fun を作成）
END_FUN            [Fun]        グローバル: {}
DEFINE add         [Fun]        グローバル: {add: Fun}
POP                []           グローバル: {add: Fun}
PUSH_NUM 2         [2]
PUSH_NUM 3         [2, 3]
CALL add 2         ── callFun() を呼ぶ ──
                       新スコープ: {a: 2, b: 3, super: グローバル}
                       LOAD a    [2]
                       LOAD b    [2, 3]
                       SEND + 1  [5]
                   ── 結果 5 を返す ──
                   [5]

最終結果: 5
```

---

## インタープリタとの違い・制限事項

### 対応機能の比較

| 機能 | go-compiler-vm | ts-interpreter | go-interpreter |
|---|---|---|---|
| 基本的な演算・制御 | ✅ | ✅ | ✅ |
| 関数・クロージャ | ✅ | ✅ | ✅ |
| オブジェクト | ✅ | ✅ | ✅ |
| **マクロ** | ❌ | ✅ | ✅ |
| **メタプログラミング** | ❌ | ✅ | ✅ |

### マクロが使えない理由

マクロは「評価前の AST ノードを引数として受け取る」機能です。  
しかしコンパイラは AST を命令列に変換してしまうため、元の AST 情報が失われます。  
VM は命令列しか持っていないので、AST を再現することができません。

```go
// コンパイラでマクロを検出したらエラー
if mes.SlotName == "macro" {
    panic("ERROR: macro is not supported in go-compiler-vm")
}
```

### 実行モデルの違い

| 項目 | インタープリタ | go-compiler-vm |
|---|---|---|
| 実行ステップ | 1段階（AST を直接評価） | 2段階（コンパイル → VM実行） |
| 中間形式 | なし | IL テキスト（人間が読める） |
| デバッグ | AST をトレース | IL を目視確認できる |
| スタック管理 | 再帰呼び出し（+CPS） | 明示的なスタック配列 |

IL テキストを `echo` で確認することで、コンパイラが何を生成しているか確認できます:
```bash
./go-compiler/binop-compiler sample.bo
# → IL テキストが標準出力に表示される
```

---

## テスト構成

### go-compiler テスト（compiler_test.go）

コンパイラの各変換ルールを単体テスト。「このコードを渡すと、この IL が生成される」を検証します。

```go
{"123",          "PUSH_NUM 123"},
{"1+2",          "PUSH_NUM 1\nPUSH_NUM 2\nSEND + 1"},
{"fun(a, b, a+b)", "MAKE_FUN 2 a b\nLOAD a\nLOAD b\nSEND + 1\nEND_FUN"},
```

### go-vm テスト（vm_test.go）

ソースコード → コンパイル → VM 実行の E2E テスト。

```go
type testCase struct {
    code        string  // BinOp ソースコード
    mustBe      string  // 実行結果の期待値
    printMustBe string  // print 出力の期待値
}
```

テスト項目: 基本演算、文字列操作、変数、関数・再帰、クロージャ、オブジェクト、print 出力、リスト構造。
