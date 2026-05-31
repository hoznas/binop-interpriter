# go-interpreter 概要

Go で実装された BinOp インタープリタ。  
TypeScript 版と同じ言語仕様を持ちますが、**直接再帰**で評価を行います（CPS + トランポリンは使用していません）。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `main.go` | エントリポイント。コマンドライン引数のファイルを評価 |
| `tokenizer.go` | ソースコード → トークン列 |
| `parser.go` | トークン列 → AST |
| `object.go` | BinOp のオブジェクト型定義 |
| `memory.go` | レキシカルスコープチェーン |
| `evaluator.go` | 評価器本体（直接再帰） |
| `builtin_functions.go` | 組み込み関数（fun, macro, if, print, clone など） |
| `printer.go` | テスト用 print 出力キャプチャ |
| `tokenizer_test.go` | トークナイザのテスト |
| `parser_test.go` | パーサのテスト |
| `evaluator_test.go` | 評価器の統合テスト（約 86 ケース） |
| `memory_test.go` | スコープチェーンのテスト |

## 処理パイプライン

```
ソース文字列
  ↓ Tokenize()         tokenizer.go
トークン列
  ↓ Parse()            parser.go
AST（BoObject の木）
  ↓ EvalNode()         evaluator.go
評価結果（BoObject）
```

## オブジェクト型（object.go）

すべて `BoObject` インターフェースを実装します。

```go
type BoObject interface {
    Str() string
    Compare(other BoObject) int
    Clone() BoObject
}
```

| 型 | 説明 |
|---|---|
| `Num` | 浮動小数点数（`Value float64`） |
| `Str` | 文字列（`Value string`） |
| `NilObj` | 唯一の偽値（グローバルシングルトン `NIL`） |
| `Message` | AST ノード。演算子・メソッド・変数をすべて表現 |
| `Fun` | クロージャ（`ArgList`, `Body`, `CreatedEnv` を保持） |
| `Macro` | マクロ（未評価の AST を引数として受け取る） |
| `UserObject` | ユーザー定義オブジェクト（`Mem *Memory` + `Proto *UserObject`） |
| `BuiltinFunction` | 組み込み関数 |

```go
// Message の構造
type Message struct {
    Receiver BoObject   // nil = レシーバなし
    SlotName string     // 演算子・メソッド名・変数名
    Args     []BoObject
    HasArgs  bool       // () の有無（変数参照と関数呼び出しを区別）
}
```

**HasArgs の重要性**: `print` は変数参照（関数オブジェクトを返す）、`print()` は関数呼び出し（実行する）として区別します。

## スコープ（memory.go）

```go
type Memory struct {
    Super *Memory                // 親スコープへのポインタ
    Slots map[string]BoObject   // この階層の変数マップ
    Order []string               // 挿入順序の記録
}
```

- `Define()`: 現スコープに定義（`:=` に対応）。すでに存在する場合は失敗
- `Update()`: スコープチェーンをたどって更新（`=` に対応）
- `Get()`: スコープチェーンをたどって取得
- `SubMemory()`: 子スコープを生成（Super に自分を設定）

**Order フィールドの理由**: Go の `map` はイテレーション順序を保証しないため、UserObject の文字列表現で挿入順を維持するために別途記録します。

## トークナイザ（tokenizer.go）

TypeScript 版と同じ処理:

```
1. preprocess(): 改行・複数の ; を単一の ; に正規化
2. makeTokenList(): 正規表現で順次マッチ
3. filterSemicolon(): 不要な ; を除去
```

## パーサ（parser.go）

TypeScript 版と同じ演算子優先順位パーサ。`binOpRate()` 関数で優先度を定義。

```
parseBinOp(reader, depth=9) から始まり、depth を下げながら再帰。
depth=-1 で parseFactor() に到達し、リテラル・括弧・識別子を解析。
```

**`.` 演算子の特殊処理**: `a.foo(b)` は `Message{Receiver: a, SlotName: "foo", Args: [b]}` に正規化されます。`NewMessage()` 関数内で `.` の右辺の Message を展開しています。

## 評価器（evaluator.go）

### TypeScript 版との違い

TypeScript 版は CPS + トランポリンを使いますが、**Go 版は直接再帰**です。  
Go のゴルーチンスタックは動的に拡張される（初期 1MB～最大数 GB）ため、深い再帰でもすぐにはクラッシュしません。

### 評価のエントリポイント

```go
func EvalNode(node BoObject, env *Memory) BoObject {
    // Num, Str, Nil, Fun, Macro, UserObject はそのまま返す
    // Message だけ評価が必要
    
    mes, ok := node.(*Message)
    if !ok {
        return node
    }
    
    // 演算子の種類に応じて分岐
    switch mes.SlotName {
    case "+", "-", "*", "/", "%":
        return evalArithmeticOp(mes.Receiver, mes.SlotName, mes.Args[0], env)
    case "==", "!=", "<", "<=", ">", ">=":
        return evalCompareOp(...)
    case "=", ":=", ".", ";", ",", "&&", "||":
        return evalSpecialOp(...)
    default:
        return EvalMessage(mes, env)
    }
}
```

### 特殊演算子の実装

```go
// セミコロン: 左辺を評価して捨て、右辺を返す
case ";":
    EvalNode(lhs, env)         // 評価するが結果は捨てる
    return EvalNode(rhs, env)  // 右辺の結果を返す

// 短絡評価 &&
case "&&":
    eLhs := EvalNode(lhs, env)
    if eLhs == BoObject(NIL) {
        return NIL             // 左が偽なら右を評価しない
    }
    return EvalNode(rhs, env)

// 変数定義
case ":=":
    return env.Define(lhs.SlotName, EvalNode(rhs, env))
```

### メッセージ送信（メソッド呼び出し）

```go
func EvalMessage(mes *Message, env *Memory) BoObject {
    // 1. if, print, clone, doWhile などのデフォルトメソッドをチェック
    // 2. レシーバを評価
    // 3. レシーバのスロット → グローバル環境の順でメソッドを検索
    // 4. HasArgs が false なら関数オブジェクトをそのまま返す
    // 5. HasArgs が true なら関数を呼び出す
}
```

### 関数呼び出し

```go
func EvalFunCall(this *UserObject, fun *Fun, args []BoObject, callerEnv *Memory) BoObject {
    // 1. 引数をすべて評価
    // 2. 関数定義時の環境をベースに子スコープを生成
    // 3. パラメータ名 = 評価済み引数 をスコープに定義
    // 4. this（レシーバ）があればスコープに定義
    // 5. 関数本体を新スコープで評価
}
```

**クロージャの仕組み**: 関数は定義時のスコープ（`CreatedEnv`）を保持します。呼び出し時はこの環境の子スコープでパラメータをバインドするため、定義時の変数にアクセスできます。

## テスト構成

### evaluator_test.go（86 ケース）

```go
type testCase struct {
    code        string  // 実行するコード
    mustBe      string  // 戻り値の期待値
    printMustBe string  // print 出力の期待値
}
```

| カテゴリ | 例 |
|---|---|
| 基本演算 | `"1+2*3"` → `"7"` |
| 文字列操作 | `"\"abcd\" / 2"` → `"\"ab\""` |
| 変数 | `"v:=5;v=v+1;v"` → `"6"` |
| 関数・再帰 | `"factorial(5)"` → `"120"` |
| クロージャ | カウンター関数 |
| オブジェクト | clone、スロット、プロトタイプ継承 |
| マクロ | `evalNode`, `evalStr` |

### memory_test.go

4 ケース: 同一スコープの再定義失敗、サブスコープの定義、親スコープの参照、親スコープの更新。
