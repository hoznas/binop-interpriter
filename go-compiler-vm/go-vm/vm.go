// vm.go — スタックベースのVM実行エンジン。
// go-compilerが生成するIL命令列を実行する。
package main

import (
	"fmt"
	"math"
	"strconv"
)

// PrintFunc はprint関数の型。
type PrintFunc func(string)

// VM はBinOp IL命令列を実行するスタックマシン。
type VM struct {
	RootEnv    *Memory
	RootObjEnv *Memory
	PrintFn    PrintFunc
}

// NewVM は新しいVMを生成する。
func NewVM(printFn PrintFunc) *VM {
	if printFn == nil {
		printFn = func(msg string) { fmt.Println(msg) }
	}
	rootEnv := NewMemory(nil)
	rootObjEnv := NewMemory(nil)

	vm := &VM{
		RootEnv:    rootEnv,
		RootObjEnv: rootObjEnv,
		PrintFn:    printFn,
	}

	rootEnv.Define("Object", NewUserObject(rootObjEnv, nil))
	rootEnv.Define("nil", NIL)

	return vm
}

// Execute はIL命令列を実行して結果を返す。
func (vm *VM) Execute(instructions []Instruction) BoObject {
	return vm.executeFrame(instructions, vm.RootEnv)
}

// executeFrame は指定した環境で命令列を実行する。
// 関数呼び出し時に再帰的に呼ばれる。
func (vm *VM) executeFrame(instructions []Instruction, env *Memory) BoObject {
	stack := []BoObject{}
	labelMap := buildLabelMap(instructions)
	pc := 0

	push := func(obj BoObject) {
		stack = append(stack, obj)
	}
	pop := func() BoObject {
		if len(stack) == 0 {
			panic("ERROR VM: stack underflow")
		}
		v := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		return v
	}
	peek := func() BoObject {
		if len(stack) == 0 {
			panic("ERROR VM: stack underflow (peek)")
		}
		return stack[len(stack)-1]
	}

	for pc < len(instructions) {
		inst := instructions[pc]

		switch inst.Op {
		case OP_PUSH_NUM:
			v, err := strconv.ParseFloat(inst.Operands[0], 64)
			if err != nil {
				panic(fmt.Sprintf("ERROR VM PUSH_NUM: %v", err))
			}
			push(NewNum(v))

		case OP_PUSH_STR:
			s := parseStrOperand(inst.Operands[0])
			push(NewStr(s))

		case OP_PUSH_NIL:
			push(NIL)

		case OP_POP:
			pop()

		case OP_LOAD:
			name := inst.Operands[0]
			val := env.Get(name)
			if val == nil {
				panic(fmt.Sprintf("ERROR VM LOAD: %s is not defined", name))
			}
			push(val)

		case OP_DEFINE:
			name := inst.Operands[0]
			val := peek()
			env.DefineForce(name, val)

		case OP_UPDATE:
			name := inst.Operands[0]
			val := peek()
			result := env.Update(name, val)
			if result == nil {
				panic(fmt.Sprintf("ERROR VM UPDATE: %s is not defined", name))
			}

		case OP_GET_SLOT:
			name := inst.Operands[0]
			recv := pop()
			if uo, ok := recv.(*UserObject); ok {
				val := uo.Get(name)
				if val == nil {
					push(NIL)
				} else {
					push(val)
				}
			} else {
				panic(fmt.Sprintf("ERROR VM GET_SLOT: receiver is not UserObject: %s", recv.Str()))
			}

		case OP_ASSIGN_SLOT:
			name := inst.Operands[0]
			val := pop()
			recv := pop()
			if uo, ok := recv.(*UserObject); ok {
				uo.AssignToObject(name, val)
				push(val)
			} else {
				panic(fmt.Sprintf("ERROR VM ASSIGN_SLOT: receiver is not UserObject: %s", recv.Str()))
			}

		case OP_SEND:
			method := inst.Operands[0]
			n, _ := strconv.Atoi(inst.Operands[1])
			args := make([]BoObject, n)
			for i := n - 1; i >= 0; i-- {
				args[i] = pop()
			}
			recv := pop()
			result := vm.handleSend(recv, method, args, env)
			push(result)

		case OP_CALL:
			name := inst.Operands[0]
			n, _ := strconv.Atoi(inst.Operands[1])
			args := make([]BoObject, n)
			for i := n - 1; i >= 0; i-- {
				args[i] = pop()
			}
			result := vm.handleCall(name, args, env)
			push(result)

		case OP_JUMP:
			label := inst.Operands[0]
			target, ok := labelMap[label]
			if !ok {
				panic(fmt.Sprintf("ERROR VM JUMP: unknown label %s", label))
			}
			pc = target
			continue

		case OP_JUMP_IF_NIL:
			label := inst.Operands[0]
			val := peek()
			if _, isNil := val.(*NilObj); isNil {
				target, ok := labelMap[label]
				if !ok {
					panic(fmt.Sprintf("ERROR VM JUMP_IF_NIL: unknown label %s", label))
				}
				pc = target
				continue
			}

		case OP_JUMP_IF_NOT_NIL:
			label := inst.Operands[0]
			val := peek()
			if _, isNil := val.(*NilObj); !isNil {
				target, ok := labelMap[label]
				if !ok {
					panic(fmt.Sprintf("ERROR VM JUMP_IF_NOT_NIL: unknown label %s", label))
				}
				pc = target
				continue
			}

		case OP_LABEL:
			// ラベルは実行時には何もしない（ジャンプ先のマーカー）

		case OP_MAKE_FUN:
			nParams, _ := strconv.Atoi(inst.Operands[0])
			params := inst.Operands[1 : 1+nParams]
			body, endPC := extractBody(instructions, pc, OP_MAKE_FUN, OP_END_FUN)
			push(&Fun{
				Params:     params,
				Body:       body,
				CreatedEnv: env,
			})
			pc = endPC + 1
			continue

		case OP_MAKE_MACRO:
			panic("ERROR VM: macro is not supported in go-compiler-vm. Use ts-interpreter or go-interpreter instead.")

		case OP_END_FUN, OP_END_MACRO:
			// extractBody でスキップされるので通常ここには来ない

		default:
			panic(fmt.Sprintf("ERROR VM: unknown opcode %s", inst.Op))
		}

		pc++
	}

	if len(stack) > 0 {
		return stack[len(stack)-1]
	}
	return NIL
}

