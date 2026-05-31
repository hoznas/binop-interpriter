# ts-interpreter 概要

TypeScript で実装された BinOp インタープリタ。  
**CPS（継続渡しスタイル）+ トランポリン**によりスタックオーバーフローを防ぎながら評価を行います。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `main.ts` | Node.js エントリポイント。ファイルを読み込んで評価 |
| `tokenizer.ts` | ソースコード → トークン列 |
| `parser.ts` | トークン列 → AST |
| `object.ts` | BinOp のオブジェクト型定義（9種類） |
| `memory.ts` | レキシカルスコープチェーン |
| `evaluator.ts` | CPS + トランポリンによる評価器本体 |
| `builtin-functions.ts` | 組み込み関数（fun, macro, if, print, clone など）|
| `printer.ts` | テスト用 print 出力キャプチャ |
| `web-adapter.ts` | ブラウザ向けアダプタ（`window.BinOp` を公開） |
| `tests.ts` | テストスイート（約 77 ケース） |

## 処理パイプライン

```
ソース文字列
  ↓ tokenize()        tokenizer.ts
トークン列
  ↓ parse()           parser.ts
AST（BoObject の木）
  ↓ evalNodeK()       evaluator.ts
評価結果（BoObject）
```

## オブジェクト型（object.ts）

すべて抽象クラス `BoObject` を継承します。

| 型 | 説明 |
|---|---|
| `Num` | 浮動小数点数 |
| `Str` | 文字列 |
| `Nil` | 唯一の偽値（シングルトン `NIL`） |
| `Message` | AST ノード。演算子・メソッド呼び出し・変数参照をすべて表現 |
| `Fun` | クロージャ（定義時の環境 `createdEnv` を保持） |
| `Macro` | マクロ（未評価の AST を引数として受け取る） |
| `UserObject` | ユーザー定義オブジェクト（スロットマップ + プロトタイプ親） |
| `BuiltinFunction` | 組み込み関数（CPS 版コールバック） |

```typescript
// Message の例: "1 + 2" は以下の AST になる
Message {
  receiver: Num(1),
  slotName: "+",
  args: [Num(2)],
  hasArgs: true
}
```

## スコープ（memory.ts）

```typescript
class Memory {
  super: Memory | undefined;       // 親スコープへのポインタ
  slots: Map<string, BoObject>;    // 変数マップ
  
  define(name, value)   // 現スコープに新規定義（:= に対応）
  update(name, value)   // スコープチェーンをたどって更新（= に対応）
  get(name)             // スコープチェーンをたどって取得
  subMemory()           // 子スコープを生成
}
```

## トークナイザ（tokenizer.ts）

正規表現ベース。処理の流れ:

```
1. preprocess(): 改行・複数の ; を単一の ; に統一
2. makeTokenList(): 正規表現で順次マッチしてトークン列を生成
3. filterSemicolon(): 不要な ; を除去（先頭・末尾・連続・括弧隣接など）
```

トークン種別: `num`（数値）/ `str`（文字列）/ `sym`（識別子）/ `binop`（演算子）/ `(`  / `)`

## パーサ（parser.ts）

演算子優先順位に基づく再帰下降パーサ。

```
parseBinOp(depth=9)  ← 最低優先度（;）から始める
  ↓ 再帰
parseBinOp(depth=8)  ← ユーザー定義演算子
  ↓ ...
parseBinOp(depth=0)  ← .（最高優先度）
  ↓
parseFactor()        ← リテラル・括弧・識別子
```

優先度テーブル（数値が小さい = 結合が強い）:

| 優先度 | 演算子 |
|---|---|
| 0 | `.` |
| 1 | `* / %` |
| 2 | `+ -` |
| 3 | `< > <= >=` |
| 4 | `== !=` |
| 5 | `&& \|\|` |
| 7 | `:= =` |
| 8 | ユーザー定義（識別子形式） |
| 9 | `;` |
| 10 | `,` |

## 評価器：CPS + トランポリン（evaluator.ts）

### なぜ CPS が必要か

深い再帰（例: 10000回の再帰関数）を素直に実装すると、JavaScript のコールスタックが溢れてクラッシュします。  
CPS + トランポリンはこれを防ぐための技法です。

### 関係する型

```typescript
// 継続: 評価結果を受け取り、次の計算を返す関数
type Continuation = (result: BoObject) => Bounce;

// Thunk: 「まだ実行していない計算」を箱に詰めたもの
class Thunk {
  constructor(public fn: () => Bounce) {}
}

// Bounce: 評価の中間状態。最終結果か、まだ続く計算か
type Bounce = BoObject | Thunk;

// トランポリン: Thunk を開封し続けて最終結果を得る
const trampoline = (bounce: Bounce): BoObject => {
  while (bounce instanceof Thunk) {
    bounce = bounce.fn();  // Thunk を開封して実行
  }
  return bounce;
};
```

### CPS の読み方

評価関数はすべて末尾に `K`（Kontinuation の K）が付き、継続 `k` を引数に取ります。

```typescript
// 「a + b を評価する」の CPS 版
const evalArithmeticOpK = (lhs, op, rhs, env, k) => {
  return evalNodeK(lhs, env,            // まず lhs を評価する
    (eLhs) =>                           // 結果を eLhs として受け取ったら
      new Thunk(() =>                   // スタックを積まないよう Thunk で包む
        evalNodeK(rhs, env,             // 次に rhs を評価する
          (eRhs) => k(compute(eLhs, op, eRhs))  // 計算して継続に渡す
        )
      )
  );
};
```

**Thunk で包む理由**: 継続を即座に呼ばず「後で実行する処理」として箱に入れることで、実際のコールスタックを消費しません。  
トランポリンが繰り返し Thunk を開封するので、どれだけ深い再帰でもスタック使用量は一定です。

### 主な評価関数

| 関数 | 役割 |
|---|---|
| `evalNodeK(node, env, k)` | ノード種別で分岐する評価のエントリポイント |
| `evalArithmeticOpK(...)` | `+ - * / %` の評価 |
| `evalCompareOpK(...)` | `== != < <= > >=` の評価 |
| `evalSpecialOpK(...)` | `; && \|\| := =` の評価 |
| `evalMessageK(...)` | メソッド呼び出し・スロットアクセス |
| `evalFunCallK(...)` | ユーザー定義関数の呼び出し |
| `evalMacroCallK(...)` | マクロの呼び出し |

### 短絡評価（&& と ||）

```typescript
// a && b: a が nil なら即座に nil を返す（b は評価しない）
evalNodeK(lhs, env, (eLhs) =>
  eLhs === NIL ? k(NIL) : new Thunk(() => evalNodeK(rhs, env, k))
);

// a || b: a が nil でなければ a を返す（b は評価しない）
evalNodeK(lhs, env, (eLhs) =>
  eLhs !== NIL ? k(eLhs) : new Thunk(() => evalNodeK(rhs, env, k))
);
```

## テスト構成（tests.ts）

Node.js 標準 `test` モジュールを使用。約 77 テストケース。

| カテゴリ | 内容 |
|---|---|
| Tokenizer | セミコロン正規化、各種トークン種別 |
| Parser | 演算子優先順位、括弧処理、中置演算子 |
| Memory | スコープチェーン、`:=`/`=` の挙動 |
| Evaluator | 数値・文字列・演算・変数・関数・再帰・クロージャ・オブジェクト・マクロ・メタプログラミング |

テストは各層を独立してテストしており（トークナイザ→パーサ→評価器の順）、問題の特定が容易です。
