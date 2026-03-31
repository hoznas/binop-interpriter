package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) >= 2 {
		e := NewEvaluator(nil)
		fileContent, err := os.ReadFile(os.Args[1])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
			os.Exit(1)
		}
		e.Eval(string(fileContent))
	} else {
		fmt.Println("argument file required")
	}
}
