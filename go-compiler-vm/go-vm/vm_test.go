package main

import "testing"

// --- ヘルパー ---

type LogPrinter struct {
	PrintLogs []string
}

func NewLogPrinter() *LogPrinter {
	return &LogPrinter{}
}

func (lp *LogPrinter) GetPrintFunction() PrintFunc {
	return func(msg string) {
		lp.PrintLogs = append(lp.PrintLogs, msg)
	}
}

func (lp *LogPrinter) GetLastLog() *string {
	if len(lp.PrintLogs) == 0 {
		return nil
	}
	s := lp.PrintLogs[len(lp.PrintLogs)-1]
	return &s
}

// --- ソースコード→コンパイル→VM実行のE2Eテスト ---

func TestVM(t *testing.T) {
	type testCase struct {
		code        string
		mustBe      string
		printMustBe string
	}

	tests := []testCase{
		// リテラル
		{"123", "123", ""},
		{`"abc def"`, `"abc def"`, ""},
		// 算術
		{"1+2*3", "7", ""},
		{"(1+2)*3", "9", ""},
		{"(1+2)", "3", ""},
		// 文字列演算
		{`"abc" + "def"`, `"abcdef"`, ""},
		{`"abc" + 123`, `"abc123"`, ""},
		{`"abc" / 1`, `"a"`, ""},
		{`"abc" % 1`, `"bc"`, ""},
		{`123 + "123"`, "246", ""},
		// 比較
		{"1 + 1 == 3", "nil", ""},
		{"2>1", "1", ""},
		// セミコロン
		{"1 + 1;2*4", "8", ""},
		// 変数
		{"a := 5; a*4", "20", ""},
		{"b := 5; b=b+1; b", "6", ""},
		// 論理演算(短絡評価)
		{"1 && nil", "nil", ""},
		{"nil && nil", "nil", ""},
		{"nil && 1", "nil", ""},
		{"1 && 1", "1", ""},
		{"nil || nil", "nil", ""},
		{"1 || nil", "1", ""},
		{"nil || 1", "1", ""},
		{"1 || 1", "1", ""},
		// print
		{"(1+2).print()", "3", "3"},
		// 関数定義
		{"f:=fun((1+2).print());f()", "3", "3"},
		// 関数(引数あり)
		{"add:=fun(a,b,a+b);add(6/3,2)", "4", ""},
		// if
		{`(2>1).if("big","small")`, `"big"`, ""},
		{`(1>2).if("big","small")`, `"small"`, ""},
		// 再帰
		{"pow:=fun(n,(n<=1).if(1,n*pow(n-1)));pow(3)", "6", ""},
		// クロージャ
		{"create:=fun(c:=0;fun(c=c+1));counter:=create();counter();counter()", "2", ""},
		// Object
		{"Object", "{}", ""},
		{"Object.clone()", "{}", ""},
		{"123.clone()", "123", ""},
		// Objectスロット
		{"o:=Object.clone();o.x:=1", "1", ""},
		{"o.x", "1", ""},
		// Object メソッド呼び出し
		{`cons:=fun(a,b,o:=Object.clone();o.car=a;o.cdr=b;o);1`, "1", ""},
		{"cons(1,2)", "{car:1,cdr:2}", ""},
		// リスト(再帰)
		{"list:=fun(i,n,(i<n).if(cons(i,list(i+1,n)),nil));1", "1", ""},
		{
			"l:=list(0,10)",
			"{car:0,cdr:{car:1,cdr:{car:2,cdr:{car:3,cdr:{car:4,cdr:{car:5,cdr:{car:6,cdr:{car:7,cdr:{car:8,cdr:{car:9,cdr:nil}}}}}}}}}}",
			"",
		},
		{"sum:=fun(ls, ls.if(ls.car+sum(ls.cdr),0));1", "1", ""},
		{"sum(l)", "45", ""},
		// this
		{
			"obj:=Object.clone();obj.v:=12;obj.f:=fun(a,b,this.v+a+b);obj.f(3,2)",
			"17", "",
		},
		{
			"obj2:=Object.clone();obj2.setA=fun(arg,this.a=arg);obj2 setA 123;obj2.a",
			"123", "",
		},
		// if with one branch
		{`1.if("t","f")`, `"t"`, ""},
	}

	logPrinter := NewLogPrinter()
	vm := NewVM(logPrinter.GetPrintFunction())
	for _, tt := range tests {
		result := vm.Run(tt.code).Str()
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result] %s\n[MustBe] %s", tt.code, result, tt.mustBe)
		}
		if tt.printMustBe != "" {
			lastLog := logPrinter.GetLastLog()
			if lastLog == nil || *lastLog != tt.printMustBe {
				actual := "<nil>"
				if lastLog != nil {
					actual = *lastLog
				}
				t.Errorf("[Code] %s [PrintLog] %s [MustBe] %s", tt.code, actual, tt.printMustBe)
			}
		}
	}
}

// --- ILテキストからのVM実行テスト ---

func TestVMFromIL(t *testing.T) {
	il := `PUSH_NUM 1
PUSH_NUM 2
SEND + 1`

	vm := NewVM(nil)
	result := vm.RunIL(il)
	if result.Str() != "3" {
		t.Errorf("[IL] 1+2 [Result] %s [MustBe] 3", result.Str())
	}
}

// --- go-compiler出力→VM実行のパイプラインテスト ---

func TestCompileThenExecute(t *testing.T) {
	code := "a := 5; a * 4"
	ilText := Compile(code)
	vm := NewVM(nil)
	result := vm.RunIL(ilText)
	if result.Str() != "20" {
		t.Errorf("[IL Pipeline] %s → %s (expected 20)", code, result.Str())
	}
}
