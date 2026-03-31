// object.go — コンパイラが必要とするAST型のみ定義。
// ランタイム型（Fun, Macro, UserObject）はコンパイラには不要。
package main

import (
	"fmt"
	"strconv"
	"strings"
)

// BoObject はBinOp言語の全オブジェクトの基底インターフェース。
// コンパイラではパーサが生成するAST表現として使う。
type BoObject interface {
	Str() string
	Compare(other BoObject) int
	Clone() BoObject
}

// --- Num: 数値リテラル ---

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

// --- Str: 文字列リテラル ---

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

// --- Nil: 偽を表す唯一の値 ---

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

// --- Message: AST の中心的なノード ---
// 二項演算子、関数呼出、スロットアクセスを全て表現する。
//
// 例:
//   1 + 2         → Message{Receiver:Num(1), SlotName:"+", Args:[Num(2)]}
//   print(x)      → Message{Receiver:nil, SlotName:"print", Args:[Message(x)]}
//   obj.name      → Message{Receiver:Message(obj), SlotName:"name", Args:nil}

type Message struct {
	Receiver BoObject   // nil = receiverなし
	SlotName string
	Args     []BoObject // nil = 引数なし, [] = 引数0個の呼出 ()
	HasArgs  bool       // Args が明示的に指定されたか（nil vs []の区別）
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

	// "." 演算子: receiver.method の構文糖衣を展開する
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
	}
	return receiverStr + "." + m.SlotName + argsStr
}

func (m *Message) Compare(other BoObject) int {
	if m == other {
		return 0
	}
	return -1
}

func (m *Message) Clone() BoObject { return m }
