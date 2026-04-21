// instruction.go — 中間言語(IL)の命令を定義する。
// 各命令は OpCode（命令の種類）と Operands（引数リスト）で構成される。
// テキスト形式では1行1命令で出力する。
package main

import "strings"

// OpCode は命令の種類を表す文字列型。
type OpCode string

const (
	// リテラルのプッシュ
	OP_PUSH_NUM OpCode = "PUSH_NUM" // PUSH_NUM <value>  : 数値をスタックに積む
	OP_PUSH_STR OpCode = "PUSH_STR" // PUSH_STR <value>  : 文字列をスタックに積む
	OP_PUSH_NIL OpCode = "PUSH_NIL" // PUSH_NIL          : nilをスタックに積む

	// 変数操作
	OP_LOAD   OpCode = "LOAD"   // LOAD <name>   : 変数の値をスタックに積む
	OP_DEFINE OpCode = "DEFINE" // DEFINE <name> : スタック先頭の値で変数を定義（値はスタックに残る）
	OP_UPDATE OpCode = "UPDATE" // UPDATE <name> : スタック先頭の値で変数を更新（値はスタックに残る）

	// オブジェクトスロット操作
	OP_GET_SLOT    OpCode = "GET_SLOT"    // GET_SLOT <name>    : pop recv → push recv.name
	OP_ASSIGN_SLOT OpCode = "ASSIGN_SLOT" // ASSIGN_SLOT <name> : pop val, pop recv → recv.name=val, push val

	// メッセージ送信と関数呼出
	OP_SEND OpCode = "SEND" // SEND <name> <n> : pop recv + n個のarg → push recv.name(args)
	OP_CALL OpCode = "CALL" // CALL <name> <n> : pop n個のarg → push name(args)

	// スタック操作
	OP_POP OpCode = "POP" // POP : スタック先頭を捨てる

	// 制御フロー
	OP_JUMP             OpCode = "JUMP"             // JUMP <label>             : 無条件ジャンプ
	OP_JUMP_IF_NIL      OpCode = "JUMP_IF_NIL"      // JUMP_IF_NIL <label>      : nilならジャンプ（popする）
	OP_JUMP_IF_NOT_NIL  OpCode = "JUMP_IF_NOT_NIL"  // JUMP_IF_NOT_NIL <label>  : nil以外ならジャンプ（popする）
	OP_LABEL            OpCode = "LABEL"             // LABEL <label>            : ジャンプ先ラベルの定義

	// 関数・マクロ定義
	OP_MAKE_FUN   OpCode = "MAKE_FUN"   // MAKE_FUN <n> <param1> <param2> ... : 関数本体の開始
	OP_END_FUN    OpCode = "END_FUN"    // END_FUN    : 関数本体の終了、Funオブジェクトをpush
	OP_MAKE_MACRO OpCode = "MAKE_MACRO" // MAKE_MACRO <n> <param1> <param2> ... : マクロ本体の開始
	OP_END_MACRO  OpCode = "END_MACRO"  // END_MACRO  : マクロ本体の終了、Macroオブジェクトをpush
)

// Instruction は1つのIL命令を表す。
type Instruction struct {
	Op       OpCode   // 命令の種類
	Operands []string // 命令の引数（数値、名前、ラベル等）
}

// String は命令を1行のテキスト表現にする。
// 例: "PUSH_NUM 42", "SEND + 1", "LABEL L0"
func (inst Instruction) String() string {
	if len(inst.Operands) == 0 {
		return string(inst.Op)
	}
	return string(inst.Op) + " " + strings.Join(inst.Operands, " ")
}

// FormatProgram は命令列をテキスト形式で出力する。
// MAKE_FUN〜END_FUN、MAKE_MACRO〜END_MACRO の間はインデントする。
func FormatProgram(instructions []Instruction) string {
	var lines []string
	depth := 0
	for _, inst := range instructions {
		// END_FUN/END_MACRO はインデントを戻してから出力
		if inst.Op == OP_END_FUN || inst.Op == OP_END_MACRO {
			depth--
		}
		line := strings.Repeat("  ", depth) + inst.String()
		lines = append(lines, line)
		// MAKE_FUN/MAKE_MACRO の後はインデントを深くする
		if inst.Op == OP_MAKE_FUN || inst.Op == OP_MAKE_MACRO {
			depth++
		}
	}
	return strings.Join(lines, "\n")
}
