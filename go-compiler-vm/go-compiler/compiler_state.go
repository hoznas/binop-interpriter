// compiler_state.go — コンパイラの内部状態を管理する。
// 命令バッファへの書き込みとラベル生成を担当する。
// go/ の Memory（ランタイムのスコープチェーン）とは役割が異なる。
package main

import "fmt"

// CompilerState はコンパイル中の状態を保持する。
type CompilerState struct {
	instructions []Instruction // 生成された命令列
	labelCounter int           // ユニークなラベル番号のカウンタ
}

// NewCompilerState は新しいコンパイラ状態を生成する。
func NewCompilerState() *CompilerState {
	return &CompilerState{
		instructions: []Instruction{},
		labelCounter: 0,
	}
}

// Emit は命令を1つ追加する。
// 使い方: state.Emit(OP_PUSH_NUM, "42")
func (cs *CompilerState) Emit(op OpCode, operands ...string) {
	cs.instructions = append(cs.instructions, Instruction{
		Op:       op,
		Operands: operands,
	})
}

// NewLabel はユニークなラベル名を生成して返す。
// "L0", "L1", "L2", ... と連番で生成される。
func (cs *CompilerState) NewLabel() string {
	label := fmt.Sprintf("L%d", cs.labelCounter)
	cs.labelCounter++
	return label
}

// GetInstructions は生成済みの命令列を返す。
func (cs *CompilerState) GetInstructions() []Instruction {
	return cs.instructions
}