// buildLabelMap は命令列からラベル名→命令インデックスのマップを作る。
func buildLabelMap(instructions []Instruction) map[string]int {
	m := make(map[string]int)
	for i, inst := range instructions {
		if inst.Op == OP_LABEL {
			m[inst.Operands[0]] = i
		}
	}
	return m
}

// extractBody は MAKE_FUN/MAKE_MACRO 〜 END_FUN/END_MACRO の間の命令列を返す。
// ネストに対応。endPC は END_FUN/END_MACRO の位置を返す。
func extractBody(instructions []Instruction, startPC int, startOp, endOp OpCode) ([]Instruction, int) {
	depth := 1
	pc := startPC + 1
	for pc < len(instructions) {
		if instructions[pc].Op == startOp {
			depth++
		} else if instructions[pc].Op == endOp {
			depth--
			if depth == 0 {
				return instructions[startPC+1 : pc], pc
			}
		}
		pc++
	}
	panic(fmt.Sprintf("ERROR VM extractBody: unmatched %s", startOp))
}

// handleSend は SEND 命令を処理する。
func (vm *VM) handleSend(recv BoObject, method string, args []BoObject, callerEnv *Memory) BoObject {
	// 算術演算
	if len(args) == 1 {
		switch method {
		case "+", "-", "*", "/", "%":
			return vm.evalArithmetic(recv, method, args[0])
		case "==", "!=", "<", "<=", ">", ">=":
			return vm.evalCompare(recv, method, args[0])
		}
	}

	// 組み込みメソッド
	switch method {
	case "print":
		vm.PrintFn(recv.Str())
		return recv
	case "clone":
		return recv.Clone()
	case "if":
		return vm.evalSendIf(recv, args, callerEnv)
	case "doWhile":
		return vm.evalDoWhile(recv, args, callerEnv)
	}

	// UserObject上のメソッド呼び出し
	if uo, ok := recv.(*UserObject); ok {
		f := uo.Get(method)
		if f != nil {
			return vm.callFunction(uo, f, args)
		}
	}

	// 環境からメソッドを探す
	f := callerEnv.Get(method)
	if f != nil {
		return vm.callFunction(nil, f, args)
	}

	panic(fmt.Sprintf("ERROR VM SEND: unknown method %s on %s", method, recv.Str()))
}

// handleCall は CALL 命令を処理する。
func (vm *VM) handleCall(name string, args []BoObject, env *Memory) BoObject {
	f := env.Get(name)
	if f == nil {
		panic(fmt.Sprintf("ERROR VM CALL: %s is not defined", name))
	}
	return vm.callFunction(nil, f, args)
}

// callFunction は関数/マクロ/ビルトイン関数を呼び出す。
func (vm *VM) callFunction(this *UserObject, f BoObject, args []BoObject) BoObject {
	switch fn := f.(type) {
	case *Fun:
		return vm.callFun(this, fn, args)
	case *Macro:
		panic("ERROR VM: macro is not supported in go-compiler-vm. Use ts-interpreter or go-interpreter instead.")
	case *BuiltinFunction:
		var recv BoObject
		if this != nil {
			recv = this
		}
		return fn.Fn(vm, recv, args)
	default:
		panic(fmt.Sprintf("ERROR VM callFunction: %s is not callable", f.Str()))
	}
}

