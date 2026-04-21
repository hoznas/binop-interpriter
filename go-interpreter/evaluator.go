package main

import (
	"fmt"
	"math"
	"strconv"
)

// PrintFunc is the type for the global print function.
type PrintFunc func(string)

// GlobalPrint is the package-level print function (replaces TS static Evaluator.print).
var GlobalPrint PrintFunc = func(msg string) {
	fmt.Println(msg)
}

// Evaluator holds the root environment and evaluates BinOp code.
type Evaluator struct {
	RootEnv    *Memory
	RootObjEnv *Memory
}

func NewEvaluator(print PrintFunc) *Evaluator {
	if print != nil {
		GlobalPrint = print
	}
	rootEnv := NewMemory(nil)
	rootObjEnv := NewMemory(nil)

	// variables
	rootEnv.Define("Object", NewUserObject(rootObjEnv, nil))
	rootEnv.Define("nil", NIL)

	// functions (will be set after builtin_functions.go is compiled)
	rootEnv.Define("fun", FUN)
	rootEnv.Define("macro", MACRO)
	rootEnv.Define("evalNode", EVAL_NODE)
	rootEnv.Define("evalStr", EVAL_STR)
	rootEnv.Define("message", MESSAGE)

	return &Evaluator{RootEnv: rootEnv, RootObjEnv: rootObjEnv}
}

func (e *Evaluator) Eval(code string) BoObject {
	return EvalStr(code, e.RootEnv)
}

func EvalStr(code string, env *Memory) BoObject {
	tokens := Tokenize(code)
	node := Parse(tokens)
	return EvalNode(node, env)
}

func EvalNode(node BoObject, env *Memory) BoObject {
	mes, ok := node.(*Message)
	if !ok {
		// Num, Str, Nil, UserObject, Fun, Macro
		return node
	}

	if mes.Receiver != nil && mes.Args != nil && len(mes.Args) == 1 {
		lhs, op, rhs := mes.Receiver, mes.SlotName, mes.Args[0]
		switch op {
		case "+", "-", "*", "/", "%":
			return evalArithmeticOp(lhs, op, rhs, env)
		case "==", "!=", "<", "<=", ">", ">=":
			return evalCompareOp(lhs, op, rhs, env)
		case "=", ":=", ".", ";", ",", "&&", "||":
			return evalSpecialOp(lhs, op, rhs, env)
		}
	}
	return EvalMessage(mes, env)
}

func EvalMessage(mes *Message, env *Memory) BoObject {
	result := evalIfDefaultFunction(mes, env)
	if result != nil {
		return result
	}

	var receiver BoObject
	if mes.Receiver != nil {
		receiver = EvalNode(mes.Receiver, env)
	}

	var f BoObject
	if receiver != nil {
		if uo, ok := receiver.(*UserObject); ok {
			f = uo.Get(mes.SlotName)
		}
	}
	if f == nil {
		f = env.Get(mes.SlotName)
	}

	if f == nil {
		panic(fmt.Sprintf("ERROR evalMessage() => %s is not defined.", mes.SlotName))
	}

	if !mes.HasArgs {
		return f
	}

	switch fn := f.(type) {
	case *Fun:
		var uo *UserObject
		if receiver != nil {
			uo, _ = receiver.(*UserObject)
		}
		return EvalFunCall(uo, fn, mes.Args, env)
	case *Macro:
		var uo *UserObject
		if receiver != nil {
			uo, _ = receiver.(*UserObject)
		}
		return evalMacroCall(uo, fn, mes.Args, env)
	case *BuiltinFunction:
		return fn.Call(receiver, mes.Args, env)
	default:
		panic(fmt.Sprintf("ERROR evalMessage() => %v is not fun or macro", f))
	}
}

func evalIfDefaultFunction(mes *Message, env *Memory) BoObject {
	method, ok := DefaultMethodMap[mes.SlotName]
	if !ok {
		return nil
	}
	return method(mes, env)
}

func EvalFunCall(this *UserObject, fun *Fun, args []BoObject, callerEnv *Memory) BoObject {
	evaluated := make([]BoObject, len(args))
	for i, arg := range args {
		evaluated[i] = EvalNode(arg, callerEnv)
	}
	closure := bind(this, fun.ArgList, evaluated, fun.CreatedEnv.SubMemory())
	return EvalNode(fun.Body, closure)
}

