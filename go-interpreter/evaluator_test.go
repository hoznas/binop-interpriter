package main

import "testing"

func TestEvaluator(t *testing.T) {
	type testCase struct {
		code        string
		mustBe      string
		printMustBe string // empty means no print check
	}

	tests := []testCase{
		{"123", "123", ""},
		{`"abc def"`, `"abc def"`, ""},
		{"1+2*3", "7", ""},
		{"(1+2)*3", "9", ""},
		{"(1+2)", "3", ""},
		{`"abc" + "def"`, `"abcdef"`, ""},
		{`"abc" + 123`, `"abc123"`, ""},
		{`"abc" / 1`, `"a"`, ""},
		{`"abc" % 1`, `"bc"`, ""},
		{`123 + "123"`, "246", ""},
		{"1 + 1 == 3", "nil", ""},
		{"1 + 1;2*4", "8", ""},
		{"a := 5; a*4", "20", ""},
		{"b := 5; b=b+1; b", "6", ""},
		{"1 && nil", "nil", ""},
		{"nil && nil", "nil", ""},
		{"nil && 1", "nil", ""},
		{"1 && 1", "1", ""},
		{"nil || nil", "nil", ""},
		{"1 || nil", "1", ""},
		{"nil || 1", "1", ""},
		{"1 || 1", "1", ""},
		{"(1+2).print()", "3", "3"},
		{"fun((1+2).print())", "fun(1.+(2).print())", ""},
		{"f:=fun((1+2).print());f()", "3", "3"},
		{"fun(a,b,(a+b).print())", "fun(a,b,a.+(b).print())", ""},
		{"add:=fun(a,b,a+b);add(6/3,2)", "4", ""},
		{"2>1", "1", ""},
		{`(2>1).if(r:="big",r:="small");r`, `"big"`, ""},
		{`(1>2).if(s:="big",s:="small");s`, `"small"`, ""},
		{"pow:=fun(n,(n<=1).if(1,n*pow(n-1)));pow(3)", "6", ""},
		{"create:=fun(c:=0;fun(c=c+1));counter:=create();counter();counter()", "2", ""},
		{"Object", "{}", ""},
		{"Object.clone()", "{}", ""},
		{"123.clone()", "123", ""},
		{"o:=Object.clone();o.x:=1", "1", ""},
		{"o", "{x:1}", ""},
		{"o.x", "1", ""},
		{`cons:=fun(a,b,o:=Object.clone();o.car=a;o.cdr=b;o);1`, "1", ""},
		{"cons(1,2)", "{car:1,cdr:2}", ""},
		{"list:=fun(i,n,(i<n).if(cons(i,list(i+1,n)),nil));1", "1", ""},
		{
			"l:=list(0,10)",
			"{car:0,cdr:{car:1,cdr:{car:2,cdr:{car:3,cdr:{car:4,cdr:{car:5,cdr:{car:6,cdr:{car:7,cdr:{car:8,cdr:{car:9,cdr:nil}}}}}}}}}}",
			"",
		},
		{"sum:=fun(ls, ls.if(ls.car+sum(ls.cdr),0));1", "1", ""},
		{"sum(l)", "45", ""},
		{
			"obj:=Object.clone();obj.v:=12;obj.f:=fun(a,b,this.v+a+b);obj.f(3,2)",
			"17", "",
		},
		{
			"obj2:=Object.clone();obj2.setA=fun(arg,this.a=arg);obj2 setA 123;obj2.a",
			"123", "",
		},
		{`message("__","method")`, "method", ""},
		{`message("_@","method")`, "method()", ""},
		{`message("_@","method", 1,2,3)`, "method(1, 2, 3)", ""},
		{`message("@_",target,"method")`, "target.method", ""},
		{`message("@@", target,"method")`, "target.method()", ""},
		{`message("@@", target,"method", 1,2,3)`, "target.method(1, 2, 3)", ""},
		{`evalNode(message("@@",5,"+",7))`, "12", ""},
		{`evalStr("5+7")`, "12", ""},
		{
			`myIf := macro(condition,trueCase,falseCase,evalNode(condition).if(evalNode(trueCase), evalNode(falseCase)));nil`,
			"nil", "",
		},
		{
			`numA := 111;numB := 222;myIf(numA<=numB, numA.print(), numB.print())`,
			"111", "111",
		},
		{`1.if("t","f")`, `"t"`, ""},
		{"v:=0;z:=fun(v<5).doWhile(v.print();v=v+1)", "5", ""},
	}

	logPrinter := NewLogPrinter()
	e := NewEvaluator(logPrinter.GetPrintFunction())
	for _, tt := range tests {
		result := e.Eval(tt.code).Str()
		if result != tt.mustBe {
			t.Errorf("[Code]%s [Result]%s [MustBe]%s", tt.code, result, tt.mustBe)
		}
		if tt.printMustBe != "" {
			lastLog := logPrinter.GetLastLog()
			if lastLog == nil || *lastLog != tt.printMustBe {
				actual := "<nil>"
				if lastLog != nil {
					actual = *lastLog
				}
				t.Errorf("[PrintLog]%s [MustBe]%s", actual, tt.printMustBe)
			}
		}
	}
}
