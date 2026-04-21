package main

import (
	"fmt"
	"strconv"
	"strings"
)

// BoObject is the base interface for all objects in BinOp language.
type BoObject interface {
	Str() string
	Compare(other BoObject) int
	Clone() BoObject
}

// --- Num ---

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
		} else {
			return 1
		}
	}
	return -1
}

func (n *Num) Clone() BoObject {
	return n
}

// --- Str ---

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
		} else {
			return 1
		}
	}
	return -1
}

func (s *Str) Clone() BoObject {
	return s
}

func (s *Str) Concat(other BoObject) BoObject {
	if o, ok := other.(*Str); ok {
		return NewStr(s.Value + o.Value)
	}
	return NewStr(s.Value + other.Str())
}

// --- Nil ---

type NilObj struct{}

var NIL = &NilObj{}

func (n *NilObj) Str() string {
	return "nil"
}

func (n *NilObj) Compare(other BoObject) int {
	if _, ok := other.(*NilObj); ok {
		return 0
	}
	return -1
}

func (n *NilObj) Clone() BoObject {
	return n
}

// --- Message ---

type Message struct {
	Receiver BoObject   // nil means no receiver
	SlotName string
	Args     []BoObject // nil means no args (undefined), empty slice means ()
	HasArgs  bool       // true if args were provided (distinguishes undefined vs [])
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

	// slotName === "."
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

func (m *Message) Clone() BoObject {
	return m
}

// --- Fun ---

type Fun struct {
	ArgList    []string
	Body       BoObject
	CreatedEnv *Memory
}

func NewFun(args []BoObject, env *Memory) *Fun {
	if len(args) == 0 {
		panic("ERROR new Fun(no-argument)")
	}
	body := args[len(args)-1]
	argList := make([]string, 0, len(args)-1)
	for _, e := range args[:len(args)-1] {
		if m, ok := e.(*Message); ok && m.Receiver == nil && !m.HasArgs {
			argList = append(argList, m.SlotName)
		} else {
			panic(fmt.Sprintf("ERROR new Fun() => type error. value=%s", e.Str()))
		}
	}
	return &Fun{ArgList: argList, Body: body, CreatedEnv: env}
}

func (f *Fun) Str() string {
	argStr := ""
	if len(f.ArgList) > 0 {
		argStr = strings.Join(f.ArgList, ",") + ","
	}
	return fmt.Sprintf("fun(%s%s)", argStr, f.Body.Str())
}

func (f *Fun) Compare(other BoObject) int {
	if f == other {
		return 0
	}
	return -1
}

func (f *Fun) Clone() BoObject {
	return f
}

// --- Macro ---

type Macro struct {
	ArgList []string
	Body    BoObject
}

func NewMacro(args []BoObject) *Macro {
	if len(args) == 0 {
		panic("ERROR new Macro(no-argument)")
	}
	body := args[len(args)-1]
	argList := make([]string, 0, len(args)-1)
	for _, e := range args[:len(args)-1] {
		if m, ok := e.(*Message); ok && m.Receiver == nil && !m.HasArgs {
			argList = append(argList, m.SlotName)
		} else {
			panic(fmt.Sprintf("ERROR new Macro()  value=%s", e.Str()))
		}
	}
	return &Macro{ArgList: argList, Body: body}
}

func (mc *Macro) Str() string {
	argStr := ""
	if len(mc.ArgList) > 0 {
		argStr = strings.Join(mc.ArgList, ",") + ","
	}
	return fmt.Sprintf("macro(%s%s)", argStr, mc.Body.Str())
}

func (mc *Macro) Compare(other BoObject) int {
	if mc == other {
		return 0
	}
	return -1
}

func (mc *Macro) Clone() BoObject {
	return mc
}

// --- UserObject ---

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

func (u *UserObject) Define(name string, value BoObject) BoObject {
	return u.Mem.Define(name, value)
}

func (u *UserObject) Update(name string, value BoObject) BoObject {
	return u.Mem.Update(name, value)
}

func (u *UserObject) AssignToObject(name string, value BoObject) BoObject {
	return u.Mem.DefineForce(name, value)
}

func (u *UserObject) Get(name string) BoObject {
	return u.Mem.Get(name)
}
