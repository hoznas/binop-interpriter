# binop-interpriter
## 特徴
サンプルコードsample.boに書いてあります。
- https://github.com/hoznas/binop-interpriter/blob/main/sample.bo


## 実行
### サンプルの実行
```tsc && node main sample.bo```

### テストの実行
```tsc && node tests```


## ファイル構成
|ファイル名|概要|
|---------|------------------|
|main.ts|BinOp言語のメイン処理が書いてある。実行時に引数(実行したいファイル名)をとる|
|tokenizer.ts|プログラムコードを意味のある単位（トークン）に分解|
|parser.ts|トークンの列を文法上意味のある構造（AST）に変換|
|types.ts|各種オブジェクトの定義はここにあります|
|evaluator.ts|parserで渡されたASTを評価|
|builtin-functions.ts|組み込み関数の定義|
|tests.ts|上記ファイルのテストファイル|
|sample.bo|サンプルプログラム|
|bo.bnf|文法規則。作成中。プログラムで使用していない|
