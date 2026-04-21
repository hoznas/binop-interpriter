package main

import "fmt"

// BuiltinFunction represents a built-in function in BinOp language.
type BuiltinFunction struct {
	Name string
	Fn   func(receiver BoObject, args []BoObject, env *Memory) BoObject
}

func (b *BuiltinFunction) Str() string {
	return b.Name
}

func (b *BuiltinFunction) Compare(other BoObject) int {
	if b == other {
		return 0
	}
	return -1
}

func (b *BuiltinFunction) Clone() BoObject {
	return b
}

func (b *BuiltinFunction) Call(receiver BoObject, args []BoObject, env *Memory) BoObject {
	return b.Fn(receiver, args, env)
}

// --- Builtin functions ---

var FUN = &BuiltinFunction{
	Name: "fun",
	Fn: func(receiver BoObject, args []BoObject, env *Memory) BoObject {
		if len(args) >= 1 {
			return NewFun(args, env)
		}
		panic(fmt.Sprintf("ERROR fun(args.len===%d) arg length error", len(args)))
	},
}

var MACRO = &BuiltinFunction{
	Name: "macro",
	Fn: func(receiver BoObject, args []BoObject, env *Memory) BoObject {
		if len(args) >= 1 {
			return NewMacro(args)
		}
		panic(fmt.Sprintf("ERROR macro(args.len===%d) arg length error", len(args)))
	},
}

var MESSAGE = &BuiltinFunction{
	Name: "message",
	Fn: func(receiver BoObject, args []BoObject, env *Memory) BoObject {
		if len(args) >= 2 {
			if s, ok := args[0].(*Str); ok {
				typ := s.Value
				if typ == "__" && len(args) == 2 {
					if s2, ok := args[1].(*Str); ok {
						return NewMessage(nil, s2.Value, nil)
					}
				} else if typ == "_@" {
					if s2, ok := args[1].(*Str); ok {
						return NewMessage(nil, s2.Value, args[2:])
					}
				} else if typ == "@_" && len(args) == 3 {
					if s2, ok := args[2].(*Str); ok {
						return NewMessage(args[1], s2.Value, nil)
					}
				} else if typ == "@@" {
					if s2, ok := args[2].(*Str); ok {
						return NewMessage(args[1], s2.Value, args[3:])
					}
				}
			}
		}
		strs := make([]string, len(args))
		for i, e := range args {
			strs[i] = e.Str()
		}
		panic(fmt.Sprintf("ERROR MESSAGE(%s)", join(strs, ",")))
	},
}

var EVAL_NODE = &BuiltinFunction{
	Name: "evalNode",
	Fn: func(receiver BoObject, args []BoObject, env *Memory) BoObject {
		if len(args) == 1 {
			return EvalNode(EvalNode(args[0], env), env)
		}
		panic(fmt.Sprintf("ERROR evalNode(args.len===%d) arg length error", len(args)))
	},
}

var EVAL_STR = &BuiltinFunction{
	Name: "evalStr",
	Fn: func(receiver BoObject, args []BoObject, env *Memory) BoObject {
		if len(args) == 1 {
			if s, ok := args[0].(*Str); ok {
				return EvalStr(s.Value, env)
			}
		}
		panic(fmt.Sprintf("ERROR evalStr(args.len===%d) arg length error", len(args)))
	},
}

// --- Default methods (if, print, clone, doWhile) ---

func evalIf(mes *Message, env *Memory) BoObject {
	if mes.Receiver == nil {
		panic("ERROR evalIf(no receiver)")
	}
	if mes.Args == nil || (len(mes.Args) != 1 && len(mes.Args) != 2) {
		panic("ERROR evalIf(arg length error)")
	}
	recv := EvalNode(mes.Receiver, env)
	var block BoObject
	if recv != BoObject(NIL) {
		block = mes.Args[0]
	} else if len(mes.Args) == 2 {
		block = mes.Args[1]
	} else {
		block = NIL
	}
	return EvalNode(block, env)
}

func evalPrint(mes *Message, env *Memory) BoObject {
	if mes.Receiver == nil {
		panic("ERROR evalPrint(no receiver)")
	}
	if mes.Args == nil || len(mes.Args) != 0 {
		panic("ERROR evalPrint(arg length error)")
	}
	result := EvalNode(mes.Receiver, env)
	GlobalPrint(result.Str())
	return result
}

func evalClone(mes *Message, env *Memory) BoObject {
	if mes.Receiver == nil {
		panic("ERROR evalClone(no receiver)")
	}
	if mes.Args == nil || len(mes.Args) != 0 {
		panic("ERROR evalClone(arg length error)")
	}
	return EvalNode(mes.Receiver, env).Clone()
}

func evalDoWhile(mes *Message, env *Memory) BoObject {
	if mes.Receiver == nil {
		panic("ERROR evalDoWhile(no receiver)")
	}
	if _, ok := mes.Receiver.(*Message); !ok {
		panic("ERROR evalDoWhile(receiver is not fun)")
	}
	if mes.Args == nil || len(mes.Args) != 1 {
		panic("ERROR evalDoWhile(arg length error)")
	}
	condition := EvalNode(mes.Receiver, env)
	fun, ok := condition.(*Fun)
	if !ok {
		panic("ERROR evalDoWhile()")
	}

	var result BoObject = NIL
	for EvalFunCall(nil, fun, []BoObject{}, fun.CreatedEnv) != BoObject(NIL) {
		result = EvalNode(mes.Args[0], env)
	}
	return result
}

var DefaultMethodMap map[string]func(mes *Message, env *Memory) BoObject

func init() {
	DefaultMethodMap = map[string]func(mes *Message, env *Memory) BoObject{
		"if":      evalIf,
		"print":   evalPrint,
		"clone":   evalClone,
		"doWhile": evalDoWhile,
	}
}

// helper
func join(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
