// object.go — VM のランタイムオブジェクト型 + パーサ用AST型。
package main

import (
	"fmt"
	"strconv"
	"strings"
)

// BoObject はBinOp言語の全オブジェクトの基底インターフェース。
type BoObject interface {
	Str() string
	Compare(other BoObject) int
	Clone() BoObject
}

// --- Num: 数値 ---

type Num struct {
	Value float64
}

func NewNum(v float64) *Num {
	return &Num{Value: v}
}

func (n *Num) Str() string {
	return strconv.FormatFloat(n.Value, 'f', -1, 64)
}

func (n *Num) Compare(other BoObject) int {
	if o, ok := other.(*Num); ok {
		result := n.Value - o.Value
		if result == 0 {
			return 0
		} else if result < 0 {
			return -1
		}
		return 1
	}
	return -1
}

func (n *Num) Clone() BoObject { return n }

// --- Str: 文字列 ---

type Str struct {
	Value string
}

func NewStr(v string) *Str {
	return &Str{Value: v}
}

func (s *Str) Str() string {
	return fmt.Sprintf(`"%s"`, s.Value)
}

func (s *Str) Compare(other BoObject) int {
	if o, ok := other.(*Str); ok {
		if s.Value == o.Value {
			return 0
		} else if s.Value < o.Value {
			return -1
		}
		return 1
	}
	return -1
}

func (s *Str) Clone() BoObject { return s }

// --- NilObj ---

type NilObj struct{}

var NIL = &NilObj{}

func (n *NilObj) Str() string              { return "nil" }
func (n *NilObj) Compare(other BoObject) int {
	if _, ok := other.(*NilObj); ok {
		return 0
	}
	return -1
}
func (n *NilObj) Clone() BoObject { return n }

// --- Message: AST ノード（パーサ/コンパイラ用） ---

type Message struct {
	Receiver BoObject
	SlotName string
	Args     []BoObject
	HasArgs  bool
}

func NewMessage(receiver BoObject, slotName string, args []BoObject) *Message {
	hasArgs := args != nil

	if slotName != "." {
		return &Message{
			Receiver: receiver,
			SlotName: slotName,
			Args:     args,
			HasArgs:  hasArgs,
		}
	}

	if args != nil && len(args) == 1 {
		if m, ok := args[0].(*Message); ok {
			return &Message{
				Receiver: receiver,
				SlotName: m.SlotName,
				Args:     m.Args,
				HasArgs:  m.HasArgs,
			}
		}
	}

	var argsStrs []string
	if args != nil {
		for _, e := range args {
			argsStrs = append(argsStrs, e.Str())
		}
	}
	recStr := ""
	if receiver != nil {
		recStr = receiver.Str()
	}
	panic(fmt.Sprintf("ERROR new Message(%s,%s,%s)", recStr, slotName, strings.Join(argsStrs, ",")))
}

func (m *Message) Str() string {
	receiverStr := ""
	if m.Receiver != nil {
		receiverStr = m.Receiver.Str()
	}

	argsStr := ""
	if m.HasArgs {
		parts := make([]string, len(m.Args))
		for i, e := range m.Args {
			parts[i] = e.Str()
		}
		argsStr = "(" + strings.Join(parts, ", ") + ")"
	}

	if m.SlotName == "." && m.Args != nil && len(m.Args) == 1 {
		return receiverStr + "." + m.Args[0].Str()
	} else if m.Receiver == nil {
		return m.SlotName + argsStr
	} else {
		return receiverStr + "." + m.SlotName + argsStr
	}
}

func (m *Message) Compare(other BoObject) int {
	if m == other {
		return 0
	}
	return -1
}

func (m *Message) Clone() BoObject { return m }

// --- Fun: VM用の関数オブジェクト ---
// Body は命令列（ASTではなくInstruction配列）。

type Fun struct {
	Params     []string
	Body       []Instruction
	CreatedEnv *Memory
}

func (f *Fun) Str() string {
	return fmt.Sprintf("fun(%d params)", len(f.Params))
}

func (f *Fun) Compare(other BoObject) int {
	if f == other {
		return 0
	}
	return -1
}

func (f *Fun) Clone() BoObject { return f }

// --- Macro: VM用のマクロオブジェクト ---

type Macro struct {
	Params     []string
	Body       []Instruction
	CreatedEnv *Memory
}

func (mc *Macro) Str() string {
	return fmt.Sprintf("macro(%d params)", len(mc.Params))
}

func (mc *Macro) Compare(other BoObject) int {
	if mc == other {
		return 0
	}
	return -1
}

func (mc *Macro) Clone() BoObject { return mc }

// --- UserObject: プロトタイプベースオブジェクト ---

type UserObject struct {
	Mem   *Memory
	Proto *UserObject
}

func NewUserObject(slot *Memory, proto *UserObject) *UserObject {
	return &UserObject{Mem: slot, Proto: proto}
}

func (u *UserObject) Compare(other BoObject) int {
	if u == other {
		return 0
	}
	return -1
}

func (u *UserObject) Str() string {
	parts := []string{}
	for _, k := range u.Mem.Order {
		if v, ok := u.Mem.Slots[k]; ok {
			parts = append(parts, k+":"+v.Str())
		}
	}
	return "{" + strings.Join(parts, ",") + "}"
}

func (u *UserObject) Clone() BoObject {
	return NewUserObject(u.Mem.SubMemory(), u)
}

func (u *UserObject) Get(name string) BoObject {
	result := u.Mem.Get(name)
	if result != nil {
		return result
	}
	if u.Proto != nil {
		return u.Proto.Get(name)
	}
	return nil
}

func (u *UserObject) AssignToObject(name string, value BoObject) BoObject {
	return u.Mem.DefineForce(name, value)
}

// --- BuiltinFunction ---

type BuiltinFunction struct {
	Name string
	Fn   func(vm *VM, receiver BoObject, args []BoObject) BoObject
}

func (b *BuiltinFunction) Str() string              { return b.Name }
func (b *BuiltinFunction) Compare(other BoObject) int {
	if b == other {
		return 0
	}
	return -1
}
func (b *BuiltinFunction) Clone() BoObject { return b }
