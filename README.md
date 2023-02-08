# binop-interpriter
## 特徴
サンプルコードsample.boに書いてあります。

## 実行
### サンプル実行
tsc && node main
もし、任意のファイルを実行したいときは、main.tsの中で任意のファイルを指定してください。

### テストの実行
tsc && node tests

## ファイル構成
- main.ts BinOp言語のメイン処理が書いてある
- tokenizer.ts プログラムコードを意味のある単位（トークン）に分解
- parser.ts トークンの列を文法上意味のある構造（AST）に変換
- types.ts 各種オブジェクトの定義はここにあります
- evaluetor.ts parserで渡されたASTを評価。
- builtin-functions.ts 組み込む関数の定義。(if,fun.evalStrの３つだけ)
- tests.ts 上記ファイルのテストファイル
- sample.bo サンプルプログラム
