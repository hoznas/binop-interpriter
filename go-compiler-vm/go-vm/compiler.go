// compiler.go — AST→IL命令列への変換（go-compilerから移植）。
// テスト時にBinOpソースコードから直接IL命令列を生成するために使用する。
package main

import "fmt"

// Compile はBinOpソースコードをIL命令列のテキストに変換する。
func Compile(code string) string {
	tokens := Tokenize(code)
	ast := Parse(tokens)
	state := NewCompilerState()
	compileNode(ast, state)
	return FormatProgram(state.GetInstructions())
}

// CompileToInstructions はBinOpソースコードをIL命令列に変換する。
func CompileToInstructions(code string) []Instruction {
	tokens := Tokenize(code)
	ast := Parse(tokens)
	state := NewCompilerState()
	compileNode(ast, state)
	return state.GetInstructions()
}

func compileNode(node BoObject, state *CompilerState) {
	switch n := node.(type) {
	case *Num:
		state.Emit(OP_PUSH_NUM, n.Str())
	case *Str:
		state.Emit(OP_PUSH_STR, fmt.Sprintf("%q", n.Value))
	case *Message:
		compileMessage(n, state)
	default:
		panic(fmt.Sprintf("ERROR compileNode: unknown node type %T", node))
	}
}

func compileMessage(mes *Message, state *CompilerState) {
	if mes.SlotName == "if" && mes.Receiver != nil && mes.HasArgs {
		compileIf(mes, state)
		return
	}

	if mes.Receiver != nil && mes.Args != nil && len(mes.Args) == 1 {
		switch mes.SlotName {
		case ";":
			compileNode(mes.Receiver, state)
			state.Emit(OP_POP)
			compileNode(mes.Args[0], state)
			return
		case "&&":
			label := state.NewLabel()
			compileNode(mes.Receiver, state)
			state.Emit(OP_JUMP_IF_NIL, label)
			state.Emit(OP_POP)
			compileNode(mes.Args[0], state)
			state.Emit(OP_LABEL, label)
			return
		case "||":
			label := state.NewLabel()
			compileNode(mes.Receiver, state)
			state.Emit(OP_JUMP_IF_NOT_NIL, label)
			state.Emit(OP_POP)
			compileNode(mes.Args[0], state)
			state.Emit(OP_LABEL, label)
			return
		case ":=":
			compileAssign("define", mes, state)
			return
		case "=":
			compileAssign("update", mes, state)
			return
		default:
			compileNode(mes.Receiver, state)
			compileNode(mes.Args[0], state)
			state.Emit(OP_SEND, mes.SlotName, "1")
			return
		}
	}

	if mes.SlotName == "fun" && mes.Receiver == nil && mes.HasArgs && len(mes.Args) >= 1 {
		compileFunOrMacro(OP_MAKE_FUN, OP_END_FUN, mes, state)
		return
	}

	if mes.SlotName == "macro" && mes.Receiver == nil && mes.HasArgs && len(mes.Args) >= 1 {
		compileFunOrMacro(OP_MAKE_MACRO, OP_END_MACRO, mes, state)
		return
	}

	if mes.Receiver != nil {
		compileNode(mes.Receiver, state)
		if mes.HasArgs {
			for _, arg := range mes.Args {
				compileNode(arg, state)
			}
			state.Emit(OP_SEND, mes.SlotName, fmt.Sprintf("%d", len(mes.Args)))
		} else {
			state.Emit(OP_GET_SLOT, mes.SlotName)
		}
		return
	}

	if mes.HasArgs {
		for _, arg := range mes.Args {
			compileNode(arg, state)
		}
		state.Emit(OP_CALL, mes.SlotName, fmt.Sprintf("%d", len(mes.Args)))
	} else {
		state.Emit(OP_LOAD, mes.SlotName)
	}
}

func compileAssign(flag string, mes *Message, state *CompilerState) {
	lhs, ok := mes.Receiver.(*Message)
	if !ok {
		panic(fmt.Sprintf("ERROR compileAssign: lhs is not Message: %T", mes.Receiver))
	}
	rhs := mes.Args[0]
	if lhs.Receiver != nil {
		compileNode(lhs.Receiver, state)
		compileNode(rhs, state)
		state.Emit(OP_ASSIGN_SLOT, lhs.SlotName)
	} else {
		compileNode(rhs, state)
		if flag == "define" {
			state.Emit(OP_DEFINE, lhs.SlotName)
		} else {
			state.Emit(OP_UPDATE, lhs.SlotName)
		}
	}
}

func compileIf(mes *Message, state *CompilerState) {
	labelElse := state.NewLabel()
	labelEnd := state.NewLabel()
	compileNode(mes.Receiver, state)
	state.Emit(OP_JUMP_IF_NIL, labelElse)
	state.Emit(OP_POP)
	compileNode(mes.Args[0], state)
	state.Emit(OP_JUMP, labelEnd)
	state.Emit(OP_LABEL, labelElse)
	state.Emit(OP_POP)
	if len(mes.Args) >= 2 {
		compileNode(mes.Args[1], state)
	} else {
		state.Emit(OP_PUSH_NIL)
	}
	state.Emit(OP_LABEL, labelEnd)
}

func compileFunOrMacro(startOp, endOp OpCode, mes *Message, state *CompilerState) {
	params, body := extractFunParams(mes.Args)
	operands := []string{fmt.Sprintf("%d", len(params))}
	operands = append(operands, params...)
	state.Emit(startOp, operands...)
	compileNode(body, state)
	state.Emit(endOp)
}

func extractFunParams(args []BoObject) ([]string, BoObject) {
	body := args[len(args)-1]
	params := make([]string, 0, len(args)-1)
	for _, arg := range args[:len(args)-1] {
		if m, ok := arg.(*Message); ok && m.Receiver == nil && !m.HasArgs {
			params = append(params, m.SlotName)
		} else {
			panic(fmt.Sprintf("ERROR extractFunParams: expected param name, got %s", arg.Str()))
		}
	}
	return params, body
}
