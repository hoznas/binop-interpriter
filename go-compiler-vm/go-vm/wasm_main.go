//go:build js && wasm

package main

import (
	"strings"
	"syscall/js"
)

func main() {
	// binopCompile(source: string) -> ilText: string
	js.Global().Set("binopCompile", js.FuncOf(func(_ js.Value, args []js.Value) any {
		if len(args) < 1 {
			return ""
		}
		return Compile(args[0].String())
	}))

	// binopRunIL(ilText: string) -> output: string
	// print() の出力と最終戻り値を改行で連結して返す
	js.Global().Set("binopRunIL", js.FuncOf(func(_ js.Value, args []js.Value) any {
		if len(args) < 1 {
			return ""
		}
		var prints []string
		vm := NewVM(func(msg string) {
			prints = append(prints, msg)
		})
		result := vm.RunIL(args[0].String())
		parts := append(prints, result.Str())
		return strings.Join(parts, "\n")
	}))

	select {} // JS 関数の登録を維持するため終了しない
}
