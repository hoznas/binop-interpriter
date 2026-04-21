# ts-interpreter

BinOp 言語の TypeScript によるインタプリタ実装。

サンプルコードは [../sample.bo](../sample.bo)、文法規則は [../bo.bnf](../bo.bnf) を参照。

## 実行

### サンプルの実行

```bash
tsc && node main ../sample.bo
```

### テストの実行

```bash
tsc && node tests
```

## ファイル構成

| ファイル名           | 概要                                                       |
| -------------------- | ---------------------------------------------------------- |
| main.ts              | エントリポイント。実行時に引数(実行したいファイル名)をとる |
| tokenizer.ts         | プログラムコードを意味のある単位（トークン）に分解         |
| parser.ts            | トークンの列を文法上意味のある構造（AST）に変換            |
| evaluator.ts         | AST を評価するインタプリタ本体                             |
| object.ts            | 各種オブジェクトの定義                                     |
| builtin-functions.ts | 組み込み関数の定義                                         |
| tests.ts             | テストを実行する                                           |