func evalMacroCall(this *UserObject, macro *Macro, args []BoObject, callerEnv *Memory) BoObject {
	closure := bind(this, macro.ArgList, args, callerEnv.SubMemory())
	return EvalNode(macro.Body, closure)
}

func bind(this *UserObject, argList []string, values []BoObject, createdEnv *Memory) *Memory {
	closure := createdEnv.SubMemory()
	if len(argList) != len(values) {
		panic("ERROR bind() => arg length error.")
	}
	for i := 0; i < len(argList); i++ {
		closure.DefineForce(argList[i], values[i])
	}
	if this != nil {
		closure.DefineForce("this", this)
	}
	return closure
}

func evalSpecialOp(lhs BoObject, op string, rhs BoObject, env *Memory) BoObject {
	switch op {
	case "&&":
		eLhs := EvalNode(lhs, env)
		if eLhs == BoObject(NIL) {
			return NIL
		}
		return EvalNode(rhs, env)
	case "||":
		eLhs := EvalNode(lhs, env)
		if eLhs != BoObject(NIL) {
			return eLhs
		}
		return EvalNode(rhs, env)
	case ";":
		EvalNode(lhs, env)
		return EvalNode(rhs, env)
	case ":=":
		if m, ok := lhs.(*Message); ok {
			return evalAssign("define", m, EvalNode(rhs, env), env)
		}
	case "=":
		if m, ok := lhs.(*Message); ok {
			return evalAssign("update", m, EvalNode(rhs, env), env)
		}
	case ".":
		panic(fmt.Sprintf("ERROR evalSpecialOp(%s %s %s)", lhs.Str(), op, rhs.Str()))
	default:
		// ","
		panic(fmt.Sprintf("ERROR evalSpecialOp(%s %s %s)", lhs.Str(), op, rhs.Str()))
	}
	panic(fmt.Sprintf("ERROR evalSpecialOp(%s %s %s)", lhs.Str(), op, rhs.Str()))
}

func evalArithmeticOp(lhs BoObject, op string, rhs BoObject, env *Memory) BoObject {
	eLhs := EvalNode(lhs, env)
	eRhs := EvalNode(rhs, env)

	if lNum, ok := eLhs.(*Num); ok {
		var n float64
		switch r := eRhs.(type) {
		case *Num:
			n = r.Value
		case *Str:
			parsed, err := strconv.ParseFloat(r.Value, 64)
			if err != nil {
				panic("ERROR evalArithmeticOp")
			}
			n = parsed
		default:
			panic("ERROR evalArithmeticOp")
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
	} else if lStr, ok := eLhs.(*Str); ok {
		if op == "+" {
			switch r := eRhs.(type) {
			case *Str:
				return NewStr(lStr.Value + r.Value)
			case *Num:
				return NewStr(lStr.Value + r.Str())
			}
		} else if rNum, ok := eRhs.(*Num); ok {
			idx := int(rNum.Value)
			if op == "/" {
				return NewStr(lStr.Value[:idx])
			}
			if op == "%" {
				return NewStr(lStr.Value[idx:])
			}
		}
	}
	panic(fmt.Sprintf("ERROR evalArithmeticOp(%s %s %s)", lhs.Str(), op, rhs.Str()))
}

func evalCompareOp(lhs BoObject, op string, rhs BoObject, env *Memory) BoObject {
	eLhs := EvalNode(lhs, env)
	eRhs := EvalNode(rhs, env)
	cmp := eLhs.Compare(eRhs)
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

func evalAssign(flag string, message *Message, value BoObject, env *Memory) BoObject {
	if message.Receiver != nil {
		assignReceiver := EvalNode(message.Receiver, env)
		if uo, ok := assignReceiver.(*UserObject); ok && !message.HasArgs {
			return assignObjectSlot(uo, message.SlotName, value)
		}
	} else {
		if !message.HasArgs {
			result := assignLocalVariable(flag, message.SlotName, value, env)
			if result != nil {
				return result
			}
			panic(fmt.Sprintf("ERROR evalAssign() assign error. result =nil."))
		}
	}
	panic("ERROR evalAssign()")
}

func assignObjectSlot(receiverObj *UserObject, varName string, value BoObject) BoObject {
	return receiverObj.AssignToObject(varName, value)
}

func assignLocalVariable(flag string, varName string, value BoObject, env *Memory) BoObject {
	if flag == "define" {
		return env.Define(varName, value)
	}
	return env.Update(varName, value)
}
