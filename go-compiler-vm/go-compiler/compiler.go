// compiler.go — AST(パーサの出力)をIL命令列に変換するコードジェネレータ。
//
// コンパイル規則:
//   リテラル         → PUSH_NUM / PUSH_STR / PUSH_NIL
//   変数参照         → LOAD
//   算術・比較(二項) → compile(lhs) + compile(rhs) + SEND op 1
//   ;               → compile(lhs) + POP + compile(rhs)
//   &&              → compile(lhs) + JUMP_IF_NIL + POP + compile(rhs) + LABEL
//   ||              → compile(lhs) + JUMP_IF_NOT_NIL + POP + compile(rhs) + LABEL
//   :=              → compile(rhs) + DEFINE name   (ローカル)
//                     compile(recv) + compile(rhs) + ASSIGN_SLOT name (スロット)
//   =               → compile(rhs) + UPDATE name   (ローカル)
//                     compile(recv) + compile(rhs) + ASSIGN_SLOT name (スロット)
//   if              → compile(cond) + JUMP_IF_NIL + POP + compile(t) + JUMP + LABEL + POP + compile(f) + LABEL
//   fun(args,body)  → MAKE_FUN + compile(body) + END_FUN
//   macro(args,body)→ MAKE_MACRO + compile(body) + END_MACRO
//   recv.slot       → compile(recv) + GET_SLOT slot
//   recv.method(a)  → compile(recv) + compile(args...) + SEND method N
//   func(args)      → compile(args...) + CALL func N
package main

import "fmt"

// Compile はBinOpソースコードをIL命令列のテキストに変換する。
// エントリポイント関数。
func Compile(code string) string {
	tokens := Tokenize(code)
	ast := Parse(tokens)
	state := NewCompilerState()
	compileNode(ast, state)
	return FormatProgram(state.GetInstructions())
}

// CompileToInstructions はBinOpソースコードをIL命令列に変換する。
// テスト用にInstruction配列を直接返す。
func CompileToInstructions(code string) []Instruction {
	tokens := Tokenize(code)
	ast := Parse(tokens)
	state := NewCompilerState()
	compileNode(ast, state)
	return state.GetInstructions()
}

// compileNode はASTノードを再帰的にwalkして命令を生成する。
// BinOp言語のASTは3種類のノード（Num, Str, Message）で構成される。
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

// compileMessage はMessageノードをコンパイルする。
// Messageは二項演算子、関数呼出、スロットアクセスなど多くの構文を表現する。
func compileMessage(mes *Message, state *CompilerState) {
	// --- 特殊形式: if (receiver.if(trueCase) or receiver.if(trueCase, falseCase)) ---
	// if は遅延評価が必須なため、二項演算子より先にチェックする。
	if mes.SlotName == "if" && mes.Receiver != nil && mes.HasArgs {
		compileIf(mes, state)
		return
	}

	// --- 二項演算子（receiver + args==1 の形） ---
	if mes.Receiver != nil && mes.Args != nil && len(mes.Args) == 1 {
		switch mes.SlotName {
		case ";":
			compileSemicolon(mes, state)
			return
		case "&&":
			compileAnd(mes, state)
			return
		case "||":
			compileOr(mes, state)
			return
		case ":=":
			compileAssign("define", mes, state)
			return
		case "=":
			compileAssign("update", mes, state)
			return
		default:
			// 算術(+,-,*,/,%)、比較(==,!=,<,<=,>,>=)など
			// 全て SEND に統一する
			compileBinOpAsSend(mes, state)
			return
		}
	}

	// --- 特殊形式: fun(args..., body) ---
	if mes.SlotName == "fun" && mes.Receiver == nil && mes.HasArgs && len(mes.Args) >= 1 {
		compileFun(mes, state)
		return
	}

	// --- 特殊形式: macro(args..., body) ---
	if mes.SlotName == "macro" && mes.Receiver == nil && mes.HasArgs && len(mes.Args) >= 1 {
		compileMacro(mes, state)
		return
	}

	// --- receiverありのメッセージ ---
	if mes.Receiver != nil {
		compileNode(mes.Receiver, state)
		if mes.HasArgs {
			// recv.method(arg1, arg2, ...) → compile(recv) + compile(args) + SEND method N
			for _, arg := range mes.Args {
				compileNode(arg, state)
			}
			state.Emit(OP_SEND, mes.SlotName, fmt.Sprintf("%d", len(mes.Args)))
		} else {
			// recv.slot → compile(recv) + GET_SLOT slot
			state.Emit(OP_GET_SLOT, mes.SlotName)
		}
		return
	}

	// --- receiverなしのメッセージ ---
	if mes.HasArgs {
		// func(arg1, arg2, ...) → compile(args) + CALL func N
		for _, arg := range mes.Args {
			compileNode(arg, state)
		}
		state.Emit(OP_CALL, mes.SlotName, fmt.Sprintf("%d", len(mes.Args)))
	} else {
		// 変数参照: name → LOAD name
		state.Emit(OP_LOAD, mes.SlotName)
	}
}

// compileSemicolon は ; 演算子をコンパイルする。
// a ; b → compile(a) + POP + compile(b)
// 左辺の結果を捨て、右辺の結果をスタックに残す。
func compileSemicolon(mes *Message, state *CompilerState) {
	compileNode(mes.Receiver, state)
	state.Emit(OP_POP)
	compileNode(mes.Args[0], state)
}

