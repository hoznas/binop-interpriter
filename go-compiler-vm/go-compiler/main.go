// main.go — BinOp IL Compiler のエントリポイント。
// ソースファイルを読み込み、中間言語(IL)のテキストを標準出力に出力する。
//
// 使い方: go run . <source.bo>
package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: binop-compiler <source.bo>")
		os.Exit(1)
	}

	fileContent, err := os.ReadFile(os.Args[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
		os.Exit(1)
	}

	result := Compile(string(fileContent))
	fmt.Println(result)
}
