// instruction.go — IL命令の定義とILテキストのパーサ。
package main

import (
	"strconv"
	"strings"
)

// OpCode は命令の種類を表す文字列型。
type OpCode string

const (
	OP_PUSH_NUM OpCode = "PUSH_NUM"
	OP_PUSH_STR OpCode = "PUSH_STR"
	OP_PUSH_NIL OpCode = "PUSH_NIL"

	OP_LOAD   OpCode = "LOAD"
	OP_DEFINE OpCode = "DEFINE"
	OP_UPDATE OpCode = "UPDATE"

	OP_GET_SLOT    OpCode = "GET_SLOT"
	OP_ASSIGN_SLOT OpCode = "ASSIGN_SLOT"

	OP_SEND OpCode = "SEND"
	OP_CALL OpCode = "CALL"

	OP_POP OpCode = "POP"

	OP_JUMP            OpCode = "JUMP"
	OP_JUMP_IF_NIL     OpCode = "JUMP_IF_NIL"
	OP_JUMP_IF_NOT_NIL OpCode = "JUMP_IF_NOT_NIL"
	OP_LABEL           OpCode = "LABEL"

	OP_MAKE_FUN   OpCode = "MAKE_FUN"
	OP_END_FUN    OpCode = "END_FUN"
	OP_MAKE_MACRO OpCode = "MAKE_MACRO"
	OP_END_MACRO  OpCode = "END_MACRO"
)

// Instruction は1つのIL命令を表す。
type Instruction struct {
	Op       OpCode
	Operands []string
}

// String は命令を1行のテキスト表現にする。
func (inst Instruction) String() string {
	if len(inst.Operands) == 0 {
		return string(inst.Op)
	}
	return string(inst.Op) + " " + strings.Join(inst.Operands, " ")
}

// FormatProgram は命令列をテキスト形式で出力する。
func FormatProgram(instructions []Instruction) string {
	var lines []string
	depth := 0
	for _, inst := range instructions {
		if inst.Op == OP_END_FUN || inst.Op == OP_END_MACRO {
			depth--
		}
		line := strings.Repeat("  ", depth) + inst.String()
		lines = append(lines, line)
		if inst.Op == OP_MAKE_FUN || inst.Op == OP_MAKE_MACRO {
			depth++
		}
	}
	return strings.Join(lines, "\n")
}

// ParseIL はILテキストをInstruction配列にパースする。
func ParseIL(text string) []Instruction {
	lines := strings.Split(text, "\n")
	var instructions []Instruction
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		inst := parseLine(trimmed)
		instructions = append(instructions, inst)
	}
	return instructions
}

// parseLine は1行のILテキストをInstructionにパースする。
func parseLine(line string) Instruction {
	// PUSH_STR はクォート文字列を含むので特別扱い
	if strings.HasPrefix(line, "PUSH_STR ") {
		operand := line[len("PUSH_STR "):]
		return Instruction{Op: OP_PUSH_STR, Operands: []string{operand}}
	}

	parts := strings.Fields(line)
	op := OpCode(parts[0])
	var operands []string
	if len(parts) > 1 {
		operands = parts[1:]
	}
	return Instruction{Op: op, Operands: operands}
}

// parseStrOperand はPUSH_STRのオペランドからGoの文字列値を取り出す。
// "%q"形式（例: "hello"）をアンクォートする。
func parseStrOperand(operand string) string {
	s, err := strconv.Unquote(operand)
	if err != nil {
		// アンクォート失敗時はそのまま返す（前後のダブルクォートを除去）
		if len(operand) >= 2 && operand[0] == '"' && operand[len(operand)-1] == '"' {
			return operand[1 : len(operand)-1]
		}
		return operand
	}
	return s
}
