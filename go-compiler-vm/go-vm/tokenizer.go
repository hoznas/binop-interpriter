package main

import (
	"fmt"
	"regexp"
)

type TokenType string

const (
	TokenLPar  TokenType = "("
	TokenRPar  TokenType = ")"
	TokenSym   TokenType = "sym"
	TokenNum   TokenType = "num"
	TokenStr   TokenType = "str"
	TokenBinOp TokenType = "binop"
)

type Token struct {
	Type  TokenType
	Value string
}

var (
	reNum        = regexp.MustCompile(`^(\d+)`)
	reStr        = regexp.MustCompile(`^("(?:[^"]*)")`)
	reLPar       = regexp.MustCompile(`^(\()`)
	reRPar       = regexp.MustCompile(`^(\))`)
	reBinOp      = regexp.MustCompile(`^(<=|>=|==|!=|:=|&&|\|\||[.*%+\-/<>=,])`)
	reTerminator = regexp.MustCompile(`^(\n|;)`)
	reWhiteSpace = regexp.MustCompile(`^([ \t])`)
	reSym        = regexp.MustCompile(`^([a-zA-Z_][a-zA-Z0-9_]*)`)
)

func Tokenize(code string) []Token {
	processedCode := preprocess(code)
	result := makeTokenList(processedCode)
	return filterSemicolon(result)
}

var rePreprocess = regexp.MustCompile(`(\r\n|\r|\n|;)+`)

func preprocess(code string) string {
	return rePreprocess.ReplaceAllString(code, ";")
}

func makeTokenList(code string) []Token {
	var result []Token
	for len(code) > 0 {
		token, rest := getToken(code)
		if token != nil {
			result = append(result, *token)
		}
		code = rest
	}
	return filterSemicolon(result)
}

func getToken(code string) (*Token, string) {
	var match []string
	var token *Token

	if match = reNum.FindStringSubmatch(code); match != nil {
		token = &Token{Type: TokenNum, Value: match[1]}
	} else if match = reStr.FindStringSubmatch(code); match != nil {
		temp := match[1]
		token = &Token{Type: TokenStr, Value: temp[1 : len(temp)-1]}
	} else if match = reLPar.FindStringSubmatch(code); match != nil {
		token = &Token{Type: TokenLPar, Value: match[1]}
	} else if match = reRPar.FindStringSubmatch(code); match != nil {
		token = &Token{Type: TokenRPar, Value: match[1]}
	} else if match = reBinOp.FindStringSubmatch(code); match != nil {
		token = &Token{Type: TokenBinOp, Value: match[1]}
	} else if match = reTerminator.FindStringSubmatch(code); match != nil {
		token = &Token{Type: TokenBinOp, Value: ";"}
	} else if match = reWhiteSpace.FindStringSubmatch(code); match != nil {
		token = nil
	} else if match = reSym.FindStringSubmatch(code); match != nil {
		token = &Token{Type: TokenSym, Value: match[1]}
	} else {
		panic(fmt.Sprintf("ERROR getToken(%s)", code))
	}

	var usedLen int
	if token != nil {
		if token.Type == TokenStr {
			usedLen = len(token.Value) + 2
		} else {
			usedLen = len(token.Value)
		}
	} else {
		usedLen = 1
	}
	rest := code[usedLen:]
	return token, rest
}

func filterSemicolon(tokens []Token) []Token {
	if len(tokens) == 0 {
		return tokens
	}
	for len(tokens) > 1 && IsTerminator(tokens[0]) {
		tokens = tokens[1:]
	}
	for len(tokens) > 1 && IsTerminator(tokens[len(tokens)-1]) {
		tokens = tokens[:len(tokens)-1]
	}
	return filter2(filter1(tokens))
}

func filter1(tokens []Token) []Token {
	var result []Token
	for i := 0; i < len(tokens)-1; i++ {
		if IsTerminator(tokens[i]) && IsTerminator(tokens[i+1]) {
		} else if IsTerminator(tokens[i]) && IsRPar(tokens[i+1]) {
		} else if IsTerminator(tokens[i]) && IsBinOp(tokens[i+1]) {
		} else {
			result = append(result, tokens[i])
		}
	}
	result = append(result, tokens[len(tokens)-1])
	return result
}

func filter2(tokens []Token) []Token {
	var result []Token
	for i := 1; i < len(tokens); i++ {
		if IsLPar(tokens[i-1]) && IsTerminator(tokens[i]) {
		} else if IsBinOp(tokens[i-1]) && IsTerminator(tokens[i]) {
		} else {
			result = append(result, tokens[i])
		}
	}
	result = append([]Token{tokens[0]}, result...)
	return result
}

func IsTerminator(t Token) bool {
	return t.Type == TokenBinOp && (t.Value == ";" || t.Value == "\n")
}

func IsLPar(t Token) bool  { return t.Type == TokenLPar }
func IsRPar(t Token) bool  { return t.Type == TokenRPar }
func IsBinOp(t Token) bool { return t.Type == TokenBinOp }
func IsSym(t Token) bool   { return t.Type == TokenSym }
