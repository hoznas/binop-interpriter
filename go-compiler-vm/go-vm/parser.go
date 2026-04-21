package main

import (
	"fmt"
	"regexp"
	"strconv"
)

type TokenReader struct {
	tokens []Token
	ptr    int
}

func NewTokenReader(tokens []Token) *TokenReader {
	return &TokenReader{tokens: tokens, ptr: -1}
}

func (r *TokenReader) Next() Token {
	r.ptr++
	return r.tokens[r.ptr]
}

func (r *TokenReader) Prev() Token {
	r.ptr--
	return r.tokens[r.ptr]
}

func (r *TokenReader) Curr() Token {
	return r.tokens[r.ptr]
}

func (r *TokenReader) SeeNext(n int) Token {
	return r.tokens[r.ptr+n]
}

func (r *TokenReader) EndOfToken() bool {
	return !(r.ptr < len(r.tokens)-1)
}

func (r *TokenReader) RestCount() int {
	return len(r.tokens) - 1 - r.ptr
}

func (r *TokenReader) Drop(tokenStr string) {
	t := r.Next()
	if t.Value != tokenStr {
		panic(fmt.Sprintf(`ERROR TokenReader::drop("%s")=>"%s"`, tokenStr, t.Value))
	}
}

var reUserBinOp = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

func binOpRate(op string) int {
	if op == "." {
		return 0
	}
	if op == "*" || op == "/" || op == "%" {
		return 1
	}
	if op == "+" || op == "-" {
		return 2
	}
	if op == "<" || op == ">" || op == "<=" || op == ">=" {
		return 3
	}
	if op == "==" || op == "!=" {
		return 4
	}
	if op == "&&" || op == "||" {
		return 5
	}
	if op == ":=" || op == "=" {
		return 7
	}
	if reUserBinOp.MatchString(op) {
		return 8
	}
	if op == ";" {
		return 9
	}
	if op == "," {
		return 10
	}
	panic(fmt.Sprintf("ERROR binOpRate() =>unknown BinOp(%s)", op))
}

func Parse(tokens []Token) BoObject {
	reader := NewTokenReader(tokens)
	return parseBinOp(reader, 9)
}

func parseBinOp(reader *TokenReader, depth int) BoObject {
	if depth == -1 {
		return parseFactor(reader)
	} else if reader.EndOfToken() {
		panic("ERROR parseBinOp(end of code)")
	} else {
		result := parseBinOp(reader, depth-1)
		if reader.EndOfToken() {
			return result
		}
		next := reader.SeeNext(1)
		if IsRPar(next) {
			return result
		}
		if IsBinOp(next) || (IsSym(next) && binOpRate(next.Value) == depth) {
			return parseBinOp2(reader, result, depth)
		}
		return result
	}
}

func parseBinOp2(reader *TokenReader, lhs BoObject, depth int) BoObject {
	result := lhs
	for {
		if reader.EndOfToken() {
			return result
		} else if IsRPar(reader.SeeNext(1)) {
			return result
		} else if binOpRate(reader.SeeNext(1).Value) == depth {
			op := reader.Next()
			code2 := parseBinOp(reader, depth-1)
			result = NewMessage(result, op.Value, []BoObject{code2})
		} else {
			return result
		}
	}
}

func parseFactor(reader *TokenReader) BoObject {
	token := reader.Next()
	switch token.Type {
	case TokenNum:
		v, _ := strconv.ParseFloat(token.Value, 64)
		return NewNum(v)
	case TokenStr:
		return NewStr(token.Value)
	case TokenLPar:
		return parseParents(reader)
	case TokenSym:
		return parseMessage(token.Value, reader)
	case TokenRPar:
		panic("ERROR parseFactor() syntax error => ')' unmatch")
	default:
		panic(fmt.Sprintf("ERROR parseFactor() => arg=BinOp(%s)", token.Value))
	}
}

func parseMessage(slotName string, reader *TokenReader) *Message {
	if reader.RestCount() >= 2 && IsLPar(reader.SeeNext(1)) {
		args := parseArgParents(reader)
		return NewMessage(nil, slotName, args)
	}
	return NewMessage(nil, slotName, nil)
}

func parseArgParents(reader *TokenReader) []BoObject {
	reader.Drop("(")
	if IsRPar(reader.SeeNext(1)) {
		reader.Drop(")")
		return []BoObject{}
	}
	args := toArray(parseBinOp(reader, 10))
	reader.Drop(")")
	return args
}

func parseParents(reader *TokenReader) BoObject {
	result := parseBinOp(reader, 9)
	reader.Drop(")")
	return result
}

func toArray(obj BoObject) []BoObject {
	if m, ok := obj.(*Message); ok {
		if m.Receiver != nil && m.SlotName == "," && m.Args != nil && len(m.Args) == 1 {
			return append(toArray(m.Receiver), m.Args[0])
		}
	}
	return []BoObject{obj}
}
