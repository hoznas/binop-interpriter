// main.go — BinOp VM のエントリポイント。
// ILテキスト（go-compilerの出力）を読み込み、VMで実行する。
//
// 使い方:
//   go-compiler sample.bo | go run .          (パイプでILを受け取る)
//   go run . program.il                       (ILファイルを指定)
//   go run . --source sample.bo               (ソースを直接コンパイル+実行)
package main

import (
	"fmt"
	"io"
	"os"
)

func main() {
	if len(os.Args) >= 3 && os.Args[1] == "--source" {
		// ソースファイルを直接コンパイル+実行
		fileContent, err := os.ReadFile(os.Args[2])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
			os.Exit(1)
		}
		vm := NewVM(nil)
		result := vm.Run(string(fileContent))
		fmt.Println(result.Str())
		return
	}

	if len(os.Args) >= 2 {
		// ILファイルを読み込んで実行
		fileContent, err := os.ReadFile(os.Args[1])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
			os.Exit(1)
		}
		vm := NewVM(nil)
		result := vm.RunIL(string(fileContent))
		fmt.Println(result.Str())
		return
	}

	// stdinからILを読み込んで実行
	ilBytes, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading stdin: %v\n", err)
		os.Exit(1)
	}
	vm := NewVM(nil)
	result := vm.RunIL(string(ilBytes))
	fmt.Println(result.Str())
}
