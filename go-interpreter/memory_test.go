package main

import "testing"

func TestMemory(t *testing.T) {
	env := NewMemory(nil)
	sub := env.SubMemory()
	env.Define("one", NewNum(1))
	env.Define("two", NewNum(2))
	sub.Define("three", NewNum(3))
	sub.Define("four", NewNum(4))

	// A: redefine in same scope returns nil
	if env.Define("one", NewNum(-1)) != nil {
		t.Error("A: expected nil for redefine in same scope")
	}
	// B: define in sub scope (shadowing) returns non-nil
	if sub.Define("one", NewNum(-1)) == nil {
		t.Error("B: expected non-nil for define in sub scope")
	}
	// C: sub.Get("one") returns non-nil
	if sub.Get("one") == nil {
		t.Error("C: expected non-nil for sub.Get('one')")
	}
	// D: update in sub updates parent, env.Get("one") == "1"
	sub.Update("one", NewNum(1))
	if env.Get("one") == nil || env.Get("one").Str() != "1" {
		t.Error("D: expected env.Get('one') to be '1'")
	}
}
