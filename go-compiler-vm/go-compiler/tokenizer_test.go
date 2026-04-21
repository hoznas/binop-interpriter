package main

import (
	"strings"
	"testing"
)

func TestTokenizer(t *testing.T) {
	tests := []struct {
		code   string
		mustBe string
	}{
		{"123", "123"},
		{"abc", "abc"},
		{`"abc def"`, "abc def"},
		{"\"abc \"\n\"def\"", "abc |;|def"},
		{";;abc;def;;zzz;;", "abc|;|def|;|zzz"},
		{
			";;;abc.f(;c;,;;a;;b;;)  ;;;;;  def(;;\"a b c\";) ; ; xxx; zzz ;;  ;",
			"abc|.|f|(|c|,|a|;|b|)|;|def|(|a b c|)|;|xxx|;|zzz",
		},
	}
	for _, tt := range tests {
		tokens := Tokenize(tt.code)
		vals := make([]string, len(tokens))
		for i, tok := range tokens {
			vals[i] = tok.Value
		}
		result := strings.Join(vals, "|")
		if result != tt.mustBe {
			t.Errorf("TOKENIZER ERROR code=%s result=%s mustBe=%s", tt.code, result, tt.mustBe)
		}
	}
}
