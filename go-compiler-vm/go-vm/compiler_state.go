package main

import "fmt"

// CompilerState はコンパイル中の状態を保持する。
type CompilerState struct {
	instructions []Instruction
	labelCounter int
}

func NewCompilerState() *CompilerState {
	return &CompilerState{instructions: []Instruction{}, labelCounter: 0}
}

func (cs *CompilerState) Emit(op OpCode, operands ...string) {
	cs.instructions = append(cs.instructions, Instruction{Op: op, Operands: operands})
}

func (cs *CompilerState) NewLabel() string {
	label := fmt.Sprintf("L%d", cs.labelCounter)
	cs.labelCounter++
	return label
}

func (cs *CompilerState) GetInstructions() []Instruction {
	return cs.instructions
}
