# binop-interpriter
##　特徴
以下のサンプルコードに書いてあります。

## sample code
'''
"BinOp言語"

"特徴"
"プロトタイプベースのオブジェクト指向言語"
"この言語は数値、文字列、関数以外のだいたいを2項演算子で表現している"
"BINary OPerator(2項演算子)。略してBinOp言語"

"コメント"
"BinOp言語にはコメントがないので、プログラムに影響の無い位置に文字列を置く"

"セミコロンと改行"
"どちらも順次処理を行う2項演算子"
"a;b は、a、bの順番に評価が行われる"

"以下、サンプルプログラム"

"数値"
1
123
"少数、マイナスのリテラルはないので計算で作る"
1/10; "0.1"
0-1; "-1"

"文字列"
"文字列にダブルクォーテーションを含めることはできない"
"Hello world!"

"真偽値"
nil; "偽を表す"
0; ""; "数値、文字列は全て真"
1 > 0; "比較演算子は、偽の場合nilを返し、正の場合非nilを返す"

"変数"
v := 1; "変数の宣言"
v = v + 5; "再代入"
v.print(); "6と表示"

"数式処理"
n := 1 + (2 - 3) * 4
n.print(); "-3と表示"

"条件分岐"
if(n==7,
  "seven",
  "not seven"
).print(); "not sevenと表示"

"関数"
addPrint := fun(a,b,
  result := a+b
  result.print()
  "最後に評価した値が戻り値になる"
  result)
addPrint(3,6); "9と表示"

"繰り返し処理"
"ループ表現は無く、再帰のみで繰り返し処理を行う"
factorial := fun(n,
  if(n>1,
    n * factorial(n-1),
    1))
factorial(4).print(); "24と表示(4!=24)"

"クロージャ"
makeCounter := fun(n:=0;fun(n=n+1))
counter := makeCounter()
counter().print(); "1が表示される"
counter().print(); "2が表示される"

"オブジェクトの作成とクローン"
Dog := fun(name,age,
  dogClass := Object.clone()
  "objectのプロパティへの代入は=と:=のどちらを使っても構わない"
  dogClass.name = name
  dogClass.age := age
  dogClass.greet = fun("I'm " + this.name)
  dogClass)

dog1 := Dog("Foo", 10)
dog2 := dog1.clone()
dog2.name = "Bar";  "objectのslotへの代入はクローン元に影響しない"
dog2.age = 6
dog3 := Dog("Baz", 1)

dog1.greet().print(); "I'm Fooと表示"
dog2.greet().print(); "I'm Barと表示"
dog3.greet().print(); "I'm Bazと表示"

"データ構造の例"
"組み込みのデータ構造はObjectしか無い"
Cell := fun(a,b,
	cellClass := Object.clone()
	cellClass.head := a
	cellClass.tail := b
	cellClass)

list := fun(i,n,
	if(i<n,
		Cell(i,list(i+1,n)),
		nil))

sum := fun(lst,
	if(lst,
		lst.head + sum(lst.tail),
		0));

numbers := list(0,5)
numbers.print(); "0,1,2,3,4を表すリストを表示"
sum(numbers).print(); "10を表示"

"Todo"
"末尾再起の最適化"
"マクロの実装"
"もっとプロトタイプベースのオブジェクト指向言語にする"
'''
