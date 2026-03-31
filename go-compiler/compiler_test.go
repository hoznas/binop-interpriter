package main

import (
	"strings"
	"testing"
)

// テストヘルパー: 命令列を改行区切りの文字列に変換する（インデントなし）。
// テストでは各命令を1行ずつ比較できるようにする。
func instrToLines(instructions []Instruction) string {
	lines := make([]string, len(instructions))
	for i, inst := range instructions {
		lines[i] = inst.String()
	}
	return strings.Join(lines, "\n")
}

func TestCompileLiterals(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// 数値リテラル
		{"123", "PUSH_NUM 123"},
		// 文字列リテラル
		{`"hello"`, `PUSH_STR "hello"`},
		// 変数参照
		{"abc", "LOAD abc"},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileArithmetic(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// 1+2
		{
			"1+2",
			"PUSH_NUM 1\nPUSH_NUM 2\nSEND + 1",
		},
		// 1+2*3 (2*3が先に結合)
		{
			"1+2*3",
			"PUSH_NUM 1\nPUSH_NUM 2\nPUSH_NUM 3\nSEND * 1\nSEND + 1",
		},
		// (1+2)*3
		{
			"(1+2)*3",
			"PUSH_NUM 1\nPUSH_NUM 2\nSEND + 1\nPUSH_NUM 3\nSEND * 1",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileAssign(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// 変数定義
		{
			"a := 5",
			"PUSH_NUM 5\nDEFINE a",
		},
		// 変数定義 + 使用
		{
			"a := 5; a * 4",
			"PUSH_NUM 5\nDEFINE a\nPOP\nLOAD a\nPUSH_NUM 4\nSEND * 1",
		},
		// 変数更新
		{
			"b = 10",
			"PUSH_NUM 10\nUPDATE b",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileSlotAssign(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// オブジェクトスロットへの代入
		{
			"o.x := 1",
			"LOAD o\nPUSH_NUM 1\nASSIGN_SLOT x",
		},
		{
			"o.x = 1",
			"LOAD o\nPUSH_NUM 1\nASSIGN_SLOT x",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileCompare(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		{
			"2 > 1",
			"PUSH_NUM 2\nPUSH_NUM 1\nSEND > 1",
		},
		{
			"1 + 1 == 3",
			"PUSH_NUM 1\nPUSH_NUM 1\nSEND + 1\nPUSH_NUM 3\nSEND == 1",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileLogical(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// && 短絡評価
		{
			"1 && nil",
			"PUSH_NUM 1\nJUMP_IF_NIL L0\nPOP\nLOAD nil\nLABEL L0",
		},
		// || 短絡評価
		{
			"nil || 1",
			"LOAD nil\nJUMP_IF_NOT_NIL L0\nPOP\nPUSH_NUM 1\nLABEL L0",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileIf(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// if with two branches
		{
			`(2>1).if("big","small")`,
			"PUSH_NUM 2\nPUSH_NUM 1\nSEND > 1\n" +
				"JUMP_IF_NIL L0\nPOP\nPUSH_STR \"big\"\nJUMP L1\n" +
				"LABEL L0\nPOP\nPUSH_STR \"small\"\nLABEL L1",
		},
		// if with one branch (no else → PUSH_NIL)
		{
			`1.if("yes")`,
			"PUSH_NUM 1\n" +
				"JUMP_IF_NIL L0\nPOP\nPUSH_STR \"yes\"\nJUMP L1\n" +
				"LABEL L0\nPOP\nPUSH_NIL\nLABEL L1",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileFun(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// fun with no params
		{
			"fun(1+2)",
			"MAKE_FUN 0\nPUSH_NUM 1\nPUSH_NUM 2\nSEND + 1\nEND_FUN",
		},
		// fun with params
		{
			"fun(a, b, a+b)",
			"MAKE_FUN 2 a b\nLOAD a\nLOAD b\nSEND + 1\nEND_FUN",
		},
		// 関数定義 + 呼出
		{
			"add := fun(a, b, a+b); add(1, 2)",
			"MAKE_FUN 2 a b\nLOAD a\nLOAD b\nSEND + 1\nEND_FUN\n" +
				"DEFINE add\nPOP\n" +
				"PUSH_NUM 1\nPUSH_NUM 2\nCALL add 2",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileMacro(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		{
			"macro(x, x)",
			"MAKE_MACRO 1 x\nLOAD x\nEND_MACRO",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileMethodCall(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// receiver.print()
		{
			"(1+2).print()",
			"PUSH_NUM 1\nPUSH_NUM 2\nSEND + 1\nSEND print 0",
		},
		// Object.clone()
		{
			"Object.clone()",
			"LOAD Object\nSEND clone 0",
		},
		// Object.clone().clone() (メソッドチェーン)
		{
			"Object.clone().clone()",
			"LOAD Object\nSEND clone 0\nSEND clone 0",
		},
		// recv.slot (引数なし = スロット参照)
		{
			"obj.x",
			"LOAD obj\nGET_SLOT x",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileFunctionCall(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// 引数なし関数呼出
		{
			"print()",
			"CALL print 0",
		},
		// 引数あり関数呼出
		{
			"print(1)",
			"PUSH_NUM 1\nCALL print 1",
		},
		// 複数引数
		{
			"add(1, 2)",
			"PUSH_NUM 1\nPUSH_NUM 2\nCALL add 2",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileUserBinOp(t *testing.T) {
	// ユーザ定義二項演算子は SEND として出力
	tests := []struct {
		code   string
		mustBe string
	}{
		{
			"obj func arg",
			"LOAD obj\nLOAD arg\nSEND func 1",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestCompileComplex(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		// 再帰関数定義 + 呼出
		{
			"pow := fun(n, (n<=1).if(1, n*pow(n-1))); pow(3)",
			// fun定義
			"MAKE_FUN 1 n\n" +
				// (n<=1)
				"LOAD n\nPUSH_NUM 1\nSEND <= 1\n" +
				// .if(1, n*pow(n-1))
				"JUMP_IF_NIL L0\nPOP\n" +
				"PUSH_NUM 1\n" +
				"JUMP L1\n" +
				"LABEL L0\nPOP\n" +
				// n*pow(n-1)
				"LOAD n\nLOAD n\nPUSH_NUM 1\nSEND - 1\nCALL pow 1\nSEND * 1\n" +
				"LABEL L1\n" +
				"END_FUN\n" +
				// pow := ... ; pow(3)
				"DEFINE pow\nPOP\n" +
				"PUSH_NUM 3\nCALL pow 1",
		},
	}
	for _, tt := range tests {
		result := instrToLines(CompileToInstructions(tt.code))
		if result != tt.mustBe {
			t.Errorf("[Code] %s\n[Result]\n%s\n[MustBe]\n%s", tt.code, result, tt.mustBe)
		}
	}
}

func TestFormatProgram(t *testing.T) {
	// FormatProgram がインデントを正しく付けるか確認
	instructions := []Instruction{
		{OP_MAKE_FUN, []string{"2", "a", "b"}},
		{OP_LOAD, []string{"a"}},
		{OP_LOAD, []string{"b"}},
		{OP_SEND, []string{"+", "1"}},
		{OP_END_FUN, nil},
		{OP_DEFINE, []string{"add"}},
	}
	result := FormatProgram(instructions)
	expected := "MAKE_FUN 2 a b\n  LOAD a\n  LOAD b\n  SEND + 1\nEND_FUN\nDEFINE add"
	if result != expected {
		t.Errorf("[FormatProgram]\n[Result]\n%s\n[MustBe]\n%s", result, expected)
	}
}
