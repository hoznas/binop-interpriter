package main

import "testing"

func TestParser(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		{"123", "123"},
		{`"abc def"`, `"abc def"`},
		{"abc", "abc"},
		{"1+2", "1.+(2)"},
		{"1+2*3", "1.+(2.*(3))"},
		{"(1+2)*3", "1.+(2).*(3)"},
		{"1.print", "1.print"},
		{"1 op 2", "1.op(2)"},
		{"1.print;2.print();", "1.print.;(2.print())"},
		{"print;print()\nprint(1+2)", "print.;(print()).;(print(1.+(2)))"},
		{
			"i:=0;while(i<10,x:=i*2;x.println)",
			"i.:=(0).;(while(i.<(10), x.:=(i.*(2)).;(x.println)))",
		},
		{"print", "print"},
		{"print()", "print()"},
		{"print(1)", "print(1)"},
		{"print(1,2)", "print(1, 2)"},
		{"Object.clone().clone()", "Object.clone().clone()"},
		{"obj func arg", "obj.func(arg)"},
	}
	for _, tt := range tests {
		tokens := Tokenize(tt.code)
		exp := Parse(tokens)
		result := exp.Str()
		if result != tt.mustBe {
			t.Errorf("PARSE ERROR code=%s result=%s mustBe=%s", tt.code, result, tt.mustBe)
		}
	}
}