// compileAnd は && 演算子をコンパイルする（短絡評価）。
// a && b → compile(a) + JUMP_IF_NIL L + POP + compile(b) + LABEL L
// 左辺がnilならnilのまま（右辺を評価しない）。
func compileAnd(mes *Message, state *CompilerState) {
	label := state.NewLabel()
	compileNode(mes.Receiver, state)          // compile(a) → スタックに a の結果
	state.Emit(OP_JUMP_IF_NIL, label)         // nilならジャンプ（nilがスタックに残る）
	state.Emit(OP_POP)                        // nilでないなら a の結果を捨てる
	compileNode(mes.Args[0], state)           // compile(b) → スタックに b の結果
	state.Emit(OP_LABEL, label)               // ジャンプ先
}

// compileOr は || 演算子をコンパイルする（短絡評価）。
// a || b → compile(a) + JUMP_IF_NOT_NIL L + POP + compile(b) + LABEL L
// 左辺がnil以外ならその値を返す（右辺を評価しない）。
func compileOr(mes *Message, state *CompilerState) {
	label := state.NewLabel()
	compileNode(mes.Receiver, state)          // compile(a)
	state.Emit(OP_JUMP_IF_NOT_NIL, label)     // nil以外ならジャンプ（値がスタックに残る）
	state.Emit(OP_POP)                        // nilなら捨てる
	compileNode(mes.Args[0], state)           // compile(b)
	state.Emit(OP_LABEL, label)
}

// compileAssign は := (define) と = (update) をコンパイルする。
// ローカル変数:     name := rhs → compile(rhs) + DEFINE name
// スロット代入: recv.slot := rhs → compile(recv) + compile(rhs) + ASSIGN_SLOT slot
func compileAssign(flag string, mes *Message, state *CompilerState) {
	lhs, ok := mes.Receiver.(*Message)
	if !ok {
		panic(fmt.Sprintf("ERROR compileAssign: lhs is not Message: %T", mes.Receiver))
	}

	rhs := mes.Args[0]

	if lhs.Receiver != nil {
		// スロット代入: recv.slot := rhs
		compileNode(lhs.Receiver, state)
		compileNode(rhs, state)
		state.Emit(OP_ASSIGN_SLOT, lhs.SlotName)
	} else {
		// ローカル変数: name := rhs
		compileNode(rhs, state)
		if flag == "define" {
			state.Emit(OP_DEFINE, lhs.SlotName)
		} else {
			state.Emit(OP_UPDATE, lhs.SlotName)
		}
	}
}

// compileIf は receiver.if(trueCase, falseCase) をコンパイルする。
//
//   compile(cond)
//   JUMP_IF_NIL L_else
//   POP
//   compile(trueCase)
//   JUMP L_end
//   LABEL L_else
//   POP
//   compile(falseCase)   ← falseCase がなければ PUSH_NIL
//   LABEL L_end
func compileIf(mes *Message, state *CompilerState) {
	labelElse := state.NewLabel()
	labelEnd := state.NewLabel()

	compileNode(mes.Receiver, state)          // compile(cond)
	state.Emit(OP_JUMP_IF_NIL, labelElse)     // nilなら else へ
	state.Emit(OP_POP)                        // cond の結果を捨てる
	compileNode(mes.Args[0], state)           // compile(trueCase)
	state.Emit(OP_JUMP, labelEnd)             // end へ
	state.Emit(OP_LABEL, labelElse)           // else:
	state.Emit(OP_POP)                        // cond の結果(nil)を捨てる
	if len(mes.Args) >= 2 {
		compileNode(mes.Args[1], state)       // compile(falseCase)
	} else {
		state.Emit(OP_PUSH_NIL)               // falseCase がなければ nil
	}
	state.Emit(OP_LABEL, labelEnd)            // end:
}

// compileFun は fun(param1, param2, ..., body) をコンパイルする。
// パラメータ名をMessageのSlotNameから取り出す。
//
//   MAKE_FUN <n> <param1> <param2> ...
//     compile(body)
//   END_FUN
func compileFun(mes *Message, state *CompilerState) {
	params, body := extractFunParams(mes.Args)
	operands := []string{fmt.Sprintf("%d", len(params))}
	operands = append(operands, params...)
	state.Emit(OP_MAKE_FUN, operands...)
	compileNode(body, state)
	state.Emit(OP_END_FUN)
}

// compileMacro は macro(param1, param2, ..., body) をコンパイルする。
//
//   MAKE_MACRO <n> <param1> <param2> ...
//     compile(body)
//   END_MACRO
func compileMacro(mes *Message, state *CompilerState) {
	params, body := extractFunParams(mes.Args)
	operands := []string{fmt.Sprintf("%d", len(params))}
	operands = append(operands, params...)
	state.Emit(OP_MAKE_MACRO, operands...)
	compileNode(body, state)
	state.Emit(OP_END_MACRO)
}

// extractFunParams は fun/macro の引数リストからパラメータ名と関数本体を分離する。
// 最後の引数が本体(body)、それ以前が仮引数名。
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

// compileBinOpAsSend は二項演算子を SEND 命令としてコンパイルする。
// 算術(+,-,*,/,%)、比較(==,!=,<,<=,>,>=)、ユーザ定義二項演算子すべてがこの形になる。
//
// a + b → compile(a) + compile(b) + SEND + 1
func compileBinOpAsSend(mes *Message, state *CompilerState) {
	compileNode(mes.Receiver, state)
	compileNode(mes.Args[0], state)
	state.Emit(OP_SEND, mes.SlotName, "1")
}