// callFun は関数を呼び出す。
func (vm *VM) callFun(this *UserObject, fn *Fun, args []BoObject) BoObject {
	if len(fn.Params) != len(args) {
		panic(fmt.Sprintf("ERROR VM callFun: expected %d args, got %d", len(fn.Params), len(args)))
	}
	closure := fn.CreatedEnv.SubMemory()
	for i, param := range fn.Params {
		closure.DefineForce(param, args[i])
	}
	if this != nil {
		closure.DefineForce("this", this)
	}
	return vm.executeFrame(fn.Body, closure)
}

// evalArithmetic は二項算術演算を評価する。
func (vm *VM) evalArithmetic(lhs BoObject, op string, rhs BoObject) BoObject {
	if lNum, ok := lhs.(*Num); ok {
		var n float64
		switch r := rhs.(type) {
		case *Num:
			n = r.Value
		case *Str:
			parsed, err := strconv.ParseFloat(r.Value, 64)
			if err != nil {
				panic("ERROR VM evalArithmetic: cannot parse string as number")
			}
			n = parsed
		default:
			panic(fmt.Sprintf("ERROR VM evalArithmetic: invalid rhs type %T", rhs))
		}
		switch op {
		case "+":
			return NewNum(lNum.Value + n)
		case "-":
			return NewNum(lNum.Value - n)
		case "*":
			return NewNum(lNum.Value * n)
		case "/":
			return NewNum(lNum.Value / n)
		case "%":
			return NewNum(math.Mod(lNum.Value, n))
		}
	} else if lStr, ok := lhs.(*Str); ok {
		if op == "+" {
			switch r := rhs.(type) {
			case *Str:
				return NewStr(lStr.Value + r.Value)
			case *Num:
				return NewStr(lStr.Value + r.Str())
			}
		} else if rNum, ok := rhs.(*Num); ok {
			idx := int(rNum.Value)
			if op == "/" {
				return NewStr(lStr.Value[:idx])
			}
			if op == "%" {
				return NewStr(lStr.Value[idx:])
			}
		}
	}
	panic(fmt.Sprintf("ERROR VM evalArithmetic: %s %s %s", lhs.Str(), op, rhs.Str()))
}

// evalCompare は二項比較演算を評価する。
func (vm *VM) evalCompare(lhs BoObject, op string, rhs BoObject) BoObject {
	cmp := lhs.Compare(rhs)
	t := NewNum(1)
	switch op {
	case "==":
		if cmp == 0 {
			return t
		}
		return NIL
	case "!=":
		if cmp != 0 {
			return t
		}
		return NIL
	case "<":
		if cmp < 0 {
			return t
		}
		return NIL
	case "<=":
		if cmp <= 0 {
			return t
		}
		return NIL
	case ">":
		if cmp > 0 {
			return t
		}
		return NIL
	default: // >=
		if cmp >= 0 {
			return t
		}
		return NIL
	}
}

// evalSendIf は receiver.if(args) を処理する。
// コンパイラは通常 if を特殊処理するが、動的な場合のフォールバック。
func (vm *VM) evalSendIf(cond BoObject, args []BoObject, env *Memory) BoObject {
	if _, isNil := cond.(*NilObj); !isNil {
		if len(args) >= 1 {
			return args[0]
		}
		return cond
	}
	if len(args) >= 2 {
		return args[1]
	}
	return NIL
}

// evalDoWhile は fun().doWhile(body) を処理する。
func (vm *VM) evalDoWhile(recv BoObject, args []BoObject, env *Memory) BoObject {
	condFn, ok := recv.(*Fun)
	if !ok {
		panic("ERROR VM doWhile: receiver is not a function")
	}
	if len(args) != 1 {
		panic("ERROR VM doWhile: expected 1 argument")
	}
	bodyFn, ok := args[0].(*Fun)
	if !ok {
		// doWhile の引数が関数でない場合、値を返す
		var result BoObject = NIL
		for {
			condResult := vm.callFun(nil, condFn, []BoObject{})
			if _, isNil := condResult.(*NilObj); isNil {
				break
			}
			result = args[0]
		}
		return result
	}
	// 引数が関数の場合、毎回呼び出す
	var result BoObject = NIL
	for {
		condResult := vm.callFun(nil, condFn, []BoObject{})
		if _, isNil := condResult.(*NilObj); isNil {
			break
		}
		result = vm.callFun(nil, bodyFn, []BoObject{})
	}
	return result
}

// Run はBinOpソースコードをコンパイル+実行する便利メソッド。
func (vm *VM) Run(code string) BoObject {
	instructions := CompileToInstructions(code)
	return vm.Execute(instructions)
}

// RunIL はILテキストをパースして実行する。
func (vm *VM) RunIL(ilText string) BoObject {
	instructions := ParseIL(ilText)
	return vm.Execute(instructions)
}
